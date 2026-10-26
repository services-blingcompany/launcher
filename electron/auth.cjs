"use strict";

const { ipcMain, session, BrowserWindow } = require("electron");
const diagnostics = require("./diagnostics.cjs");
const oauthSistema = require("./oauth-sistema.cjs");

/**
 * Cliente OAuth de Google para el login en el navegador del sistema. Es un
 * cliente tipo Desktop/Installed (acepta redirect a http://127.0.0.1). Se puede
 * sobreescribir por variables de entorno sin tocar el cÃ³digo.
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
  "872789804159-kv6bg1e60eh2iqv719dtnutqkh0nvlbk.apps.googleusercontent.com";
const clientGoogleSecret = leerCredencial("BLING_GOOGLE_CLIENT_SECRET");

/**
 * SesiÃ³n de Bling dentro del launcher.
 *
 * CÃ³mo funciona (y por quÃ© asÃ­):
 *  - El renderer vive en file:// y no puede pegarle a bling.uy (CORS), asÃ­ que
 *    el login viaja por IPC.
 *  - Cloudflare le sirve su reto ("Just a momentâ€¦") a cualquier request que no
 *    salga de una pÃ¡gina de verdad: el fetch del proceso principal recibe el
 *    HTML del reto aunque mande las cookies. Por eso existe el PUENTE: una
 *    ventana con bling.uy cargado, fuera de la pantalla del usuario, que hace
 *    los fetch same-origin como los harÃ­a la web.
 *  - El puente usa session.defaultSession, el MISMO jar que las ventanas de
 *    los servicios: entrÃ¡s una vez acÃ¡ y Bling Noticias, Social o Fundadores
 *    ya te conocen.
 *
 * Las credenciales nunca se guardan: viajan al backend y vuelven como cookies
 * httpOnly + el token que la web tambiÃ©n usa en localStorage de bling.uy.
 */

/** Origen real del ecosistema: auth, API y servicios cuelgan de acÃ¡. */
const SITE = "https://bling.uy";

/** Cookies de sesiÃ³n que se limpian al cerrar sesiÃ³n. */
const SESSION_COOKIES = ["access_token", "refresh_token", "auth_session", "auth_role", "csrf_token"];

/** Ventana puente (una sola) y su promesa de "listo" (reto de Cloudflare pasado). */
let puente = null;
let puenteListo = null;

/** Ãšltima sesiÃ³n informada al renderer, para no repetir el mismo aviso. */
let ultimoAviso = null;

/** CuÃ¡ndo fallÃ³ el reto de Cloudflare por Ãºltima vez, para no insistir de mÃ¡s. */
let ultimoFallo = 0;

/** Espera entre un fallo del reto y el prÃ³ximo intento. */
const PAUSA_TRAS_FALLAR = 60 * 1000;

/** CÃ³mo llegar al hub, para avisarle que cambiÃ³ la sesiÃ³n. */
let obtenerHub = () => null;

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/** Ejecuta una expresiÃ³n en el contexto de bling.uy (same-origin). */
async function ejecutar(expresion) {
  if (!puente || puente.isDestroyed()) throw new Error("sin puente");
  return puente.webContents.executeJavaScript(expresion, true);
}

/**
 * Crea (una sola vez) la ventana puente y espera a que el reto de Cloudflare
 * haya pasado. La ventana es real â€”Cloudflare exige renderâ€” pero vive fuera
 * de la pantalla, sin foco y sin entrada en la barra de tareas.
 */
