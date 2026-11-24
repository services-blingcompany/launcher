"use strict";

const { app, ipcMain, session, BrowserWindow, shell } = require("electron");
const diagnostics = require("./diagnostics.cjs");
const oauthSistema = require("./oauth-sistema.cjs");
const sesionNavegador = require("./sesion-navegador.cjs");

/**
 * Cliente OAuth de Google para el login en el navegador del sistema. Es un
 * cliente tipo Desktop/Installed (acepta redirect a http://127.0.0.1). Se puede
 * sobreescribir por variables de entorno sin tocar el código.
 */
function leerCredencial(nombre) {
  if (process.env[nombre]) return process.env[nombre];
  try {
    return require("./credentials.cjs")[nombre] || "";
  } catch {
    return "";
  }
}

const clientGoogleId =
  leerCredencial("BLING_GOOGLE_CLIENT_ID") ||
  "872789804159-d26i9vaqjebkhqhs52sdaglrsk0o8sv2.apps.googleusercontent.com";
const clientGoogleSecret = leerCredencial("BLING_GOOGLE_CLIENT_SECRET");

/**
 * Sesión de Bling dentro del launcher.
 *
 * Cómo funciona (y por qué así):
 *  - El renderer vive en file:// y no puede pegarle a bling.uy (CORS), así que
 *    el login viaja por IPC.
 *  - Cloudflare le sirve su reto ("Just a moment⬦") a cualquier request que no
 *    salga de una página de verdad: el fetch del proceso principal recibe el
 *    HTML del reto aunque mande las cookies. Por eso existe el PUENTE: una
 *    ventana con bling.uy cargado, fuera de la pantalla del usuario, que hace
 *    los fetch same-origin como los haría la web.
 *  - El puente usa session.defaultSession, el MISMO jar que las ventanas de
 *    los servicios: entrás una vez acá y Bling Noticias, Social o Fundadores
 *    ya te conocen.
 *
 * Las credenciales nunca se guardan: viajan al backend y vuelven como cookies
 * httpOnly + el token que la web también usa en localStorage de bling.uy.
 */

/**
 * Origen del ecosistema: auth, API y servicios cuelgan de acá. Es www y no
 * bling.uy: el backend deja las cookies host-only, y toda la web (dashboard,
 * Contable, auth) busca la sesión en www.bling.uy. Con el puente en bling.uy
 * las ventanas de servicio no veían la sesión del launcher.
 */
const SITE = "https://www.bling.uy";
/** Donde la persona tiene la sesión en su navegador (cookies host-only de www). */
const SITIO_NAVEGADOR = SITE;

/** Cookies de sesión que se limpian al cerrar sesión. */
const SESSION_COOKIES = ["access_token", "refresh_token", "auth_session", "auth_role", "csrf_token"];

/** Ventana puente (una sola) y su promesa de "listo" (reto de Cloudflare pasado). */
let puente = null;
let puenteListo = null;

/** �altima sesión informada al renderer, para no repetir el mismo aviso. */
let ultimoAviso = null;

/** Cuándo falló el reto de Cloudflare por última vez, para no insistir de más. */
let ultimoFallo = 0;

/** Espera entre un fallo del reto y el próximo intento. */
const PAUSA_TRAS_FALLAR = 60 * 1000;

/** Cómo llegar al hub, para avisarle que cambió la sesión. */
let obtenerHub = () => null;

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/** Ejecuta una expresión en el contexto de bling.uy (same-origin). */
async function ejecutar(expresion) {
  if (!puente || puente.isDestroyed()) throw new Error("sin puente");
  return puente.webContents.executeJavaScript(expresion, true);
}

/**
 * Crea (una sola vez) la ventana puente y espera a que el reto de Cloudflare
 * haya pasado. La ventana es real �Cloudflare exige render� pero vive fuera
 * de la pantalla, sin foco y sin entrada en la barra de tareas.
 */
