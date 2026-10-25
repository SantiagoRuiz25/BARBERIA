/**
 * Servidor de citas y pagos — Estudio 4-4-4 Barber
 *
 * - Los clientes (cualquier dispositivo) reservan con POST /api/appointments.
 * - Pago en línea REAL con Wompi (PSE, tarjetas, Nequi, Bancolombia): el servidor
 *   calcula el valor de la seña, firma el checkout y confirma el pago con Wompi.
 *   El navegador NUNCA decide cuánto se cobra ni si un pago fue aprobado.
 * - Pago en el local: la cita queda confirmada y el barbero marca "cobrado".
 * - Solo el barbero (con sesión) puede ver y gestionar las citas.
 *
 * Uso:  npm run api      (puerto 3000)
 * Configuración: copia .env.example a .env y completa tus llaves de Wompi.
 */
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ---------------------------------------------------------------------------
// Variables de entorno (lector mínimo de .env, sin dependencias)
// ---------------------------------------------------------------------------
function loadEnvFile(file) {
  try {
    for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq < 1) continue;
      const key = line.slice(0, eq).trim();
      const value = line.slice(eq + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    /* sin .env: se usan valores por defecto */
  }
}
loadEnvFile(path.join(__dirname, '.env'));

const env = (name, fallback = '') => (process.env[name] ?? fallback).toString().trim();
const IS_PROD = env('NODE_ENV') === 'production';

const PORT = Number(env('PORT')) || 3000;
const ADMIN_EMAIL = env('ADMIN_EMAIL', 'erick@barberia444.com').toLowerCase();
const ADMIN_PASS = env('ADMIN_PASS', 'Barber444*');
const ADMIN_NAME = env('ADMIN_NAME', 'Adian Anave');
const SESSION_HOURS = 12;

const PUBLIC_URL = env('PUBLIC_URL').replace(/\/$/, ''); // ej. https://tubarberia.com
const DEPOSIT_PERCENT = Math.min(100, Math.max(10, Number(env('DEPOSIT_PERCENT')) || 50));
const HOLD_MINUTES = Math.max(5, Number(env('HOLD_MINUTES')) || 15); // tiempo para pagar la seña

const WOMPI_PUBLIC_KEY = env('WOMPI_PUBLIC_KEY');
const WOMPI_INTEGRITY_SECRET = env('WOMPI_INTEGRITY_SECRET');
const WOMPI_EVENTS_SECRET = env('WOMPI_EVENTS_SECRET');
const WOMPI_SANDBOX = !WOMPI_PUBLIC_KEY.startsWith('pub_prod_');
const WOMPI_API =
  env('WOMPI_API_URL') || (WOMPI_SANDBOX ? 'https://sandbox.wompi.co/v1' : 'https://production.wompi.co/v1');
const WOMPI_CHECKOUT = 'https://checkout.wompi.co/p/';
const ONLINE_PAYMENTS = Boolean(WOMPI_PUBLIC_KEY && WOMPI_INTEGRITY_SECRET);

if (IS_PROD && (!process.env.ADMIN_PASS || !process.env.TOKEN_SECRET)) {
  console.error('✖ En producción debes definir ADMIN_PASS y TOKEN_SECRET.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Catálogo (debe coincidir con src/app/core/services/barber.service.ts).
// El precio se toma de AQUÍ, nunca del navegador del cliente.
// ---------------------------------------------------------------------------
const BARBERS = { adian: ADMIN_NAME };

const SERVICES = {
  'corte-caballero': { name: 'Corte de Caballero', price: 18000 },
  'corte-dama': { name: 'Corte de Dama', price: 15000 },
  'perfilado-barba': { name: 'Perfilado de Barba', price: 8000 },
  afeitado: { name: 'Afeitado', price: 10000 },
  'limpieza-facial': { name: 'Limpieza Facial', price: 18000 },
  'otro-servicio': { name: 'Otro Servicio', price: 8000 },
};

const SLOTS = [
  '09:00', '09:45', '10:30', '11:15', '12:00', '13:30',
  '14:15', '15:00', '15:45', '16:30', '17:15', '18:00',
];

// 'efectivo' = paga en el local · 'wompi' = pago en línea (PSE, tarjeta, Nequi… se elige en Wompi)
const PAYMENT_METHODS = ['efectivo', 'wompi', 'pse', 'tarjeta'];
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];

// ---------------------------------------------------------------------------
// Almacenamiento en archivo JSON
// ---------------------------------------------------------------------------
// DATA_DIR permite guardar las citas en un disco persistente al publicar (ver DESPLIEGUE.md)
const DATA_DIR = env('DATA_DIR') || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'appointments.json');
const SECRET_FILE = path.join(DATA_DIR, '.secret');