function crearPuente() {
  if (puente && !puente.isDestroyed()) {
    // El puente quedÃ³ abierto pero sin pasar el reto: se vuelve a intentar
    // en vez de responder que no hay sesiÃ³n.
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
  // ni se va a otro origen. Sin esto, cualquier window.open de la pÃ¡gina
  // crearÃ­a una ventana nueva sin control.
  puente.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  puente.webContents.on("will-navigate", (event, url) => {
    if (!String(url).startsWith(SITE)) event.preventDefault();
  });

  puente.on("closed", () => {
    puente = null;
    puenteListo = null;
  });

  // Las fallas del puente son "no me puedo loguear": tienen que quedar en
  // el registro para poder mirarlas despuÃ©s. Sin la consola de la pÃ¡gina:
  // ahÃ­ el que habla es el reto de Cloudflare y su propio ruido.
  diagnostics.attach(puente, "auth", { consola: false });

  puenteListo = prepararPuente();
  return puenteListo;
}

/**
 * Espera a que Cloudflare deje pasar la API, con la pÃ¡gina ya cargada: se
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
      // todavÃ­a no hay documento usable
    }
    await dormir(400);
  }
  return false;
}

/**
 * Deja el puente listo para hablar con la API y cuenta quÃ© pasÃ³.
 *
 * El reto de Cloudflare a veces queda a medias (una conexiÃ³n mala, un intento
 * a medio resolver): recargar la pÃ¡gina suele resolverlo, asÃ­ que se intenta
 * dos veces. Si aun asÃ­ no pasa, el puente queda sin marcar y el prÃ³ximo
 * pedido lo vuelve a intentar, en vez de darlo por roto hasta reiniciar el
 * launcher; entre intentos hay una pausa, para no encadenar esperas de medio
 * minuto cada vez que alguien pide la sesiÃ³n.
 */
async function prepararPuente() {
  if (Date.now() - ultimoFallo < PAUSA_TRAS_FALLAR) return false;

  for (let intento = 1; intento <= 2; intento++) {
    // No se espera a loadURL: mientras carga (y mientras Cloudflare muestra su
    // reto) se sondea la API, que responde al instante con 403 hasta que el
    // reto pasa. AsÃ­ el puente queda listo apenas estÃ¡ listo, sin esperas fijas.
    void puente.loadURL(`${SITE}/auth/login`).catch(() => {});

    if (await esperarReto()) {
      ultimoFallo = 0;
      diagnostics.escribir("info", [
        intento === 1
          ? "el puente de auth quedÃ³ listo"
          : `el puente de auth quedÃ³ listo en el intento ${intento}`,
      ]);
      return true;
    }

    if (intento === 1) {
      diagnostics.escribir("warn", [
        "el puente de auth no pasÃ³ el reto de Cloudflare; se recarga y se reintenta",
      ]);
    }
  }

  diagnostics.escribir("warn", ["el puente de auth no pasÃ³ el reto de Cloudflare"]);
  ultimoFallo = Date.now();
  puenteListo = null;
  return false;
}

/** Asegura el puente y ejecuta la expresiÃ³n adentro. */
async function enPagina(expresion) {
  const listo = await crearPuente();
  if (!listo) throw new Error("cloudflare");
  return ejecutar(expresion);
}

/**
 * Perfil de la sesiÃ³n activa, o null si no hay sesiÃ³n. El token sale del
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

/** Avisa al renderer SÃ“LO cuando la sesiÃ³n cambiÃ³ de verdad. */
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
 * el token queda tambiÃ©n en el localStorage de bling.uy, igual que si el
 * usuario hubiera usado el formulario del sitio: los servicios lo usan.
 */
async function login({ email, password, rememberMe } = {}) {
  if (!email || !password) {
    return { ok: false, error: "CompletÃ¡ tu correo y contraseÃ±a." };
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
    return { ok: false, error: "No pudimos conectar con Bling. RevisÃ¡ tu conexiÃ³n." };
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
        error: "Tu cuenta todavÃ­a no estÃ¡ verificada. Te mandamos un cÃ³digo por correo.",
      };
    }
    if (r.html) {
      return { ok: false, error: "Bling estÃ¡ tardando en responder. ProbÃ¡ de nuevo en un rato." };
    }
  }

  if (r.status === 429) {
    return { ok: false, error: "Demasiados intentos. EsperÃ¡ un momento e intentÃ¡ de nuevo." };
  }

  if (r.status >= 500) {
    return { ok: false, error: "Sistema en mantenimiento. ProbÃ¡ de nuevo en unos minutos." };
  }

  return { ok: false, error: "Correo electrÃ³nico o contraseÃ±a incorrectos." };
}

