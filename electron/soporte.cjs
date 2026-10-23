"use strict";

const { app, ipcMain } = require("electron");
const os = require("node:os");
const auth = require("./auth.cjs");
const logica = require("./soporteLogica.cjs");

/**
 * Soporte: chat de tickets dentro del launcher.
 *
 * El launcher no tiene sesión propia: todo habla con el backend por la
 * ventana puente de bling.uy (same-origin, con el reto de Cloudflare que ya
 * resuelve auth.cjs) — mismo patrón que licencias.cjs.
 *
 * El flujo es el del backend existente (no hay endpoints propios):
 * - lista: GET /api/v1/tickets (el estado se deriva del chat).
 * - abrir: POST /api/v1/tickets con type "support" + el primer mensaje
 *   (+ hasta 4 capturas ya subidas); el título lo deriva el backend.
 * - conversación: GET/POST de los mensajes del chat asociado.
 * - cerrar/reabrir: PATCH del chat / POST reopen (mismo espejo que la web).
 * - capturas: POST /api/v1/messages/upload, que ya las convierte a AVIF.
 *
 * Todo con el set esencial de "datos del equipo" sólo si el usuario lo
 * ofrece al abrir el ticket (ver soporteLogica.cjs).
 */

/** Traduce el status del backend al código que entiende la UI. */
function codigoDe(status) {
  if (status === 401) return "sin-sesion";
  if (status === 403) return "sin-licencia";
  if (status === 429) return "tope";
  if (status === 0) return "sin-conexion";
  if (status >= 500) return "servidor";
  return "error";
}

function fallo(status, datos) {
  // El backend manda mensajes en español rioplatense: se muestran tal cual
  // cuando existen (ej. el tope de 5 tickets abiertos).
  return { ok: false, codigo: codigoDe(status), detalle: (datos && datos.detail) || null };
}

/**
 * Fetch al backend desde adentro del puente. Devuelve { status, datos } o
 * tira si el puente no está (sin sesión / sin reto). Con `cuerpo` hace
 * POST/PATCH JSON.
 */
async function pedir(ruta, metodo = "GET", cuerpo) {
  const r = await auth.enPagina(`(async () => {
    const token = localStorage.getItem('access_token');
    const res = await fetch(${JSON.stringify(ruta)}, {
      method: ${JSON.stringify(metodo)},
      credentials: 'include', cache: 'no-store',
      headers: {
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        ${cuerpo ? "'Content-Type': 'application/json'," : ""}
      },${cuerpo ? `\n      body: ${JSON.stringify(JSON.stringify(cuerpo))},` : ""}
    });
    return { status: res.status, datos: await res.json().catch(() => null) };
  })()`);
  return r || { status: 0, datos: null };
}

/** Tickets del usuario, del más nuevo al más viejo. */
async function lista() {
  try {
    const r = await pedir("/api/v1/tickets");
    if (r.status !== 200) return fallo(r.status, r.datos);
    return { ok: true, tickets: (r.datos && r.datos.tickets) || [] };
  } catch {
    return fallo(0, null);
  }
}

/**
 * Conversación de un ticket. Viene DESC (más nuevo primero), igual que la
 * web: la UI la da vuelta para renderizar en orden cronológico.
 */
async function mensajes(chatId) {
  const id = Number(chatId);
  if (!Number.isInteger(id) || id <= 0) return fallo(404, null);
  try {
    const r = await pedir(`/api/v1/messages/chats/${id}/messages`);
    if (r.status !== 200) return fallo(r.status, r.datos);
    return { ok: true, mensajes: (r.datos && r.datos.messages) || [] };
  } catch {
    return fallo(0, null);
  }
}

/** Abre el ticket con el primer mensaje (+ capturas si las hay). */
async function nuevo(payload) {
  const mensaje = String((payload && payload.mensaje) || "").trim();
  const capturas = (payload && payload.capturas) || [];
  if (!logica.capturasValidas(capturas)) return { ok: false, codigo: "capturas", detalle: null };
  try {
    const r = await pedir("/api/v1/tickets", "POST", {
      type: "support",
      // El título lo deriva el backend del propio mensaje.
      description: logica.descripcionConDatos(mensaje, payload && payload.datosEquipo),
      ...(capturas.length ? { attachments: capturas } : {}),
    });
    if (r.status !== 201) return fallo(r.status, r.datos);
    return { ok: true, ticket: r.datos };
  } catch {
    return fallo(0, null);
  }
}

/** Responde en la conversación de un ticket. */
async function responder(payload) {
  const chatId = Number(payload && payload.chatId);
  const contenido = String((payload && payload.contenido) || "").trim();
  const capturas = (payload && payload.capturas) || [];
  if (!Number.isInteger(chatId) || chatId <= 0) return fallo(404, null);
  if (!logica.capturasValidas(capturas)) return { ok: false, codigo: "capturas", detalle: null };
  try {
    const r = await pedir(`/api/v1/messages/chats/${chatId}/messages`, "POST", {
      chat_id: chatId,
      content: contenido,
      ...(capturas.length ? { attachments: capturas } : {}),
    });
    if (r.status !== 200 && r.status !== 201) return fallo(r.status, r.datos);
    return { ok: true, mensaje: r.datos };
  } catch {
    return fallo(0, null);
  }
}

