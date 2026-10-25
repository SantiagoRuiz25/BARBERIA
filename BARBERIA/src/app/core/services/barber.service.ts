import { Injectable, computed, signal } from '@angular/core';
import {
  Barber, ServiceItem, TimeSlot, FaqItem, GalleryImage, Appointment,
  NewAppointment, CreateAppointmentResult, AppointmentStatus, AppConfig,
} from '../models/models';
import { API_URL } from '../api.config';

/** Horas de atención (deben coincidir con SLOTS en citas-server.js). */
const SLOT_TIMES = ['09:00', '09:45', '10:30', '11:15', '12:00', '13:30', '14:15', '15:00', '15:45', '16:30', '17:15', '18:00'];
const TOKEN_KEY = 'barberToken';

@Injectable({ providedIn: 'root' })
export class BarberService {
  readonly barbers = signal<Barber[]>([
    {
      id: 'adian',
      name: 'Adian Anave',
      role: 'Barbero Profesional',
      photo: 'gallery/barbero.jpg',
      bio: 'Cortes clásicos y modernos, degradados y perfilado de barba. Antes de cada servicio conversamos qué buscas. Tu estilo, mi enfoque.',
    },
  ]);

  readonly services = signal<ServiceItem[]>([
    {
      id: 'corte-caballero',
      name: 'Corte de Caballero',
      description: 'Corte clásico y moderno, degradé y perfilado de contornos.',
      price: 18000,
      durationMin: 35,
      icon: '💇',
    },
    {
      id: 'corte-dama',
      name: 'Corte de Dama',
      description: 'Corte femenino personalizado, tendencias actuales.',
      price: 15000,
      durationMin: 30,
      icon: '💇‍♀️',
    },
    {
      id: 'perfilado-barba',
      name: 'Perfilado de Barba',
      description: 'Diseño y perfilado profesional de barba con navaja.',
      price: 8000,
      durationMin: 20,
      icon: '🧔',
    },
    {
      id: 'afeitado',
      name: 'Afeitado',
      description: 'Afeitado clásico con navaja, toallas calientes y aceites.',
      price: 10000,
      durationMin: 25,
      icon: '🪒',
    },
    {
      id: 'limpieza-facial',
      name: 'Limpieza Facial',
      description: 'Limpieza profunda, exfoliación y cuidado de la piel.',
      price: 18000,
      durationMin: 40,
      icon: '✨',
    },
    {
      id: 'otro-servicio',
      name: 'Otro Servicio',
      description: 'Consúltanos por servicios personalizados a tu medida.',
      price: 8000,
      durationMin: 20,
      icon: '➕',
    },
  ]);

  readonly faqs = signal<FaqItem[]>([
    {
      question: '¿Dónde queda Estudio 4-4-4 Barber?',
      answer: 'Estamos en Yopal, Casanare. Visítanos y descubre la experiencia.',
    },
    {
      question: '¿Hay que reservar turno o se puede ir sin cita?',
      answer: 'Recomendamos reservar online para asegurar tu horario. También recibimos clientes sin cita según disponibilidad del día.',
    },
    {
      question: '¿Qué días y horarios trabajan?',
      answer: 'Trabajamos de lunes a sábado de 09:00 a 19:00 hs. Domingos cerrado.',
    },
    {
      question: '¿Cuánto sale un corte de caballero?',
      answer: 'El corte de caballero tiene un precio de $18.000. Puedes ver el detalle completo de precios en la sección Servicios.',
    },
    {
      question: '¿Hacen perfilado de barba?',
      answer: 'Sí, el perfilado de barba cuesta $8.000. Incluye diseño y arreglo con navaja.',
    },
    {
      question: '¿Qué formas de pago aceptan?',
      answer: 'Puedes pagar en efectivo en el local, o asegurar tu hora con una seña en línea (PSE, tarjeta de débito/crédito, Nequi o Bancolombia) y pagar el resto el día de tu visita.',
    },
    {
      question: '¿Hacen limpieza facial?',
      answer: 'Sí, ofrecemos limpieza facial profunda por $18.000. Incluye exfoliación y cuidado de la piel.',
    },
  ]);