fs.mkdirSync(DATA_DIR, { recursive: true });

function loadAppointments() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return [];
  }
}

let appointments = loadAppointments();

function saveAppointments() {
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(appointments, null, 2));
  fs.renameSync(tmp, DATA_FILE); // escritura atómica
}

function getSecret() {
  if (process.env.TOKEN_SECRET) return process.env.TOKEN_SECRET;
  try {
    return fs.readFileSync(SECRET_FILE, 'utf8').trim();
  } catch {
    const secret = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(SECRET_FILE, secret, { mode: 0o600 });
    return secret;
  }
}
const SECRET = getSecret();

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseISODate(iso) {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
}

function dateLabel(date) {
  return `${String(date.getDate()).padStart(2, '0')} de ${MONTHS[date.getMonth()]} de ${date.getFullYear()}`;
}

function cleanText(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// Una cita "ocupa" su hora si está confirmada, o si espera un pago cuyo plazo no venció.
function holdExpired(a) {
  return a.status === 'pendiente' && a.paymentStatus === 'esperando_pago' && a.holdUntil && Date.parse(a.holdUntil) < Date.now();
}

function isActive(a) {
  if (a.status === 'cancelado') return false;
  if (holdExpired(a)) return false;
  return true;
}

function takenTimes(dateISO) {
  return appointments.filter((a) => a.dateISO === dateISO && isActive(a)).map((a) => a.time);
}

/** Libera las horas de reservas que nunca se pagaron y borra registros viejos sin pago. */
function sweepExpired() {
  let changed = false;
  const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
  for (const a of appointments) {
    if (holdExpired(a)) {
      a.status = 'cancelado';
      a.paymentStatus = 'expirado';
      a.cancelReason = 'pago-no-completado';
      changed = true;
    }
  }
  const before = appointments.length;
  appointments = appointments.filter(
    (a) => !(a.paymentStatus === 'expirado' && Date.parse(a.createdAt || 0) < weekAgo)
  );
  if (changed || appointments.length !== before) saveAppointments();
}
setInterval(sweepExpired, 60 * 1000).unref();
sweepExpired();

function newBookingCode() {
  let code;
  do {
    code = '444-' + crypto.randomBytes(4).toString('hex').slice(0, 6).toUpperCase();
  } while (appointments.some((a) => a.id === code));
  return code;
}

function depositFor(price) {
  return Math.round((price * DEPOSIT_PERCENT) / 100);
}

// Tokens firmados (HMAC) — sin dependencias extra
function signToken() {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + SESSION_HOURS * 3600 * 1000 })).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyToken(token) {
  if (typeof token !== 'string') return false;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  const expected = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
  if (!safeEqual(sig, expected)) return false;
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString()).exp > Date.now();
  } catch {
    return false;
  }
}

function requireAdmin(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!verifyToken(token)) return res.status(401).json({ error: 'No autorizado.' });
  next();
}

