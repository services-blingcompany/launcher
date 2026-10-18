"use strict";

/**
 * Limpieza de datos personales antes de escribir en el registro o en el
 * reporte de diagnóstico.
 *
 * El reporte se comparte tal cual (se pega en un correo o en un issue), así
 * que lo que sale de la app no debe llevar:
 *
 *  - el nombre de usuario del equipo (aparece en cada ruta absoluta),
 *  - credenciales de un solo uso que viajan en una dirección (el `?code=` del
 *    retorno de Google, un `#access_token=`, un enlace firmado).
 *
 * Son funciones puras y sin dependencias para poder probarlas sin Electron.
 */

/** Escapa lo que tenga significado especial en una expresión regular. */
function escapar(texto) {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Cambia la carpeta del usuario por "~": se sigue viendo dónde estaba
 * (`~\AppData\Roaming\bling-launcher`) sin publicar con qué nombre se entra
 * a la máquina. Cubre las dos barras porque el registro mezcla rutas de
 * Windows con rutas normalizadas.
 */
function limpiarRuta(texto, raiz) {
  if (typeof texto !== "string" || !raiz || !texto) return texto;
  let salida = texto;
  for (const variante of new Set([raiz, raiz.replace(/\\/g, "/")])) {
    if (!variante) continue;
    // Sólo cuando sigue una barra o termina ahí: si no, una carpeta hermana
    // cuyo nombre empieza igual ("…\Bling Company Otra") quedaría mordida.
    const patron = new RegExp(`${escapar(variante)}(?=[\\\\/]|$)`, "gi");
    salida = salida.replace(patron, "~");
  }
  return salida;
}

/**
 * Deja una dirección sin su consulta ni su fragmento, que es donde viajan los
 * códigos y los tokens. Si no es una URL se corta a mano, sin tocar textos que
 * no lo sean (un mensaje con un signo de pregunta no es una dirección).
 */
function limpiarUrl(url) {
  if (typeof url !== "string" || !url) return url;
  try {
    const parsed = new URL(url);
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    // No es una URL válida: sólo se corta si trae consulta o fragmento.
    const corte = url.search(/[?#]/);
    return corte === -1 ? url : url.slice(0, corte);
  }
}

module.exports = { limpiarRuta, limpiarUrl };