  readonly gallery = signal<GalleryImage[]>([
    { id: 'g1', url: 'gallery/corte-1.jpg', alt: 'Corte fade con diseño' },
    { id: 'g2', url: 'gallery/corte-2.jpg', alt: 'Corte con capas' },
    { id: 'g3', url: 'gallery/corte-3.jpg', alt: 'Corte infantil' },
    { id: 'g4', url: 'gallery/corte-4.jpg', alt: 'Corte de barbero trabajando' },
    { id: 'g5', url: 'gallery/corte-5.jpg', alt: 'Corte con diseño lateral' },
    { id: 'g6', url: 'gallery/corte-6.jpg', alt: 'Perfilado de barba' },
    { id: 'g7', url: 'gallery/corte-7.jpg', alt: 'Corte en espejo con luz LED' },
    { id: 'g8', url: 'gallery/corte-8.jpg', alt: 'Corte mullet moderno' },
  ]);

  // ---------------------------------------------------------------------
  // Citas reales: viven en el servidor (citas-server.js), no en el navegador
  // ---------------------------------------------------------------------
  readonly appointments = signal<Appointment[]>([]);
  readonly appointmentsError = signal(false);

  /** Ingresos de los últimos 6 meses, calculados con las citas reales. */
  readonly monthlyRevenue = computed(() => {
    const now = new Date();
    const months: { key: string; month: string; total: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('es-CO', { month: 'short' }).replace('.', '');
      months.push({ key, month: label.charAt(0).toUpperCase() + label.slice(1), total: 0 });
    }
    for (const a of this.appointments()) {
      if (a.status !== 'confirmado') continue;
      const m = months.find((x) => x.key === a.dateISO.slice(0, 7));
      if (m) m.total += a.price;
    }
    return months.map(({ month, total }) => ({ month, total }));
  });

  constructor() {
    // Borra los datos de ejemplo / sesión insegura que guardaba la versión anterior
    localStorage.removeItem('444_appointments');
    localStorage.removeItem('isBarber');
    localStorage.removeItem('barberEmail');
  }

  toISODate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // ---------------------------------------------------------------------
  // Sesión del barbero
  // ---------------------------------------------------------------------
  private get token(): string {
    return localStorage.getItem(TOKEN_KEY) ?? '';
  }

  private authHeaders(): HeadersInit {
    return { Authorization: `Bearer ${this.token}` };
  }

