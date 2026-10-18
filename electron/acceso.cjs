"use strict";

/**
 * Hosts de inicio de sesión de terceros que el launcher trata distinto.
 *
 * Google devuelve el token a la página que abrió el popup (window.opener), así
 * que su ventana se abre dentro del launcher y no en el navegador del sistema.
 * A cambio, esa ventana es una página ajena: no lleva preload, no abre otras
 * ventanas y —esto es lo que se resuelve acá— no puede pedir ningún permiso
 * (notificaciones, cámara, micrófono, pantalla completa). No los necesita para
 * nada y el launcher no tiene por qué dárselos.
 *
 * Es lógica pura (entra una URL, sale sí o no): se prueba en
 * electron/acceso.test.mjs.
 */

/** Hosts exactos de inicio de sesión de terceros. */
const HOSTS_ACCESO = new Set(["accounts.google.com"]);

/**
 * ¿Es una URL de esos hosts? Sólo https y comparando el host exacto: nada de
 * subdominios parecidos (`accounts.google.com.malo.com`) ni de http.
 */
function esHostDeAcceso(destino) {
  try {
    const url = new URL(String(destino));
    return url.protocol === "https:" && HOSTS_ACCESO.has(url.hostname);
  } catch {
    return false;
  }
}

module.exports = { HOSTS_ACCESO, esHostDeAcceso };
