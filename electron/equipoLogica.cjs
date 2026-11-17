/**
 * Lógica pura de la huella del equipo (sin Electron, sin disco, sin procesos).
 *
 * La huella identifica la PC ante el backend para el límite de equipos por
 * persona (ver blingnews-backend app/services/dispositivos.py). Sale del id
 * de la máquina que da el sistema operativo, hasheado con sal: nunca viaja el
 * id original, y el mismo id da otra huella fuera de Bling.
 */
"use strict";

const crypto = require("node:crypto");

/** Sal fija: separa esta huella de cualquier otro uso del id de la máquina. */
const SAL = "bling-equipo-v1";

/** Windows: `reg query HKLM\SOFTWARE\Microsoft\Cryptography /v MachineGuid`. */
function idDeWindows(salidaReg) {
  const m = /MachineGuid\s+REG_SZ\s+([0-9a-fA-F-]{20,})/.exec(String(salidaReg || ""));
  return m ? m[1].toLowerCase() : null;
}

/** macOS: `ioreg -rd1 -c IOPlatformExpertDevice` → IOPlatformUUID. */
function idDeMac(salidaIoreg) {
  const m = /"IOPlatformUUID"\s*=\s*"([0-9A-Fa-f-]{20,})"/.exec(String(salidaIoreg || ""));
  return m ? m[1].toLowerCase() : null;
}

/** Linux: contenido de /etc/machine-id (32 hex). */
function idDeLinux(contenido) {
  const v = String(contenido || "").trim().toLowerCase();
  return /^[0-9a-f]{32}$/.test(v) ? v : null;
}

/** sha256(sal + id) en hex: lo único que sale de la PC. */
function huellaDe(idCrudo) {
  return crypto.createHash("sha256").update(`${SAL}:${idCrudo}`).digest("hex");
}

/** Nombre legible del equipo para la lista «tus equipos» (hostname y sistema). */
function nombreDe(hostname, plataforma) {
  const sistema = { win32: "Windows", darwin: "Mac", linux: "Linux" }[plataforma] || plataforma;
  const host = String(hostname || "").trim().slice(0, 60);
  return host ? `${host} (${sistema})` : `Equipo ${sistema}`;
}

module.exports = { SAL, idDeWindows, idDeMac, idDeLinux, huellaDe, nombreDe };