  async adminLogin(email: string, password: string): Promise<{ ok: true } | { ok: false; message: string }> {
    try {
      const res = await fetch(`${API_URL}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, message: body.error ?? 'No se pudo iniciar sesión.' };
      localStorage.setItem(TOKEN_KEY, body.token);
      localStorage.setItem('barberName', body.name);
      return { ok: true };
    } catch {
      return { ok: false, message: 'No hay conexión con el servidor de citas. ¿Está encendido? (npm run api)' };
    }
  }

  adminLogout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('barberName');
    this.appointments.set([]);
  }

  /** Confirma con el servidor que la sesión del barbero sigue siendo válida. */
  async verifyAdmin(): Promise<boolean> {
    if (!this.token) return false;
    try {
      const res = await fetch(`${API_URL}/admin/me`, { headers: this.authHeaders() });
      if (res.status === 401) this.adminLogout();
      return res.ok;
    } catch {
      return false;
    }
  }

  /** Trae las citas reales del servidor (solo con sesión de barbero). */
  async refreshAppointments(): Promise<'ok' | 'unauthorized' | 'error'> {
    try {
      const res = await fetch(`${API_URL}/appointments`, { headers: this.authHeaders() });
      if (res.status === 401) return 'unauthorized';
      if (!res.ok) throw new Error();
      this.appointments.set(await res.json());
      this.appointmentsError.set(false);
      return 'ok';
    } catch {
      this.appointmentsError.set(true);
      return 'error';
    }
  }

  /** Cambia el estado de una cita en el servidor (confirmar / cancelar). */
  async updateAppointmentStatus(
    id: string,
    status: AppointmentStatus
  ): Promise<'ok' | 'unauthorized' | 'error'> {
    try {
      const res = await fetch(`${API_URL}/appointments/${encodeURIComponent(id)}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...this.authHeaders() },
        body: JSON.stringify({ status }),
      });
      if (res.status === 401) return 'unauthorized';
      if (!res.ok) throw new Error();
      const updated: Appointment = await res.json();
      this.appointments.update(list =>
        list.map(a => (a.id === updated.id ? updated : a))
      );
      return 'ok';
    } catch {
      return 'error';
    }
  }

  /** Marca como cobrado (en el local) el pago de una cita. */
  async markAppointmentPaid(id: string): Promise<'ok' | 'unauthorized' | 'error'> {
    try {
      const res = await fetch(`${API_URL}/appointments/${encodeURIComponent(id)}/cash`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...this.authHeaders() },
        body: '{}',
      });
      if (res.status === 401) return 'unauthorized';
      if (!res.ok) throw new Error();
      const updated: Appointment = await res.json();
      this.appointments.update((list) => list.map((a) => (a.id === updated.id ? updated : a)));
      return 'ok';
    } catch {
      return 'error';
    }
  }

  /** Elimina una cita del registro. */
  async deleteAppointment(id: string): Promise<'ok' | 'unauthorized' | 'error'> {
    try {
      const res = await fetch(`${API_URL}/appointments/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: this.authHeaders(),
      });
      if (res.status === 401) return 'unauthorized';
      if (!res.ok) throw new Error();
      this.appointments.update((list) => list.filter((a) => a.id !== id));
      return 'ok';
    } catch {
      return 'error';
    }
  }

  // ---------------------------------------------------------------------
  // Configuración pública (¿hay pago en línea activo?)
  // ---------------------------------------------------------------------
  readonly config = signal<AppConfig | null>(null);

  async loadConfig(): Promise<void> {
    try {
      const res = await fetch(`${API_URL}/config`);
      if (!res.ok) throw new Error();
      this.config.set(await res.json());
    } catch {
      this.config.set({ onlinePayments: false, sandbox: null, depositPercent: 50, holdMinutes: 15 });
    }
  }

  // ---------------------------------------------------------------------
  // Reservas de clientes
  // ---------------------------------------------------------------------
  async createAppointment(data: NewAppointment): Promise<CreateAppointmentResult> {
    try {
      const res = await fetch(`${API_URL}/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 201) return { ok: true, id: body.id, checkoutUrl: body.checkoutUrl, depositAmount: body.depositAmount };
      if (res.status === 409) return { ok: false, reason: 'taken', message: body.error };
      return { ok: false, reason: 'invalid', message: body.error ?? 'No se pudo guardar la reserva.' };
    } catch {
      return {
        ok: false,
        reason: 'network',
        message: 'No pudimos conectar con el servidor. Revisa tu conexión e intentá de nuevo.',
      };
    }
  }

  // ---------------------------------------------------------------------
  // Disponibilidad real (horas ya reservadas por otros clientes)
  // ---------------------------------------------------------------------
  private readonly taken = signal<{ date: string; times: string[] } | null>(null);
  private latestTakenRequest = '';
  readonly slotsLoading = signal(false);
  readonly slotsError = signal(false);

  async loadTaken(dateISO: string): Promise<void> {
    this.latestTakenRequest = dateISO;
    this.taken.set(null);
    this.slotsLoading.set(true);
    this.slotsError.set(false);
    try {
      const res = await fetch(`${API_URL}/availability?date=${dateISO}`);
      if (!res.ok) throw new Error();
      const body = await res.json();
      if (this.latestTakenRequest === dateISO) this.taken.set({ date: dateISO, times: body.taken });
    } catch {
      if (this.latestTakenRequest === dateISO) this.slotsError.set(true);
    } finally {
      if (this.latestTakenRequest === dateISO) this.slotsLoading.set(false);
    }
  }

  getBarberById(id: string): Barber | undefined {
    return this.barbers().find((b) => b.id === id);
  }

  getServiceById(id: string): ServiceItem | undefined {
    return this.services().find((s) => s.id === id);
  }

  getAvailability(date: Date): TimeSlot[] {
    const iso = this.toISODate(date);
    const state = this.taken();
    // Mientras no sepamos qué horas están ocupadas, no mostramos ninguna como libre
    if (!state || state.date !== iso) return [];

    const now = new Date();
    const isToday = iso === this.toISODate(now);
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    return SLOT_TIMES.map((time) => {
      const [h, m] = time.split(':').map(Number);
      const alreadyPassed = isToday && h * 60 + m <= nowMinutes;
      return { time, available: !state.times.includes(time) && !alreadyPassed };
    });
  }

  formatPrice(value: number): string {
    return '$' + value.toLocaleString('es-CO');
  }
}