function crearPuente() {
  if (puente && !puente.isDestroyed()) {
    // El puente quedó abierto pero sin pasar el reto: se vuelve a intentar
    // en vez de responder que no hay sesión.
    if (!puenteListo) puenteListo = prepararPuente();
    return puenteListo;
  }

  puente = new BrowserWindow({
    width: 1024,
    height: 768,
    x: -4000,
    y: -3000,
    show: true,
    frame: false,
    skipTaskbar: true,
    focusable: false,
    webPreferences: {
      contextIsolation: true,

      // DevTools sólo en desarrollo: en la app instalada no se puede inspeccionar.

      devTools: !app.isPackaged,
      sandbox: true,
      backgroundThrottling: false,
    },
  });

  // Cloudflare exige render para su reto (por eso la ventana es real), pero
  // vive fuera de pantalla y sin foco para no molestar. La señal de
  // navigator.webdriver se neutraliza en main.cjs (disable-blink-features) para
  // que Cloudflare no la trate como bot.

  // Es una ventana nuestra, cargada con nuestro propio sitio: no abre popups
  // ni se va a otro origen. Sin esto, cualquier window.open de la página
  // crearía una ventana nueva sin control.
  puente.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  puente.webContents.on("will-navigate", (event, url) => {
    if (!String(url).startsWith(SITE)) event.preventDefault();
  });

  puente.on("closed", () => {
    puente = null;
    puenteListo = null;
  });

  // Las fallas del puente son "no me puedo loguear": tienen que quedar en
  // el registro para poder mirarlas después. Sin la consola de la página:
  // ahí el que habla es el reto de Cloudflare y su propio ruido.
  diagnostics.attach(puente, "auth", { consola: false });

  puenteListo = prepararPuente();
  return puenteListo;
}

/**
 * Espera a que Cloudflare deje pasar la API, con la página ya cargada: se
 * sondea la API, que responde 403 mientras el reto siga en pie.
 */
async function esperarReto() {
  for (let i = 0; i < 40; i++) {
    try {
      const estado = await ejecutar(
        "fetch('/api/auth/me', { credentials: 'include' }).then((r) => ((r.headers.get('content-type') || '').includes('json') ? 200 : r.status)).catch(() => 0)",
      );
      if (typeof estado === "number" && estado > 0 && estado !== 403) return true;
    } catch {
      // todavía no hay documento usable
    }
    await dormir(400);
  }
  return false;
}

/**
 * Deja el puente listo para hablar con la API y cuenta qué pasó.
 *
 * El reto de Cloudflare a veces queda a medias (una conexión mala, un intento
 * a medio resolver): recargar la página suele resolverlo, así que se intenta
 * dos veces. Si aun así no pasa, el puente queda sin marcar y el próximo
 * pedido lo vuelve a intentar, en vez de darlo por roto hasta reiniciar el
 * launcher; entre intentos hay una pausa, para no encadenar esperas de medio
 * minuto cada vez que alguien pide la sesión.
 */
async function prepararPuente() {
  if (Date.now() - ultimoFallo < PAUSA_TRAS_FALLAR) return false;

  for (let intento = 1; intento <= 2; intento++) {
    // No se espera a loadURL: mientras carga (y mientras Cloudflare muestra su
    // reto) se sondea la API, que responde al instante con 403 hasta que el
    // reto pasa. Así el puente queda listo apenas está listo, sin esperas fijas.
    void puente.loadURL(`${SITE}/auth/login`).catch(() => {});

    if (await esperarReto()) {
      ultimoFallo = 0;
      diagnostics.escribir("info", [
        intento === 1
          ? "el puente de auth quedó listo"
          : `el puente de auth quedó listo en el intento ${intento}`,
      ]);
      return true;
    }

    if (intento === 1) {
      diagnostics.escribir("warn", [
        "el puente de auth no pasó el reto de Cloudflare; se recarga y se reintenta",
      ]);
    }
  }

  diagnostics.escribir("warn", ["el puente de auth no pasó el reto de Cloudflare"]);
  ultimoFallo = Date.now();
  puenteListo = null;
  return false;
}

/** Asegura el puente y ejecuta la expresión adentro. */
async function enPagina(expresion) {
  const listo = await crearPuente();
  if (!listo) throw new Error("cloudflare");
  return ejecutar(expresion);
}

/**
 * Perfil de la sesión activa, o null si no hay sesión. El token sale del
 * localStorage de bling.uy (como en la web) y las cookies viajan solas.
 */
