"use strict";

/**
 * «Abrir en el navegador con la sesión del launcher» (lógica pura).
 *
 * El navegador del sistema no comparte cookies con el launcher. Para que la
 * persona no tenga que volver a entrar, el launcher pide al backend un pase de
 * un solo uso (60 s) y abre www.bling.uy/auth/launcher/entrar?codigo&destino.
 * Ahí la web muestra de quién es la cuenta, la persona confirma y sigue al
 * destino. El destino lo vuelve a validar la web con su allowlist.
 */

/** Hosts del sitio principal: el destino viaja como ruta relativa. */
const HOSTS_SITIO = new Set(["bling.uy", "www.bling.uy"]);

/** Apps con dominio propio que el login de auth acepta como destino absoluto. */
const HOSTS_APPS = new Set(["dashboard.bling.uy", "contable.bling.uy", "jobs.bling.uy"]);

/**
 * Destino para la página de auth, o null si la URL no es de Bling (en ese
 * caso no se pide pase: no hay sesión que pasar).
 */
function destinoDelPase(valor) {
  let url;
  try {
    url = new URL(String(valor));
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
  if (HOSTS_SITIO.has(url.hostname)) {
    // Las páginas de auth no necesitan pase (y /auth/launcher daría vueltas).
    if (url.pathname === "/auth" || url.pathname.startsWith("/auth/")) return null;
    return url.pathname + url.search + url.hash;
  }
  if (HOSTS_APPS.has(url.hostname)) return url.origin + url.pathname + url.search + url.hash;
  return null;
}

/** Código como lo emite el backend (token_urlsafe). */
const CODIGO = /^[A-Za-z0-9_-]{20,100}$/;

/** URL de la página de auth que canjea el pase, o null si el código no sirve. */
function urlEntrar(sitio, codigo, destino) {
  if (!CODIGO.test(String(codigo || ""))) return null;
  const q = new URLSearchParams({ codigo });
  if (destino) q.set("destino", destino);
  return `${sitio}/auth/launcher/entrar?${q.toString()}`;
}

module.exports = { destinoDelPase, urlEntrar };
