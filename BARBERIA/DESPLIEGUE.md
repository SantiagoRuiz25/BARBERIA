# Publicar Estudio 4-4-4 Barber

La página (Angular) y el servidor de citas/pagos (`citas-server.js`) se publican **juntos**:
al compilar la página, el mismo servidor la entrega. Así hay una sola dirección
(`https://tubarberia.com`) y no hay que configurar nada más entre las dos partes.

> ⚠️ No sirve un hosting "solo estático" (GitHub Pages, Netlify sin funciones, etc.):
> el servidor Node tiene que estar **encendido siempre** para guardar citas y confirmar pagos.

## 1. Requisitos del hosting
- Que ejecute **Node.js 22.22.3 o superior** de forma continua.
- Un **disco persistente** (volumen). Las citas se guardan en un archivo; si el hosting borra
  el disco en cada reinicio o publicación, **se pierden los turnos**.
  Opciones que lo ofrecen: un VPS (DigitalOcean, Hetzner, Contabo…), Railway con *Volume*,
  Render con *Persistent Disk* (plan de pago), Fly.io con *Volume*.
- **HTTPS** (casi todos lo dan gratis). Wompi lo exige para volver a tu página y enviar eventos.
- **Una sola instancia** (no escales a 2+ copias: las citas están en un archivo local).

## 2. Comandos
| Paso | Comando |
|---|---|
| Instalar y compilar | `npm install && npm run build` |
| Encender (start command) | `npm run api` |

> No uses `npm start` en el hosting: ese comando es solo para desarrollo (`ng serve`).

## 3. Variables de entorno (en el panel del hosting, NO en el código)
```
NODE_ENV=production
PUBLIC_URL=https://tubarberia.com
ADMIN_EMAIL=...
ADMIN_PASS=una-contraseña-larga-y-propia
TOKEN_SECRET=texto-largo-y-aleatorio
TRUST_PROXY=1
DATA_DIR=/ruta/del/disco/persistente
WOMPI_PUBLIC_KEY=pub_prod_...
WOMPI_INTEGRITY_SECRET=prod_integrity_...
WOMPI_EVENTS_SECRET=prod_events_...
```
Con `NODE_ENV=production` el servidor **no arranca** si faltan `ADMIN_PASS` y `TOKEN_SECRET`
(a propósito: evita publicar con la contraseña por defecto).

## 4. Wompi
1. En comercios.wompi.co → Desarrolladores → Eventos, pega: `https://tubarberia.com/api/payments/wompi-webhook`
2. Prueba primero con llaves **de pruebas** (`pub_test_…`) en tu dirección pública antes de pasar a producción.
3. Haz una reserva de prueba y confirma que el turno pasa a *confirmado* en el panel.

## 5. Lista de verificación
- [ ] `https://tubarberia.com/api/config` responde un JSON.
- [ ] Reservar pagando en el local aparece en el panel del barbero.
- [ ] Reservar pagando en línea (pruebas) vuelve a la página y confirma el turno.
- [ ] Reinicias el servidor y los turnos siguen ahí (el disco es persistente).
- [ ] Copia de seguridad: guarda de vez en cuando el archivo `appointments.json` de `DATA_DIR`.

## Más adelante
Si el negocio crece (varios barberos, muchas reservas), conviene pasar de archivo a una base de datos
(PostgreSQL, por ejemplo). Para un solo local funciona bien tal como está.

---

## Paso a paso en Railway (recomendado para empezar)
1. Sube el proyecto a GitHub (`git add .`, `git status` para confirmar que **no** aparece `.env`, `git commit`, `git push`).
2. Entra a https://railway.com con tu cuenta de GitHub → **New Project → Deploy from GitHub repo** → elige el repositorio.
   Si el proyecto está dentro de una subcarpeta, en **Settings → Root Directory** pon esa carpeta (la que tiene `package.json`).
3. En **Settings**: *Build Command* = `npm install && npm run build` · *Start Command* = `npm run api`.
4. Crea un **Volume** (disco persistente) y móntalo en `/data`.
5. En **Variables** agrega las de la sección 3 (con `DATA_DIR=/data`; Railway ya define `PORT` solo).
6. En **Settings → Networking → Generate Domain** obtendrás `https://algo.up.railway.app`. Ponlo en `PUBLIC_URL` y vuelve a desplegar.
7. Verifica la lista de la sección 5 y configura el webhook de Wompi con esa dirección.

---

## Publicar desde la terminal de Visual Studio Code (Railway CLI)
Abre la terminal de VS Code (**Terminal → Nueva terminal**) dentro de la carpeta del proyecto:
```
npm i -g @railway/cli
railway login                 # abre el navegador para entrar
railway init                  # crea el proyecto en Railway
railway add                   # si pregunta, elige "Empty Service"
railway volume add -m /data   # disco persistente para las citas
railway variable set NODE_ENV=production TRUST_PROXY=1 DATA_DIR=/data
railway variable set 'ADMIN_PASS=tu-clave-larga' 'TOKEN_SECRET=texto-largo-aleatorio'
railway variable set WOMPI_PUBLIC_KEY=pub_test_... WOMPI_INTEGRITY_SECRET=... WOMPI_EVENTS_SECRET=...
railway domain                # genera https://algo.up.railway.app
railway variable set PUBLIC_URL=https://algo.up.railway.app
railway up                    # sube y publica
```
- `railway up` normalmente no sube lo que está en `.gitignore` (como `.env` y `node_modules`),
  por eso las variables se cargan con `railway variable set`.
- Para generar un `TOKEN_SECRET` en PowerShell:
  `-join ((1..48) | ForEach-Object { '{0:x}' -f (Get-Random -Maximum 16) })`
- Para actualizar la página después de cambios: `railway up` otra vez.