async function perfil() {
  try {
    const r = await enPagina(`(async () => {
      const token = localStorage.getItem('access_token');
      const cabeceras = token ? { Authorization: 'Bearer ' + token } : {};
      let res = await fetch('/api/auth/me', {
        credentials: 'include', cache: 'no-store', headers: cabeceras,
      });

      // Token vencido: un intento de refresh con la cookie refresh_token.
      if (res.status === 401) {
        try {
          const ref = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
          if (ref.ok) {
            const datos = await ref.json().catch(() => ({}));
            if (datos.access_token) {
              localStorage.setItem('access_token', datos.access_token);
              res = await fetch('/api/auth/me', {
                credentials: 'include', cache: 'no-store',
                headers: { Authorization: 'Bearer ' + datos.access_token },
              });
            }
          }
        } catch {}
      }

      if (!res.ok) return { status: res.status, user: null };
      return { status: res.status, user: await res.json().catch(() => null) };
    })()`);

    return r && r.user ? r.user : null;
  } catch {
    return null;
  }
}

/** Avisa al renderer S�LO cuando la sesión cambió de verdad. */
function avisar(getHub) {
  const hub = getHub && getHub();
  if (!hub || hub.isDestroyed()) return;
  void perfil().then((user) => {
    const clave = user ? String(user.id) : "invitado";
    if (clave === ultimoAviso) return;
    ultimoAviso = clave;
    if (!hub.isDestroyed()) hub.webContents.send("auth:changed", user);
  });
}

/**
 * Login nativo contra /api/auth/login (mismos mensajes que la web). Al entrar,
 * el token queda también en el localStorage de bling.uy, igual que si el
 * usuario hubiera usado el formulario del sitio: los servicios lo usan.
 */
async function login({ email, password, rememberMe } = {}) {
  if (!email || !password) {
    return { ok: false, error: "Completá tu correo y contraseña." };
  }

  const cuerpo = JSON.stringify({ email, password, rememberMe: !!rememberMe });

  let r;
  try {
    r = await enPagina(`(async () => {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: ${JSON.stringify(cuerpo)},
      });

      const tipo = res.headers.get('content-type') || '';
      if (!tipo.includes('json')) return { status: res.status, html: true };

      const datos = await res.json().catch(() => ({}));
      if (res.ok && datos.access_token) {
        localStorage.setItem('access_token', datos.access_token);
        if (datos.user && datos.user.avatar_url) {
          localStorage.setItem('bling_user_avatar', datos.user.avatar_url);
        }
      }

      return {
        status: res.status,
        html: false,
        detalle: typeof datos.detail === 'string' ? datos.detail : null,
        user: datos.user || null,
      };
    })()`);
  } catch {
    return { ok: false, error: "No pudimos conectar con Bling. Revisá tu conexión." };
  }

  if (r.status >= 200 && r.status < 300) {
    const user = r.user || (await perfil());
    ultimoAviso = user ? String(user.id) : "invitado";
    return { ok: true, user };
  }

  // 403 significa dos cosas muy distintas: cuenta sin verificar (el backend lo
  // dice en `detail`) o el reto de Cloudflare (respuesta HTML).
  if (r.status === 403) {
    if (r.detalle && /verific|activ/i.test(r.detalle)) {
      return {
        ok: false,
        necesitaVerificar: true,
        error: "Tu cuenta todavía no está verificada. Te mandamos un código por correo.",
      };
    }
    if (r.html) {
      return { ok: false, error: "Bling está tardando en responder. Probá de nuevo en un rato." };
    }
  }

  if (r.status === 429) {
    return { ok: false, error: "Demasiados intentos. Esperá un momento e intentá de nuevo." };
  }

  if (r.status >= 500) {
    return { ok: false, error: "Sistema en mantenimiento. Probá de nuevo en unos minutos." };
  }

  return { ok: false, error: "Correo electrónico o contraseña incorrectos." };
}

