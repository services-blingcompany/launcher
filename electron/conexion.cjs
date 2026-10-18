"use strict";

/**
 * Cuándo mostrar la pantalla de "no pudimos conectar".
 *
 * Chromium avisa de cada carga que falla con su código de error. Sólo
 * interesan las fallas del marco principal y las que son de red: una
 * navegación cancelada a propósito (por ejemplo, un enlace que se manda al
 * navegador del sistema) también "falla", y ahí no hay nada que contarle al
 * usuario.
 *
 * Es lógica pura (entra un número, sale un motivo): se prueba en
 * electron/conexion.test.mjs.
 */

/** No hay salida: el equipo está desconectado o no resuelve direcciones. */
const SIN_INTERNET = new Set([
  -106, // ERR_INTERNET_DISCONNECTED
  -105, // ERR_NAME_NOT_RESOLVED
  -137, // ERR_NAME_RESOLUTION_FAILED
  -21, // ERR_NETWORK_CHANGED
]);

/** Hay internet, pero del otro lado nadie contesta. */
const SITIO_CAIDO = new Set([
  -7, // ERR_TIMED_OUT
  -118, // ERR_CONNECTION_TIMED_OUT
  -100, // ERR_CONNECTION_CLOSED
  -101, // ERR_CONNECTION_RESET
  -102, // ERR_CONNECTION_REFUSED
  -104, // ERR_CONNECTION_FAILED
  -2, // ERR_FAILED
]);

/**
 * Qué contar para ese código: "internet" si el problema parece del equipo,
 * "sitio" si parece del otro lado, y null si no hay que mostrar nada (fallas
 * que no son de red, o una navegación cancelada).
 */
function motivoDeFalla(codigo) {
  if (SIN_INTERNET.has(codigo)) return "internet";
  if (SITIO_CAIDO.has(codigo)) return "sitio";
  return null;
}

module.exports = { motivoDeFalla };