// Limitador sencillo en memoria: máx. N peticiones por ventana e IP
function rateLimit(max, windowMs) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip;
    const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (recent.length >= max) {
      return res.status(429).json({ error: 'Demasiados intentos. Espera un momento e inténtalo de nuevo.' });
    }
    recent.push(now);
    hits.set(key, recent);
    next();
  };
}

// Datos que el cliente puede ver de su propia reserva (sin teléfono ni correo)
function publicView(a) {
  return {
    id: a.id,
    status: a.status,
    paymentStatus: a.paymentStatus,
    paymentMethod: a.paymentMethod,
    serviceName: a.serviceName,
    barberName: a.barberName,
    date: a.date,
    dateISO: a.dateISO,
    time: a.time,
    price: a.price,
    depositAmount: a.depositAmount,
    holdUntil: a.holdUntil || null,
  };
}

// ---------------------------------------------------------------------------
// Wompi
// ---------------------------------------------------------------------------
function originFor(req) {
  if (PUBLIC_URL) return PUBLIC_URL;
  const origin = req.get('origin');
  if (origin && /^https?:\/\/[\w.:-]+$/.test(origin)) return origin;
  return `http://localhost:4200`;
}

/** Crea la URL del checkout de Wompi, firmada en el servidor. */
function buildCheckoutUrl(a, origin) {
  const attempt = (a.paymentReferences || []).length + 1;
  const reference = `${a.id}-${attempt}`;
  a.paymentReferences = [...(a.paymentReferences || []), reference];

  const amountInCents = a.depositAmount * 100;
  const currency = 'COP';
  const signature = sha256(`${reference}${amountInCents}${currency}${WOMPI_INTEGRITY_SECRET}`);

  const params = new URLSearchParams({
    'public-key': WOMPI_PUBLIC_KEY,
    currency,
    'amount-in-cents': String(amountInCents),
    reference,
    'signature:integrity': signature,
    'redirect-url': `${origin}/reservar/pago/${encodeURIComponent(a.id)}`,
  });

  const email = cleanText(a.clientEmail, 120);
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) params.set('customer-data:email', email);
  if (a.clientName) params.set('customer-data:full-name', a.clientName);
  let phone = String(a.clientPhone || '').replace(/\D/g, '');
  if (phone.startsWith('57') && phone.length === 12) phone = phone.slice(2);
  if (phone.length === 10) {
    params.set('customer-data:phone-number', phone);
    params.set('customer-data:phone-number-prefix', '+57');
  }
  return `${WOMPI_CHECKOUT}?${params.toString()}`;
}

async function fetchWompiTransaction(id) {
  const res = await fetch(`${WOMPI_API}/transactions/${encodeURIComponent(id)}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Wompi respondió ${res.status}`);
  const body = await res.json();
  return body.data;
}

/**
 * Aplica el resultado REAL de una transacción de Wompi a la cita.
 * Es idempotente: se puede llamar varias veces (webhook + regreso del cliente).
 */
