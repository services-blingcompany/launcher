"use strict";

/**
 * User agent sin la huella de Electron.
 *
 * El user agent de Electron lleva `Electron/44.8.0`, que es lo que delata a
 * una aplicación embebida: Google corta su ventana de inicio de sesión
 * cuando lo ve. Se quita ese token y se deja el nombre del launcher
 * (`BlingLauncher/1.11.0`), que sirve para reconocer el tráfico de la app.
 *
 * Es lógica pura (entra y sale texto): se prueba en electron/userAgent.test.mjs.
 */

/** El token que delata a Electron: "Electron/x.y.z". */
const HUELLA = / Electron\/[\d.]+/g;

/** Saca la huella de Electron y los espacios que quedan de más. */
function limpiar(ua) {
  if (typeof ua !== "string") return "";
  return ua.replace(HUELLA, "").replace(/\s{2,}/g, " ").trim();
}

module.exports = { limpiar };