/** Cierra sesión en el backend y borra las cookies del jar compartido. */
async function logout() {
  try {
    await enPagina(`(async () => {
      const token = localStorage.getItem('access_token');
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'include',
          headers: token ? { Authorization: 'Bearer ' + token } : {},
        });
      } catch {}
      localStorage.removeItem('access_token');
      localStorage.removeItem('bling_user_avatar');
      return true;
    })()`);
  } catch {
    // Aunque el backend no conteste, acá se limpia igual: si el usuario pidió
    // salir, la sesión local no puede quedar viva.
  }

  for (const name of SESSION_COOKIES) {
    try {
      const cookies = await session.defaultSession.cookies.get({ name, domain: "bling.uy" });
      for (const c of cookies) {
        const host = c.domain.replace(/^\./, "");
        await session.defaultSession.cookies.remove(
          `${c.secure ? "https" : "http"}://${host}${c.path || "/"}`,
          c.name,
        );
      }
    } catch {
      // no había cookie que borrar
    }
  }

  ultimoAviso = "invitado";
  return true;
}

/**
 * Pedido a la API de Bling desde la página puente, con la sesión del
 * launcher y un refresh si el access venció. `ruta` y `metodo` los arma
 * este módulo (nunca vienen del renderer tal cual). Devuelve
 * { status, datos } o { status: 0 } sin sesión.
 */
function pedirApi(ruta, metodo = "GET") {
  return enPagina(`(async () => {
    let token = localStorage.getItem('access_token');
    if (!token) return { status: 0 };
    const pedir = () => fetch(${JSON.stringify(ruta)}, {
      method: ${JSON.stringify(metodo)},
      credentials: 'include',
      cache: 'no-store',
      headers: { Authorization: 'Bearer ' + token },
    });
    let res = await pedir();
    if (res.status === 401) {
      try {
        const ref = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
        const datos = ref.ok ? await ref.json().catch(() => ({})) : {};
        if (datos.access_token) {
          token = datos.access_token;
          localStorage.setItem('access_token', token);
          res = await pedir();
        }
      } catch {}
    }
    const datos = await res.json().catch(() => null);
    return { status: res.status, datos };
  })()`);
}

/** Sólo lo que el panel muestra, con tipos limpios. */
function limpiarNotificacion(n) {
  if (!n || typeof n !== "object") return null;
  const id = Number(n.id);
  if (!Number.isInteger(id)) return null;
  return {
    id,
    tipo: String(n.type ?? "system"),
    titulo: String(n.title ?? "").slice(0, 255),
    cuerpo: n.body ? String(n.body).slice(0, 1000) : null,
    leida: Boolean(n.is_read ?? n.read),
    fecha: String(n.created_at ?? ""),
  };
}

/** Últimas notificaciones para el panel del launcher. */
async function listaNotificaciones() {
  try {
    const r = await pedirApi("/api/v1/notifications?limit=30");
    if (!r || r.status === 0 || r.status === 401) return { ok: false, codigo: "sin-sesion" };
    if (r.status !== 200) return { ok: false, codigo: "servidor" };
    const lista = Array.isArray(r.datos) ? r.datos : (r.datos && r.datos.notifications) || [];
    return { ok: true, notificaciones: lista.map(limpiarNotificacion).filter(Boolean) };
  } catch {
    return { ok: false, codigo: "red" };
  }
}

/** Marca una notificación (por id) o todas (id null) como leídas. */
async function marcarNotificaciones(id) {
  const n = id === null || id === undefined ? null : Number(id);
  if (n !== null && !Number.isInteger(n)) return false;
  try {
    const ruta = n === null ? "/api/v1/notifications/read-all" : `/api/v1/notifications/${n}/read`;
    const r = await pedirApi(ruta, "POST");
    return Boolean(r && r.status >= 200 && r.status < 300);
  } catch {
    return false;
  }
}

/**
 * Contador de notificaciones sin leer (0 si no hay sesión o no se puede).
 *
 * El access token dura JWT_EXPIRE_MINUTES (60) y esto se consulta cada
 * minuto: ante un 401 se renueva una vez con la cookie refresh_token, igual
 * que perfil(). Sin eso, a la hora de abrir el launcher el contador quedaba
 * en 0 para siempre y no volvía a avisar nada.
 */