function applyTransaction(tx) {
  if (!tx || typeof tx.reference !== 'string') return null;
  const appointment = appointments.find((a) => (a.paymentReferences || []).includes(tx.reference));
  if (!appointment) return null;

  // El monto y la moneda deben coincidir con lo que el servidor calculó
  if (tx.amount_in_cents !== appointment.depositAmount * 100 || tx.currency !== 'COP') {
    console.warn(`[pago] ${appointment.id}: monto/moneda no coinciden (${tx.amount_in_cents} ${tx.currency})`);
    return appointment;
  }
  if (appointment.paymentStatus === 'pagado') return appointment; // ya confirmado

  if (tx.status === 'APPROVED') {
    const slotLost = appointments.some(
      (o) => o.id !== appointment.id && o.dateISO === appointment.dateISO && o.time === appointment.time && isActive(o)
    );
    appointment.wompiTransactionId = tx.id;
    appointment.paidAt = new Date().toISOString();
    appointment.amountPaid = appointment.depositAmount;
    appointment.paymentStatus = 'pagado';
    if (appointment.status === 'cancelado' && slotLost) {
      // Pagó después de vencer el plazo y la hora ya la tomó otra persona: requiere reembolso manual
      appointment.needsRefund = true;
      console.warn(`[pago] ${appointment.id}: pago aprobado pero la hora ya no está libre. Reembolsar en Wompi.`);
    } else {
      appointment.status = 'confirmado';
      delete appointment.cancelReason;
      delete appointment.holdUntil;
    }
    console.log(`[pago] ${appointment.id} APROBADO (${tx.id})`);
  } else if (['DECLINED', 'ERROR', 'VOIDED'].includes(tx.status)) {
    appointment.paymentStatus = 'rechazado';
    appointment.lastPaymentStatus = tx.status;
    console.log(`[pago] ${appointment.id} ${tx.status} (${tx.id})`);
  }
  // PENDING: se queda esperando (el plazo de la reserva sigue corriendo)
  saveAppointments();
  return appointment;
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
const app = express();
app.disable('x-powered-by');
if (env('TRUST_PROXY')) app.set('trust proxy', 1); // solo detrás de un proxy (Nginx, Render, etc.)
app.use(
  cors(
    PUBLIC_URL
      ? { origin: [PUBLIC_URL, /^http:\/\/localhost:\d+$/] }
      : undefined // desarrollo: cualquier origen (celular en la misma red, etc.)
  )
);
app.use((_req, res, next) => {
  res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
  next();
});
app.use(express.json({ limit: '20kb' }));

// --- Público: configuración que necesita la web ---
app.get('/api/config', (_req, res) => {
  res.json({
    onlinePayments: ONLINE_PAYMENTS,
    sandbox: ONLINE_PAYMENTS ? WOMPI_SANDBOX : null,
    depositPercent: DEPOSIT_PERCENT,
    holdMinutes: HOLD_MINUTES,
  });
});

// --- Público: horas ya ocupadas de un día (sin datos personales) ---
app.get('/api/availability', (req, res) => {
  const date = parseISODate(req.query.date);
  if (!date) return res.status(400).json({ error: 'Fecha inválida.' });
  res.json({ date: req.query.date, taken: takenTimes(req.query.date) });
});

// --- Público: crear una cita ---
app.post('/api/appointments', rateLimit(20, 60 * 60 * 1000), (req, res) => {
  const body = req.body || {};

  const clientName = cleanText(body.clientName, 80);
  const clientPhone = cleanText(body.clientPhone, 25);
  const clientEmail = cleanText(body.clientEmail, 120);
  const barberName = BARBERS[body.barberId];
  const service = SERVICES[body.serviceId];
  const paymentMethod = PAYMENT_METHODS.includes(body.paymentMethod) ? body.paymentMethod : null;
  const date = parseISODate(body.dateISO);
  const time = body.time;

  if (clientName.length < 2) return res.status(400).json({ error: 'Escribe tu nombre.' });
  if (clientPhone.replace(/\D/g, '').length < 6) return res.status(400).json({ error: 'Escribe un WhatsApp válido.' });
  if (clientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) return res.status(400).json({ error: 'Correo no válido.' });
  if (!barberName) return res.status(400).json({ error: 'Barbero no válido.' });
  if (!service) return res.status(400).json({ error: 'Servicio no válido.' });
  if (!paymentMethod) return res.status(400).json({ error: 'Método de pago no válido.' });
  if (paymentMethod !== 'efectivo' && !ONLINE_PAYMENTS) {
    return res.status(503).json({ error: 'El pago en línea no está disponible por ahora. Elige pagar en el local.' });
  }
  if (!date) return res.status(400).json({ error: 'Fecha no válida.' });
  if (!SLOTS.includes(time)) return res.status(400).json({ error: 'Hora no válida.' });
  if (body.dateISO < todayISO()) return res.status(400).json({ error: 'No se puede reservar en una fecha pasada.' });
  if (date.getDay() === 0) return res.status(400).json({ error: 'Los domingos estamos cerrados.' });

  if (body.dateISO === todayISO()) {
    const [h, m] = time.split(':').map(Number);
    const now = new Date();
    if (h * 60 + m <= now.getHours() * 60 + now.getMinutes()) {
      return res.status(400).json({ error: 'Esa hora ya pasó. Elige otra.' });
    }
  }

  sweepExpired();
  if (takenTimes(body.dateISO).includes(time)) {
    return res.status(409).json({ error: 'Esa hora acaba de ser reservada. Elige otra.' });
  }

  const online = paymentMethod !== 'efectivo';
  const appointment = {
    id: newBookingCode(),
    clientName,
    clientPhone,
    clientEmail,
    barberName,
    serviceName: service.name,
    date: dateLabel(date),
    dateISO: body.dateISO,
    time,
    price: service.price,
    depositAmount: depositFor(service.price),
    status: online ? 'pendiente' : 'confirmado',
    paymentMethod,
    paymentStatus: online ? 'esperando_pago' : 'pendiente_local',
    createdAt: new Date().toISOString(),
  };
  if (online) appointment.holdUntil = new Date(Date.now() + HOLD_MINUTES * 60 * 1000).toISOString();

  const result = { id: appointment.id, status: appointment.status, depositAmount: appointment.depositAmount };
  if (online) result.checkoutUrl = buildCheckoutUrl(appointment, originFor(req));

  appointments.push(appointment);
  saveAppointments();
  console.log(`[cita] ${appointment.id} — ${appointment.clientName} — ${appointment.date} ${appointment.time} — ${paymentMethod}`);

  res.status(201).json(result);
});

// --- Público: nuevo intento de pago de una reserva que sigue esperando ---
app.post('/api/appointments/:id/checkout', rateLimit(20, 60 * 60 * 1000), (req, res) => {
  if (!ONLINE_PAYMENTS) return res.status(503).json({ error: 'El pago en línea no está disponible.' });
  sweepExpired();
  const a = appointments.find((x) => x.id === req.params.id);
  if (!a) return res.status(404).json({ error: 'Reserva no encontrada.' });
  if (a.paymentStatus === 'pagado') return res.status(409).json({ error: 'Esta reserva ya está pagada.' });
  if (a.paymentMethod === 'efectivo') return res.status(400).json({ error: 'Esta reserva se paga en el local.' });

  if (a.status === 'cancelado') {
    // Plazo vencido: solo se puede reintentar si la hora sigue libre
    if (takenTimes(a.dateISO).includes(a.time)) {
      return res.status(409).json({ error: 'El plazo venció y esa hora ya fue tomada. Haz una nueva reserva.' });
    }
    a.status = 'pendiente';
    a.paymentStatus = 'esperando_pago';
    delete a.cancelReason;
  }
  a.holdUntil = new Date(Date.now() + HOLD_MINUTES * 60 * 1000).toISOString();
  const checkoutUrl = buildCheckoutUrl(a, originFor(req));
  saveAppointments();
  res.json({ checkoutUrl });
});

// --- Público: estado de una reserva (para la pantalla de resultado del pago) ---
app.get('/api/payments/status/:id', rateLimit(120, 60 * 1000), (req, res) => {
  sweepExpired();
  const a = appointments.find((x) => x.id === req.params.id);
  if (!a) return res.status(404).json({ error: 'Reserva no encontrada.' });
  res.json(publicView(a));
});

// --- Público: el cliente vuelve de Wompi → confirmamos la transacción con Wompi ---
app.post('/api/payments/confirm', rateLimit(60, 60 * 1000), async (req, res) => {
  const id = cleanText(req.body?.id, 40);
  const transactionId = cleanText(req.body?.transactionId, 80);
  const a = appointments.find((x) => x.id === id);
  if (!a) return res.status(404).json({ error: 'Reserva no encontrada.' });
  if (!ONLINE_PAYMENTS || !transactionId) return res.json(publicView(a));

  try {
    const tx = await fetchWompiTransaction(transactionId);
    // Solo aceptamos transacciones cuya referencia pertenece a ESTA reserva
    if (tx && (a.paymentReferences || []).includes(tx.reference)) applyTransaction(tx);
  } catch (err) {
    console.warn('[pago] no se pudo consultar a Wompi:', err.message);
  }
  res.json(publicView(a));
});

// --- Wompi → nuestro servidor: eventos de transacciones (webhook) ---
app.post('/api/payments/wompi-webhook', async (req, res) => {
  const event = req.body || {};
  if (!WOMPI_EVENTS_SECRET) return res.status(503).json({ error: 'Webhook no configurado.' });

  // 1) Verificar la firma del evento
  const props = event.signature?.properties;
  const checksum = event.signature?.checksum;
  if (!Array.isArray(props) || !checksum || event.timestamp === undefined) {
    return res.status(400).json({ error: 'Evento inválido.' });
  }
  const values = props.map((p) => p.split('.').reduce((obj, k) => (obj ? obj[k] : undefined), event.data));
  if (values.some((v) => v === undefined)) return res.status(400).json({ error: 'Evento inválido.' });
  const expected = sha256(values.join('') + event.timestamp + WOMPI_EVENTS_SECRET);
  if (!safeEqual(String(checksum).toLowerCase(), expected)) {
    console.warn('[webhook] firma inválida');
    return res.status(401).json({ error: 'Firma inválida.' });
  }

  // 2) Solo nos interesan las transacciones
  const eventTx = event.data?.transaction;
  if (event.event === 'transaction.updated' && eventTx?.id) {
    let tx = eventTx;
    try {
      tx = await fetchWompiTransaction(eventTx.id); // la fuente de verdad es la API de Wompi
    } catch (err) {
      console.warn('[webhook] usando datos del evento (no se pudo consultar a Wompi):', err.message);
    }
    applyTransaction(tx);
  }
  res.sendStatus(200);
});

// --- Barbero: iniciar sesión ---
app.post('/api/admin/login', rateLimit(10, 15 * 60 * 1000), (req, res) => {
  const email = cleanText(req.body?.email, 120).toLowerCase();
  const pass = typeof req.body?.password === 'string' ? req.body.password : '';

  const okEmail = email === ADMIN_EMAIL;
  const okPass = pass.length === ADMIN_PASS.length && crypto.timingSafeEqual(Buffer.from(pass), Buffer.from(ADMIN_PASS));

  if (!okEmail || !okPass) return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
  res.json({ token: signToken(), name: ADMIN_NAME });
});

app.get('/api/admin/me', requireAdmin, (_req, res) => res.json({ name: ADMIN_NAME }));

// --- Barbero: cambiar el estado de una cita (confirmar / cancelar) ---
app.patch('/api/appointments/:id/status', requireAdmin, (req, res) => {
  const status = req.body?.status;
  if (!['confirmado', 'pendiente', 'cancelado'].includes(status)) {
    return res.status(400).json({ error: 'Estado no válido.' });
  }

  const appointment = appointments.find((a) => a.id === req.params.id);
  if (!appointment) return res.status(404).json({ error: 'Cita no encontrada.' });

  if (status !== 'cancelado' && appointment.status === 'cancelado' && takenTimes(appointment.dateISO).includes(appointment.time)) {
    return res.status(409).json({ error: 'Esa hora ya fue tomada por otro cliente.' });
  }

  appointment.status = status;
  if (status === 'confirmado') delete appointment.holdUntil;
  saveAppointments();
  console.log(`[estado] ${appointment.id} → ${status}`);

  res.json(appointment);
});

// --- Barbero: marcar el pago en el local como cobrado ---
app.patch('/api/appointments/:id/cash', requireAdmin, (req, res) => {
  const appointment = appointments.find((a) => a.id === req.params.id);
  if (!appointment) return res.status(404).json({ error: 'Cita no encontrada.' });
  if (appointment.paymentStatus === 'pagado') return res.status(409).json({ error: 'Ya está pagada.' });

  appointment.paymentStatus = 'pagado';
  appointment.amountPaid = appointment.price;
  appointment.paidAt = new Date().toISOString();
  appointment.paidInStore = true;
  if (appointment.status === 'pendiente') appointment.status = 'confirmado';
  delete appointment.holdUntil;
  saveAppointments();
  res.json(appointment);
});

// --- Barbero: eliminar una cita del registro ---
app.delete('/api/appointments/:id', requireAdmin, (req, res) => {
  const index = appointments.findIndex((a) => a.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Cita no encontrada.' });
  const [removed] = appointments.splice(index, 1);
  saveAppointments();
  console.log(`[eliminada] ${removed.id}`);
  res.json({ ok: true });
});

// --- Barbero: ver todas las citas (próximas primero) ---
app.get('/api/appointments', requireAdmin, (_req, res) => {
  sweepExpired();
  const today = todayISO();
  const byDateTime = (a, b) => (a.dateISO + a.time).localeCompare(b.dateISO + b.time);
  // Las reservas que nunca se pagaron (plazo vencido) no son turnos reales: no se muestran
  const visible = appointments.filter((a) => a.paymentStatus !== 'expirado');
  const upcoming = visible.filter((a) => a.dateISO >= today).sort(byDateTime);
  const past = visible.filter((a) => a.dateISO < today).sort((a, b) => byDateTime(b, a));
  res.json([...upcoming, ...past]);
});

// Rutas /api que no existen
app.use('/api', (_req, res) => res.status(404).json({ error: 'No encontrado.' }));

// --- La página (Angular compilada con `npm run build`): el mismo servidor la entrega ---
const SITE_DIR = path.join(__dirname, 'dist', 'barberia', 'browser');
if (fs.existsSync(path.join(SITE_DIR, 'index.html'))) {
  app.use(
    express.static(SITE_DIR, {
      setHeaders(res, file) {
        if (file.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache');
        else if (/\.(js|css)$/.test(file)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        else res.setHeader('Cache-Control', 'public, max-age=86400');
      },
    })
  );
  // Rutas de la página (/reservar, /admin, /reservar/pago/…): siempre devuelven index.html
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(SITE_DIR, 'index.html'));
  });
}

// JSON mal formado, etc.
app.use((err, _req, res, _next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Datos inválidos.' });
  console.error(err);
  res.status(500).json({ error: 'Error del servidor.' });
});

app.listen(PORT, () => {
  console.log(`API de citas lista en http://localhost:${PORT}/api`);
  if (fs.existsSync(path.join(SITE_DIR, 'index.html'))) console.log(`🌐 Página disponible en http://localhost:${PORT}`);
  if (!process.env.ADMIN_PASS) {
    console.log('⚠  Estás usando la contraseña de admin por defecto. Define ADMIN_PASS antes de publicar.');
  }
  if (ONLINE_PAYMENTS) {
    console.log(`💳 Pagos en línea ACTIVOS con Wompi (${WOMPI_SANDBOX ? 'SANDBOX / pruebas' : 'PRODUCCIÓN'})`);
    if (!WOMPI_EVENTS_SECRET) console.log('⚠  Falta WOMPI_EVENTS_SECRET: sin webhook, los pagos se confirman cuando el cliente vuelve a la página.');
  } else {
    console.log('💳 Pagos en línea DESACTIVADOS (faltan WOMPI_PUBLIC_KEY / WOMPI_INTEGRITY_SECRET). Solo se acepta pago en el local.');
  }
});
