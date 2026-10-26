/**
 * Dirección del servidor de citas y pagos (citas-server.js).
 *
 * - En tu computador (localhost o una IP de tu red, ej. el celular en el mismo wifi)
 *   usa el mismo host de la página en el puerto 3000.
 * - Ya publicado, usa la MISMA dirección de la página (https://tudominio.com/api),
 *   porque el servidor también entrega la página (ver DESPLIEGUE.md).
 *
 * Si publicas la API en OTRA dirección distinta a la de la página, escríbela aquí:
 *   const PRODUCTION_API_URL = 'https://api.tubarberia.com/api';
 */
const PRODUCTION_API_URL = 'https://barberia-zz3h.onrender.com/api';

const host = location.hostname;
const isLocal =
  host === 'localhost' ||
  host === '127.0.0.1' ||
  /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);

export const API_URL = isLocal
  ? `${location.protocol}//${host}:3000/api`
  : PRODUCTION_API_URL || `${location.origin}/api`;