async function notificaciones() {
  try {
    const r = await enPagina(`(async () => {
      let token = localStorage.getItem('access_token');
      if (!token) return { count: 0, autenticado: false };

      const pedir = (ruta) => fetch(ruta, {
        credentials: 'include',
        cache: 'no-store',
        headers: { Authorization: 'Bearer ' + token },
      });

      // Token vencido: un solo intento de refresh y se repite el pedido.
      let renovado = false;
      const conRenovacion = async (ruta) => {
        let res = await pedir(ruta);
        if (res.status !== 401 || renovado) return res;
        renovado = true;
        try {
          const ref = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
          if (!ref.ok) return res;
          const datos = await ref.json().catch(() => ({}));
          if (!datos.access_token) return res;
          token = datos.access_token;
          localStorage.setItem('access_token', token);
          return pedir(ruta);
        } catch {
          return res;
        }
      };

      // Primero el contador del backend; si no está, se cuentan las no leídas
      // de la lista (que es como lo hace la propia web).
      try {
        const res = await conRenovacion('/api/v1/notifications/count');
        if (res.status === 401) return { count: 0, autenticado: false };
        if (res.ok) {
          const datos = await res.json().catch(() => null);
          const n = Number(datos && (datos.unread_count ?? datos.count));
          if (Number.isFinite(n)) return { count: n, autenticado: true };
        }
      } catch {}

      try {
        const res = await conRenovacion('/api/v1/notifications?unread_only=true');
        if (res.status === 401) return { count: 0, autenticado: false };
        if (res.ok) {
          const datos = await res.json().catch(() => null);
          const lista = Array.isArray(datos) ? datos : (datos && datos.notifications) || [];
          if (Array.isArray(lista)) {
            // El backend manda is_read (antes se miraba n.read, que no existe).
            return {
              count: lista.filter((n) => n && !(n.is_read ?? n.read)).length,
              autenticado: true,
            };
          }
        }
      } catch {}

      return { count: 0, autenticado: true };
    })()`);

    return r || { count: 0, autenticado: false };
  } catch {
    return { count: 0, autenticado: false };
  }
}

/** Cierra el puente (al cerrar el hub no queremos que quede una ventana viva). */
function cerrarPuente() {
  if (puente && !puente.isDestroyed()) puente.destroy();
  puente = null;
  puenteListo = null;
}

/**
 * Engancha los handlers de auth. `getHub` devuelve la ventana principal (puede
 * ser null si sólo quedan ventanas de servicios abiertas).
 */
async function loginSocial(provider, token) {
  const cuerpo = JSON.stringify({ provider, token, account_type: null });

  let r;
  try {
    r = await enPagina(`(async () => {
      const res = await fetch('/api/auth/social', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: ${JSON.stringify(cuerpo)},
      });

      const tipo = res.headers.get('content-type') || '';
      if (!tipo.includes('json')) return { status: res.status, html: true };

      const datos = await res.json().catch(() => ({}));

      if (datos.requires_linking) {
        return { status: res.status, html: false, requires_linking: true };
      }

      if (res.ok && datos.access_token) {
        localStorage.setItem('access_token', datos.access_token);
        if (datos.user && datos.user.avatar_url) {
          localStorage.setItem('bling_user_avatar', datos.user.avatar_url);
        }
      }

      return {
        status: res.status,
        html: false,
        detalle: typeof datos.detail === 'string' ? datos.detail : null,
        user: datos.user || null,
        has_alias: datos.has_alias,
        account_type: datos.account_type,
        role: datos.role,
      };
    })()`);
  } catch {
    return { ok: false, error: "No pudimos conectar con Bling. Revisa tu conexion." };
  }

  if (r.requires_linking) {
    return {
      ok: false,
      requiereVincular: true,
      error: "Ese correo ya tiene una cuenta con contrasena. Inicia sesion para vincular Google.",
    };
  }

  if (r.status >= 200 && r.status < 300) {
    const user = r.user || (await perfil());
    ultimoAviso = user ? String(user.id) : "invitado";
    return { ok: true, user, has_alias: r.has_alias, account_type: r.account_type, role: r.role };
  }

  if (r.html) {
    return { ok: false, error: "Bling esta tardando en responder. Prueba de nuevo en un rato." };
  }
  return { ok: false, error: r.detalle || "No se pudo iniciar sesion con la red social." };
}

/**
 * Canjea el código de «Entrar con el navegador» por la sesión, desde el puente
 * (www.bling.uy): así las cookies quedan en la sesión del launcher como en un
 * login normal.
 */
