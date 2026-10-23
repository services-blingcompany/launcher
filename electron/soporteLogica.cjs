"use strict";

/**
 * Lógica pura del módulo de soporte del launcher (chat de tickets).
 *
 * Sin Electron, sin red y sin disco: se prueba en
 * electron/soporteLogica.test.mjs. El módulo soporte.cjs es quien toca el
 * puente de auth y el IPC usando estas piezas.
 */

/** Tope de capturas por mensaje, por contrato del soporte. */
const MAX_CAPTURAS = 4;

/** Tamaño máximo razonable de una captura ya comprimida antes de subir. */
const MAX_CAPTURA_BYTES = 900 * 1024;

/**
 * Set esencial de "datos del equipo" que el usuario puede ofrecer al abrir
 * el ticket: sólo software (SO, app, idioma, zona horaria) — nada de
 * personas, archivos ni hardware.
 *
 * `sistema` ej: "Windows 10.0.26100"; `aplicacion` ej: "Bling Launcher
 * 1.18.0"; `locale` ej: "es-UY"; `timezone` ej: "America/Montevideo".
 */
function armarDatosEquipo({ sistema, aplicacion, locale, timezone }) {
  return [sistema, aplicacion, locale, timezone]
    .map((dato) => (typeof dato === "string" ? dato.trim() : ""))
    .filter(Boolean)
    .join(" · ");
}

/**
 * Descripción del ticket: el mensaje del usuario, y si aceptó compartir
 * datos del equipo, el bloque al final (el agente lo ve en el chat como
 * parte del primer mensaje).
 */
function descripcionConDatos(mensaje, datosEquipo) {
  const texto = String(mensaje ?? "").trim();
  if (!datosEquipo) return texto;
  return `${texto}\n\n—\nDatos del equipo: ${datosEquipo}`;
}

/**
 * Valida las capturas de un mensaje: hasta MAX_CAPTURAS y sólo imágenes
 * (el backend ya sólo acepta imágenes y devuelve AVIF).
 */
function capturasValidas(capturas) {
  if (!Array.isArray(capturas)) return false;
  if (capturas.length > MAX_CAPTURAS) return false;
  return capturas.every(
    (c) =>
      c &&
      typeof c.url === "string" &&
      c.url.length > 0 &&
      typeof c.type === "string" &&
      c.type.toLowerCase().startsWith("image/"),
  );
}

/**
 * Título visible de un ítem de la lista: el que vino del backend, y si no,
 * las primeras palabras del mensaje con puntos suspensivos.
 */
function tituloCorto(titulo, max = 42) {
  const texto = String(titulo ?? "").trim();
  if (!texto) return "(sin asunto)";
  if (texto.length <= max) return texto;
  const cortada = texto.slice(0, max);
  const espacio = cortada.lastIndexOf(" ");
  return (espacio > 0 ? cortada.slice(0, espacio) : cortada) + "…";
}

module.exports = {
  MAX_CAPTURAS,
  MAX_CAPTURA_BYTES,
  armarDatosEquipo,
  descripcionConDatos,
  capturasValidas,
  tituloCorto,
};
