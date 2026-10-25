# Pagos en línea (Wompi) — cómo dejarlos funcionando

La web ya no simula pagos. El pago en línea usa **Wompi** (PSE, tarjetas, Nequi, Bancolombia).
El **servidor** (`citas-server.js`) calcula la seña, firma el cobro y confirma con Wompi si el
pago fue aprobado. El navegador nunca decide cuánto se cobra ni si se pagó.

## 1. Crear tu cuenta
1. Regístrate en https://comercios.wompi.co y completa la verificación del comercio.
2. En el panel: **Desarrolladores → Llaves**. Copia:
   - Llave pública → `WOMPI_PUBLIC_KEY`
   - Secreto de integridad → `WOMPI_INTEGRITY_SECRET`
   - Secreto de eventos → `WOMPI_EVENTS_SECRET`
3. Copia `.env.example` como `.env` y pega esos valores.

> Mientras uses llaves de **pruebas** (`pub_test_...`) no se cobra dinero real.

## 2. Probar
```
npm run api     # servidor en el puerto 3000
npm start       # página en http://localhost:4200
```
Reserva eligiendo "Pagar la seña en línea". Serás llevado a Wompi (modo pruebas). Al volver,
la página verifica el pago con Wompi y confirma tu turno. Los datos de tarjetas/cuentas de
prueba están en https://docs.wompi.co/docs/colombia/datos-de-prueba-en-sandbox/

## 3. Webhook (recomendado)
Para que el pago se confirme aunque el cliente cierre la página, en Wompi → **Desarrolladores →
Eventos** pon esta URL de eventos (debe ser pública, con https):
```
https://TU-DOMINIO/api/payments/wompi-webhook
```
En tu computador no es alcanzable desde internet; funciona al publicar el servidor
(o con un túnel como ngrok durante las pruebas).

## 4. Al publicar
- En `.env`: `PUBLIC_URL`, `ADMIN_PASS`, `TOKEN_SECRET`, `NODE_ENV=production` y llaves `pub_prod_...`.
- En `src/app/core/api.config.ts`: cambia `API_URL` por la dirección pública de tu API.

## Cómo se comporta
- **Pago en línea:** la hora se retiene 15 min. Si Wompi aprueba → turno *confirmado*. Si no
  se paga a tiempo → la hora se libera sola y no aparece en el panel.
- **Pago en el local:** el turno queda confirmado; el barbero pulsa **Cobrado** cuando recibe el dinero.
- **Si alguien paga después de vencer el plazo** y su hora ya la tomó otra persona, el turno
  aparece marcado **Reembolsar** (el reembolso se hace desde el panel de Wompi).
- Los **ingresos** del panel cuentan solo turnos confirmados.