async function canjearNavegador(codigo, verifier) {
  const cuerpo = JSON.stringify({ codigo, verifier });
  let r;
  try {
    r = await enPagina(`(async () => {
      const res = await fetch('/api/v1/auth/launcher/canjear', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: ${JSON.stringify(cuerpo)},
      });
      const tipo = res.headers.get('content-type') || '';
      if (!tipo.includes('json')) return { status: res.status, html: true };
      const datos = await res.json().catch(() => ({}));
      if (res.ok && datos.access_token) localStorage.setItem('access_token', datos.access_token);
      return { status: res.status, html: false, detalle: typeof datos.detail === 'string' ? datos.detail : null };
    })()`);
  } catch {
    return { ok: false, error: "No pudimos conectar con Bling. Revisá tu conexión." };
  }
  if (r.status >= 200 && r.status < 300) {
    const user = await perfil();
    ultimoAviso = user ? String(user.id) : "invitado";
    return { ok: true, user };
  }
  if (r.html) return { ok: false, error: "Bling está tardando en responder. Probá de nuevo en un rato." };
  return { ok: false, error: r.detalle || "No se pudo conectar el launcher." };
}

/**
 * Pase de un solo uso (60 s) para abrir el navegador del sistema con la
 * sesión del launcher. null si no hay sesión o el backend no lo da.
 */
async function pedirPase() {
  if (haySesion() !== true) return null;
  try {
    const r = await enPagina(`(async () => {
      const token = localStorage.getItem('access_token');
      if (!token) return null;
      const res = await fetch('/api/v1/auth/launcher/pase', {
        method: 'POST', credentials: 'include', cache: 'no-store',
        headers: { Authorization: 'Bearer ' + token },
      });
      if (!res.ok) return null;
      const datos = await res.json().catch(() => null);
      return datos && typeof datos.codigo === 'string' ? datos.codigo : null;
    })()`);
    return typeof r === "string" ? r : null;
  } catch {
    return null;
  }
}

/** Última vez que se abrió la página del alias (para no abrirla en cada pedido). */
let ultimoAvisoAlias = 0;
const PAUSA_AVISO_ALIAS = 10 * 60 * 1000;

/**
 * La cuenta no tiene alias y el backend no deja hacer nada más: se abre el
 * navegador, ya con la sesión (pase), en la página para elegirlo.
 */
async function abrirElegirAlias() {
  if (Date.now() - ultimoAvisoAlias < PAUSA_AVISO_ALIAS) return;
  ultimoAvisoAlias = Date.now();
  const paseNavegador = require("./paseNavegador.cjs");
  const codigo = await pedirPase();
  const url =
    (codigo && paseNavegador.urlEntrar(SITE, codigo, paseNavegador.DESTINO_ALIAS)) ||
    `${SITE}${paseNavegador.DESTINO_ALIAS}`;
  await shell.openExternal(url).catch(() => {});
}