/** Cierra sesiÃ³n en el backend y borra las cookies del jar compartido. */
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
    // Aunque el backend no conteste, acÃ¡ se limpia igual: si el usuario pidiÃ³
    // salir, la sesiÃ³n local no puede quedar viva.
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
      // no habÃ­a cookie que borrar
    }
  }

  ultimoAviso = "invitado";
  return true;
}

/** Contador de notificaciones sin leer (0 si no hay sesiÃ³n o no se puede). */
async function notificaciones() {
  try {
    const r = await enPagina(`(async () => {
      const token = localStorage.getItem('access_token');
      if (!token) return { count: 0, autenticado: false };

      const cabeceras = { Authorization: 'Bearer ' + token };
      const opciones = { credentials: 'include', cache: 'no-store', headers: cabeceras };

      // Primero el contador del backend; si no estÃ¡, se cuentan las no leÃ­das
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
 * ser null si sÃ³lo quedan ventanas de servicios abiertas).
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
    // Los detalles del fallo (config, OAuth, red) NO se muestran al usuario:
    // pueden filtrar rutas o nombres internos. Se registran en el log y a la
    // UI va un mensaje generico. Nunca se devuelven errores de codigo.
    const generico = () => ({
      ok: false,
      error: "No se pudo iniciar sesion con Google en este momento. Probá de nuevo o usá tu correo y contraseña.",
    });
    if (!clientGoogleSecret) {
      console.warn("[auth:google] falta BLING_GOOGLE_CLIENT_SECRET");
      return generico();
    }
    try {
      const { accessToken } = await oauthSistema.iniciarSesionGoogle({
        clientId: clientGoogleId,
        clientSecret: clientGoogleSecret,
      });
      const resultado = await loginSocial("google", accessToken);
      if (resultado.ok) avisar(getHub);
      return resultado;
    } catch (err) {
      console.warn("[auth:google] error en el flujo de Google:", err && err.message);
      return generico();
    }
  });

  ipcMain.handle("auth:logout", async () => {
    await logout();
    avisar(getHub);
    return true;
  });

  ipcMain.handle("auth:notifications", () => notificaciones());

  // Chequeo de fondo cada 5 minutos: si el token venciÃ³ con la app abierta,
  // la UI se entera sola y vuelve a mostrar "Iniciar sesiÃ³n".
  setInterval(() => {
    if (ultimoAviso && ultimoAviso !== "invitado" && puente && !puente.isDestroyed()) {
      avisar(getHub);
    }
  }, 5 * 60 * 1000).unref?.();

  // Calentar el puente ya: asÃ­ el primer authStatus del renderer responde al
  // toque en vez de esperar el reto de Cloudflare.
  void crearPuente();
}

/**
 * Si hay sesiÃ³n, sin pegarle a la red: es lo Ãºltimo que se le avisÃ³ al hub.
 * null = todavÃ­a no se consultÃ³ el perfil ni una vez.
 *
 * SÃ³lo sÃ­ o no: no expone la cuenta, asÃ­ que puede ir en el diagnÃ³stico que
 * el usuario comparte.
 */
function haySesion() {
  if (ultimoAviso === null) return null;
  return ultimoAviso !== "invitado";
}

/**
 * Revisa la sesiÃ³n ahora mismo y avisa al hub si cambiÃ³ (sÃ³lo si cambiÃ³).
 * La usa el launcher cuando una ventana del auth navega o se cierra: sirve
 * para el login con Google, que termina en una ventana y no en el formulario
 * del hub.
 */
function revisar() {
  avisar(obtenerHub);
}

module.exports = { init, perfil, enPagina, cerrarPuente, haySesion, revisar, SITE };