/** Cierra el ticket (el estado se deriva del chat). */
async function cerrar(chatId) {
  const id = Number(chatId);
  if (!Number.isInteger(id) || id <= 0) return fallo(404, null);
  try {
    const r = await pedir(`/api/v1/messages/chats/${id}`, "PATCH", { status: "closed" });
    if (r.status !== 200) return fallo(r.status, r.datos);
    return { ok: true };
  } catch {
    return fallo(0, null);
  }
}

/** Reabre un ticket cerrado (el backend sólo lo permite en chats de soporte). */
async function reabrir(chatId) {
  const id = Number(chatId);
  if (!Number.isInteger(id) || id <= 0) return fallo(404, null);
  try {
    const r = await pedir(`/api/v1/messages/chats/${id}/reopen`, "POST");
    if (r.status !== 200 && r.status !== 201) return fallo(r.status, r.datos);
    return { ok: true };
  } catch {
    return fallo(0, null);
  }
}

/**
 * Sube UNA captura al backend (que la convierte a AVIF). Los bytes vienen
 * del renderer ya comprimidos en base64: el JSON por evaluateJavaScript
 * queda chico y el archivo sólo viaja una vez.
 */
async function subirCaptura({ nombre, tipo, base64 }) {
  if (!base64) return { ok: false, codigo: "capturas", detalle: null };
  try {
    const r = await auth.enPagina(`(async () => {
      const token = localStorage.getItem('access_token');
      const binario = atob(${JSON.stringify(String(base64))});
      const bytes = new Uint8Array(binario.length);
      for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
      const form = new FormData();
      form.append(
        'files',
        new Blob([bytes], { type: ${JSON.stringify(String(tipo || "image/png"))} }),
        ${JSON.stringify(String(nombre || "captura.png"))},
      );
      const res = await fetch('/api/v1/messages/upload', {
        method: 'POST', credentials: 'include',
        headers: token ? { Authorization: 'Bearer ' + token } : {},
        body: form,
      });
      return { status: res.status, datos: await res.json().catch(() => null) };
    })()`);
    if (!r || r.status !== 200) return fallo((r && r.status) || 0, r && r.datos);
    const adjunto = r.datos && r.datos.files && r.datos.files[0];
    if (!adjunto) return { ok: false, codigo: "error", detalle: null };
    return { ok: true, adjunto };
  } catch {
    return fallo(0, null);
  }
}

/**
 * Set esencial de datos del equipo (sólo software, nada personal) para el
 * bloque que el usuario puede ofrecir al abrir el ticket.
 */
/**
 * Trae una captura desde el backend como data URL. Los archivos viven en
 * /uploads detrás del mismo reto de Cloudflare: se bajan por la ventana
 * puente (same-origin, con cookies) y el renderer sólo ve el data URL, ya
 * que un <img src="/uploads/..."> no mandaría las cookies desde el renderer.
 */
async function imagen(url) {
  const ruta = String(url || "");
  if (!ruta.startsWith("/uploads/")) return fallo(404, null);
  try {
    const r = await auth.enPagina(`(async () => {
      const res = await fetch(${JSON.stringify(ruta)}, { credentials: 'include', cache: 'force-cache' });
      if (!res.ok) return { status: res.status };
      const buf = new Uint8Array(await res.arrayBuffer());
      let binario = '';
      for (let i = 0; i < buf.length; i += 0x8000) {
        binario += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      }
      return {
        status: res.status,
        tipo: (res.headers.get('content-type') || 'image/avif').split(';')[0],
        base64: btoa(binario),
      };
    })()`);
    if (!r || r.status !== 200 || !r.base64) return fallo((r && r.status) || 0, null);
    return { ok: true, dataUrl: `data:${r.tipo};base64,${r.base64}` };
  } catch {
    return fallo(0, null);
  }
}

function datosEquipo() {
  let sistema = `${os.type()} ${os.release()}`;
  if (process.platform === "win32") {
    sistema = `Windows ${process.getSystemVersion()}`;
  } else if (process.platform === "darwin") {
    sistema = `macOS ${process.getSystemVersion()}`;
  }
  let locale = "";
  try {
    locale = app.getLocale();
  } catch {
    // Sin locale, el bloque sale igual con lo demás.
  }
  let timezone = "";
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    // Sin zona horaria, idem.
  }
  return logica.armarDatosEquipo({
    sistema,
    aplicacion: `Bling Launcher ${app.getVersion()}`,
    locale,
    timezone,
  });
}

/** Registra el IPC del módulo (el renderer sólo llega hasta acá). */
function init() {
  ipcMain.handle("soporte:lista", () => lista());
  ipcMain.handle("soporte:mensajes", (_event, chatId) => mensajes(chatId));
  ipcMain.handle("soporte:nuevo", (_event, payload) => nuevo(payload || {}));
  ipcMain.handle("soporte:responder", (_event, payload) => responder(payload || {}));
  ipcMain.handle("soporte:cerrar", (_event, chatId) => cerrar(chatId));
  ipcMain.handle("soporte:reabrir", (_event, chatId) => reabrir(chatId));
  ipcMain.handle("soporte:subir", (_event, payload) => subirCaptura(payload || {}));
  ipcMain.handle("soporte:imagen", (_event, url) => imagen(url));
  ipcMain.handle("soporte:datos-equipo", () => datosEquipo());
}

module.exports = { init, datosEquipo };