function init({ getHub }) {
  obtenerHub = typeof getHub === "function" ? getHub : () => null;

  ipcMain.handle("auth:status", async () => {
    const user = await perfil();
    ultimoAviso = user ? String(user.id) : "invitado";
    return user;
  });

  ipcMain.handle("auth:login", async (_event, credenciales) => {
    const resultado = await login(credenciales);
    if (resultado.ok) avisar(getHub);
    return resultado;
  });

  // Login con Google en el navegador del sistema: abre Google afuera, recibe el
  // token por redirect local y lo cambia por la sesion de Bling.
  ipcMain.handle("auth:google-sistema", async () => {
    // Los detalles del fallo (config, OAuth, red) NO se muestran al usuario.
    // Cada motivo tiene un mensaje seguro y distinto, sin nombres internos.
    const mensajeDe = (err) => {
      const m = String((err && err.message) || err || "");
      if (/navegador/i.test(m)) return "No pudimos abrir tu navegador. Probá de nuevo.";
      if (/tiempo agotado/i.test(m)) return "La conexión con Google tardó demasiado. Probá de nuevo.";
      if (/state|verificaci/i.test(m)) return "No se pudo conectar con Google de forma segura. Probá de nuevo.";
      return "No pudimos iniciar sesión con Google en este momento. Probá de nuevo en unos minutos o usá tu correo y contraseña.";
    };
    if (!clientGoogleSecret) {
      diagnostics.escribir("error", ["[auth:google] falta BLING_GOOGLE_CLIENT_SECRET"]);
      return { ok: false, error: mensajeDe() };
    }
    try {
      const { accessToken } = await oauthSistema.iniciarSesionGoogle({
        clientId: clientGoogleId,
        clientSecret: clientGoogleSecret,
      });
      const resultado = await loginSocial("google", accessToken);
      if (resultado.ok) {
        avisar(getHub);
        // La UI se actualiza con el usuario que ya devolvió el backend, sin
        // depender de volver a consultar el perfil (que puede fallar si
        // Cloudflare molesta). Así el botón cambia a penas se entra.
        const hub = getHub && getHub();
        if (hub && !hub.isDestroyed()) {
          hub.webContents.send("auth:changed", resultado.user ?? null);
        }
      }
      return resultado;
    } catch (err) {
      diagnostics.escribir("error", [
        "[auth:google] fallo el flujo de Google:",
        (err && err.message) || String(err),
      ]);
      return { ok: false, error: mensajeDe(err) };
    }
  });

  // «Entrar con el navegador»: usa la sesión de Bling ya abierta en el
  // navegador del sistema (sin contraseña). Ver sesion-navegador.cjs.
  ipcMain.handle("auth:navegador", async () => {
    try {
      // www.bling.uy y no SITE (bling.uy): la sesión del navegador vive en las
      // cookies de www, y bling.uy no redirige, así que ahí se vería sin sesión.
      const { codigo, verifier } = await sesionNavegador.esperarCodigoDelNavegador({ sitio: SITIO_NAVEGADOR });
      const resultado = await canjearNavegador(codigo, verifier);
      if (resultado.ok) {
        avisar(getHub);
        const hub = getHub && getHub();
        if (hub && !hub.isDestroyed()) hub.webContents.send("auth:changed", resultado.user ?? null);
      }
      return resultado;
    } catch (err) {
      const m = String((err && err.message) || err || "");
      diagnostics.escribir("error", ["[auth:navegador]", m]);
      if (/cancelado/.test(m)) return { ok: false, error: "Cancelaste la conexión en el navegador." };
      if (/navegador/i.test(m)) return { ok: false, error: "No pudimos abrir tu navegador. Probá de nuevo." };
      if (/tiempo agotado/.test(m)) return { ok: false, error: "Pasó demasiado tiempo. Probá de nuevo." };
      return { ok: false, error: "No se pudo conectar el launcher de forma segura. Probá de nuevo." };
    }
  });

  ipcMain.handle("auth:logout", async () => {
    await logout();
    avisar(getHub);
    return true;
  });

  ipcMain.handle("auth:notifications", () => notificaciones());
  ipcMain.handle("auth:notifications-list", () => listaNotificaciones());
  ipcMain.handle("auth:notifications-read", (_event, id) => marcarNotificaciones(id));

  // Chequeo de fondo cada 5 minutos: si el token venció con la app abierta,
  // la UI se entera sola y vuelve a mostrar "Iniciar sesión".
  setInterval(() => {
    if (ultimoAviso && ultimoAviso !== "invitado" && puente && !puente.isDestroyed()) {
      avisar(getHub);
    }
  }, 5 * 60 * 1000).unref?.();

  // Calentar el puente ya: así el primer authStatus del renderer responde al
  // toque en vez de esperar el reto de Cloudflare.
  void crearPuente();
}

/**
 * Si hay sesión, sin pegarle a la red: es lo último que se le avisó al hub.
 * null = todavía no se consultó el perfil ni una vez.
 *
 * Sólo sí o no: no expone la cuenta, así que puede ir en el diagnóstico que
 * el usuario comparte.
 */
function haySesion() {
  if (ultimoAviso === null) return null;
  return ultimoAviso !== "invitado";
}

/**
 * Revisa la sesión ahora mismo y avisa al hub si cambió (sólo si cambió).
 * La usa el launcher cuando una ventana del auth navega o se cierra: sirve
 * para el login con Google, que termina en una ventana y no en el formulario
 * del hub.
 */
function revisar() {
  avisar(obtenerHub);
}

module.exports = { init, perfil, enPagina, cerrarPuente, haySesion, revisar, pedirPase, abrirElegirAlias, SITE };
