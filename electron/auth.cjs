"use strict";

const { ipcMain, session, BrowserWindow } = require("electron");
const diagnostics = require("./diagnostics.cjs");
const oauthSistema = require("./oauth-sistema.cjs");

/**
 * Cliente OAuth de Google para el login en el navegador del sistema. Es un
 * cliente tipo Desktop/Installed (acepta redirect a http://127.0.0.1). Se puede
 * sobreescribir por variables de entorno sin tocar el código.
 */
const GOOGLE_CLIENT_ID =
  process.env.BLING_GOOGLE_CLIENT_ID ||
  "872789804159-kv6bg1e60eh2iqv719dtnutqkh0nvlbk.apps.googleusercontent.com";

function leerClientSecret() {
  if (process.env.BLING_GOOGLE_CLIENT_SECRET) return process.env.BLING_GOOGLE_CLIENT_SECRET;
  try {
    const creds = require("./credentials.cjs");
    return creds.GOOGLE_CLIENT_SECRET || "";
  } catch {
    return "";
  }
}
const GOOGLE_CLIENT_SECRET = leerClientSecret();

/**
 * Sesión de Bling dentro del launcher.
 *
 * Cómo funciona (y por qué así):
 *  - El renderer vive en file:// y no puede pegarle a bling.uy (CORS), así que
 *    el login viaja por IPC.
 *  - Cloudflare le sirve su reto ("Just a moment…") a cualquier request que no
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

/** Origen real del ecosistema: auth, API y servicios cuelgan de acá. */
const SITE = "https://bling.uy";

/** Cookies de sesión que se limpian al cerrar sesión. */
const SESSION_COOKIES = ["access_token", "refresh_token", "auth_session", "auth_role", "csrf_token"];

/** Ventana puente (una sola) y su promesa de "listo" (reto de Cloudflare pasado). */
let puente = null;
let puenteListo = null;

/** Última sesión informada al renderer, para no repetir el mismo aviso. */
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
 * haya pasado. La ventana es real —Cloudflare exige render— pero vive fuera
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
      sandbox: true,
      backgroundThrottling: false,
    },
  });

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
        "fetch('/api/auth/me', { credentials: 'include' }).then((r) => r.status).catch(() => 0)",
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

/** Avisa al renderer SÓLO cuando la sesión cambió de verdad. */
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

/** Contador de notificaciones sin leer (0 si no hay sesión o no se puede). */
async function notificaciones() {
  try {
    const r = await enPagina(`(async () => {
      const token = localStorage.getItem('access_token');
      if (!token) return { count: 0, autenticado: false };

      const cabeceras = { Authorization: 'Bearer ' + token };
      const opciones = { credentials: 'include', cache: 'no-store', headers: cabeceras };

      // Primero el contador del backend; si no está, se cuentan las no leídas
      // de la lista (que es como lo hace la propia web).
      try {
        const res = await fetch('/api/v1/notifications/count', opciones);
        if (res.status === 401) return { count: 0, autenticado: false };
        if (res.ok) {
          const datos = await res.json().catch(() => null);
          const n = Number(datos && (datos.unread_count ?? datos.count));
          if (Number.isFinite(n)) return { count: n, autenticado: true };
        }
      } catch {}

      try {
        const res = await fetch('/api/v1/notifications', opciones);
        if (res.status === 401) return { count: 0, autenticado: false };
        if (res.ok) {
          const datos = await res.json().catch(() => null);
          const lista = Array.isArray(datos) ? datos : (datos && datos.notifications) || [];
          if (Array.isArray(lista)) {
            return { count: lista.filter((n) => n && !n.read).length, autenticado: true };
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
    try {
      const { accessToken } = await oauthSistema.iniciarSesionGoogle({
        clientId: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
      });
      const resultado = await loginSocial("google", accessToken);
      if (resultado.ok) avisar(getHub);
      return resultado;
    } catch (err) {
      return { ok: false, error: err.message || "No se pudo iniciar sesion con Google." };
    }
  });

  ipcMain.handle("auth:logout", async () => {
    await logout();
    avisar(getHub);
    return true;
  });

  ipcMain.handle("auth:notifications", () => notificaciones());

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

module.exports = { init, perfil, enPagina, cerrarPuente, haySesion, revisar, SITE };
