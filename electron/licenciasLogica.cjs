"use strict";

/**
 * Lógica pura del módulo de licencias del launcher.
 *
 * Sin Electron, sin red y sin disco: se prueba en
 * electron/licensesLogica.test.mjs. El módulo licencias.cjs es quien toca
 * el puente, el bucket R2 y el sistema de archivos usando estas piezas.
 */

/**
 * Plataforma del launcher en la convención del backend
 * ("win-x64" | "win-arm64" | "mac-x64" | "mac-arm64" | "linux-x64" | ...).
 */
function plataformaDe(nodoPlatform, arch) {
  const sufijo = arch === "arm64" ? "arm64" : "x64";
  if (nodoPlatform === "win32") return `win-${sufijo}`;
  if (nodoPlatform === "darwin") return `mac-${sufijo}`;
  return `linux-${sufijo}`;
}

/**
 * La key del producto también nombra una carpeta en disco: sólo se aceptan
 * letras, números y guiones (defensa contra path traversal, aunque la key
 * venga de nuestro propio backend).
 */
function esClaveValida(key) {
  return typeof key === "string" && /^[a-z0-9][a-z0-9-]{0,49}$/i.test(key);
}

/** Último segmento del path de la URL firmada (el nombre real del artefacto). */
function nombreDesdeUrl(url) {
  try {
    const base = new URL(String(url)).pathname.split("/").filter(Boolean).pop();
    return base ? decodeURIComponent(base) : null;
  } catch {
    return null;
  }
}

/**
 * Nombre con el que se guarda el instalador bajado: el del artefacto en R2
 * (sale de la URL firmada); si no, uno armado con lo que informó el backend.
 */
function nombreArchivo(descarga) {
  const desdeUrl = nombreDesdeUrl(descarga.url);
  if (desdeUrl) return desdeUrl;
  return `Bling-${descarga.key}-${descarga.version}.exe`;
}

/**
 * HTTP del backend → el código que entiende el renderer. Así la UI no
 * mapea estados: 401 es "sin sesión", 403 es "tu plan no la incluye".
 */
function codigoDeEstado(estado) {
  if (estado === 401) return "sin-sesion";
  if (estado === 403) return "sin-licencia";
  if (estado === 404) return "sin-version";
  if (estado === 503) return "sin-descargas";
  return "servidor";
}

/** ¿El sha256 calculado en la descarga coincide con el que registró el backend? */
function integridadOk(calculado, esperado) {
  return (
    typeof calculado === "string" &&
    typeof esperado === "string" &&
    calculado.length === 64 &&
    calculado.toLowerCase() === esperado.toLowerCase()
  );
}

/** Manifest de una app descargada: texto crudo → objeto o null (corrupto). */
function parsearManifest(texto) {
  try {
    const m = JSON.parse(String(texto));
    if (!m || typeof m.version !== "string" || typeof m.archivo !== "string") {
      return null;
    }
    return m;
  } catch {
    return null;
  }
}

/**
 * Apps con binario NATIVO (se instalan en la PC, no sólo se embeben en la
 * web): dónde puede haberse instalado NSIS y con qué nombre sale el exe
 * (productName). Se listan las dos carpetas posibles por raíz (el nombre
 * de la carpeta ha variado entre productName y name según la build). Cada
 * app nueva con versión de escritorio agrega su entrada acá.
 */
const APPS_NATIVAS = {
  contable: {
    carpetas: ["Bling Contable", "bling-contable"],
    exe: "Bling Contable.exe",
  },
};

/** Rutas posibles del ejecutable instalado de una app, en orden de prueba. */
function ejecutablesPara(key, raices) {
  const def = APPS_NATIVAS[key];
  if (!def) return [];
  const rutas = [];
  for (const raiz of raices) {
    for (const carpeta of def.carpetas) {
      rutas.push(`${raiz}/${carpeta}/${def.exe}`);
    }
  }
  return rutas;
}

/**
 * Argumento con el que se spawn-ea la app nativa: le dice por dónde pedirle
 * el ticket al launcher (canal local de un solo uso en 127.0.0.1). El
 * nonce no es un secreto de valor: sólo autoriza esa entrega puntual.
 */
function argumentoTicket(puerto, nonce) {
  return `--bling-ticket=${puerto}:${nonce}`;
}

module.exports = {
  plataformaDe,
  esClaveValida,
  nombreDesdeUrl,
  nombreArchivo,
  codigoDeEstado,
  integridadOk,
  parsearManifest,
  ejecutablesPara,
  argumentoTicket,
};
