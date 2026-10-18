"use strict";

const { app, BrowserWindow, ipcMain, shell, Menu, screen, session } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const updates = require("./updateCheck.cjs");
const recents = require("./recents.cjs");
const settings = require("./settings.cjs");
const tray = require("./tray.cjs");
const auth = require("./auth.cjs");
const contextMenu = require("./contextMenu.cjs");
const diagnostics = require("./diagnostics.cjs");
const notificaciones = require("./notificaciones.cjs");
const ventanaServicio = require("./ventanaServicio.cjs");

/**
 * Identidad de la app en Windows: tiene que ser el mismo appId que arma el
 * instalador (package.json → build.appId). De eso dependen el agrupado en
 * la barra de tareas, la jump list y las notificaciones nativas.
 */
app.setAppUserModelId("uy.blingcompany.launcher");

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

/** Ventana principal (el hub). */
let launcherWindow = null;

/**
 * true mientras el usuario pidió salir de verdad (bandeja → Salir, o
 * "before-quit"). Se usa para distinguirlo de cerrar la ventana, que si
 * el ajuste lo dice va a la bandeja en vez de matar la app.
 */
let isQuitting = false;

/**
 * Catálogo de servicios que el renderer manda por IPC, sólo para el
 * submenú de la bandeja. El proceso principal nunca parsea el TS del
 * renderer: recibe {id, name} y nada más.
 */
let catalogoServicios = [];

/**
 * Seguridad: desde el renderer sólo se puede abrir lo que está en esta
 * lista. Un XSS en cualquier servicio nunca podrá ejecutar código local
 * ni abrir dominios ajenos a Bling.
 */
const ALLOWED_HOSTS = new Set(["bling.uy", "www.bling.uy"]);

function isAllowedUrl(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === "https:" && ALLOWED_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

function openExternalAllowed(url) {
  if (isAllowedUrl(url)) return shell.openExternal(url);
  return Promise.resolve();
}

/**
 * Los links de actualización apuntan a GitHub (release y asset .exe).
 * Allowlist aparte, más restrictiva: sólo https de los hosts de GitHub.
 */
const UPDATE_HOSTS = new Set([
  "github.com",
  "objects.githubusercontent.com",
  "release-assets.githubusercontent.com",
  "api.github.com",
]);

function openUpdateLink(url) {
  try {
    const parsed = new URL(String(url));
    if (parsed.protocol !== "https:" || !UPDATE_HOSTS.has(parsed.hostname)) {
      return Promise.resolve();
    }
    return shell.openExternal(parsed.toString());
  } catch {
    return Promise.resolve();
  }
}

function windowStatePath() {
  return path.join(app.getPath("userData"), "window-state.json");
}

/**
 * Recuerda tamaño/posición/maximizado entre sesiones. Se valida que la
 * ventana caiga en una pantalla conectada: si el usuario desconectó un
 * monitor, no arranca fuera de pantalla.
 */
function loadWindowState() {
  try {
    const raw = JSON.parse(fs.readFileSync(windowStatePath(), "utf8"));
    if (
      typeof raw?.x !== "number" ||
      typeof raw?.y !== "number" ||
      typeof raw?.width !== "number" ||
      typeof raw?.height !== "number"
    ) {
      return null;
    }
    return raw;
  } catch {
    return null; // primera vez, o estado corrupto
  }
}

function boundsAreVisible(bounds) {
  return screen.getAllDisplays().some((display) => {
    const a = display.workArea;
    return (
      bounds.x + bounds.width > a.x &&
      bounds.x < a.x + a.width &&
      bounds.y + bounds.height > a.y &&
      bounds.y < a.y + a.height
    );
  });
}

function saveWindowState(win) {
  if (!win || win.isDestroyed() || win.isMinimized()) return;
  try {
    const maximized = win.isMaximized();
    // getNormalBounds da el tamaño "real" incluso estando maximizada.
    const bounds = maximized ? win.getNormalBounds() : win.getBounds();
    fs.mkdirSync(app.getPath("userData"), { recursive: true });
    fs.writeFileSync(
      windowStatePath(),
      JSON.stringify({ ...bounds, maximized }, null, 2),
    );
  } catch (err) {
    console.warn("[window] no se pudo guardar el estado:", err.message);
  }
}

/** Nivel de zoom guardado (Chromium: 1.2^nivel, 0 = 100 %). */
function zoomGuardado() {
  return settings.load().zoom;
}

/**
 * Aplica el zoom de la interfaz. Se acota a ±3 niveles (~57 % … ~173 %),
 * que es lo que tiene sentido en una UI de escritorio. En las ventanas de
 * servicio el zoom va a la página embebida: la barra queda siempre igual.
 */
function aplicarZoom(nivel, { persistir = true } = {}) {
  const acotado = Math.min(4, Math.max(-3, Math.round(nivel * 2) / 2));
  if (persistir) settings.set("zoom", acotado);
  if (launcherWindow && !launcherWindow.isDestroyed()) {
    launcherWindow.webContents.setZoomLevel(acotado);
  }
  ventanaServicio.setZoom(acotado);
  // El panel de ajustes muestra el valor, así que se le avisa.
  avisarAjustes(settings.load());
}

/**
 * Ctrl + / Ctrl − / Ctrl 0 sobre la página de un servicio. Son páginas
 * ajenas (no hay renderer nuestro al que pedirle el atajo) y Electron no
 * trae aceleradores de zoom con el menú apagado, así que se atienden a mano.
 */
function attachZoom(wc) {
  wc.on("before-input-event", (evento, entrada) => {
    if (!entrada.control || entrada.type !== "keyDown") return;
    const paso = { "+": 0.5, "=": 0.5, "-": -0.5 }[entrada.key];
    if (entrada.key === "0") aplicarZoom(0);
    else if (paso !== undefined) aplicarZoom(zoomGuardado() + paso);
    else return;
    evento.preventDefault();
  });
}

/** Manda los ajustes al hub (el zoom cambia desde el teclado, no del panel). */
function avisarAjustes(ajustes) {
  if (launcherWindow && !launcherWindow.isDestroyed()) {
    launcherWindow.webContents.send("bling:settings", ajustes);
  }
}

/** Id de servicio pedido desde afuera (`--abrir=news`) y todavía sin abrir. */
let servicioPendiente = null;

function servicioDeArgumentos(argv) {
  const arg = (argv || []).find(
    (a) => typeof a === "string" && a.startsWith("--abrir="),
  );
  return arg ? arg.slice("--abrir=".length) : null;
}

/**
 * Tareas de la jump list (clic derecho en el icono de la barra de tareas):
 * los servicios del catálogo, con el mismo `--abrir=` que el arranque. Sólo
 * en la app instalada: en dev el ejecutable es el de Electron y la tarea
 * abriría cualquier cosa.
 */
function actualizarTareas() {
  if (!app.isPackaged) return;
  try {
    app.setUserTasks(
      catalogoServicios.slice(0, 5).map((servicio) => ({
        program: process.execPath,
        args: `--abrir=${servicio.id}`,
        title: servicio.name,
        description: `Abrir ${servicio.name}`,
        iconPath: process.execPath,
        iconIndex: 0,
      })),
    );
  } catch (err) {
    console.warn("[app] no se pudo armar la jump list:", err.message);
  }
}

function createLauncherWindow() {
  const saved = loadWindowState();
  const visible = saved && boundsAreVisible(saved);

  launcherWindow = new BrowserWindow({
    width: visible ? saved.width : 1180,
    height: visible ? saved.height : 700,
    x: visible ? saved.x : undefined,
    y: visible ? saved.y : undefined,
    minWidth: 1000,
    minHeight: 580,
    show: false,
    frame: false, // titlebar propio, en theme de la marca
    backgroundColor: "#09090b",
    icon: path.join(__dirname, "..", "assets", "icon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (visible && saved.maximized) launcherWindow.maximize();

  launcherWindow.once("ready-to-show", () => launcherWindow.show());

  // Guardar el estado al cerrar y también si el usuario redimensiona
  // y olvida cerrar "bien" (se guarda al salir igualmente).
  // Si el ajuste lo dice, cerrar la ventana la manda a la bandeja en vez
  // de salir: el launcher sigue disponible sin ocupar lugar.
  launcherWindow.on("close", (event) => {
    if (!isQuitting && settings.load().minimizarBandeja) {
      event.preventDefault();
      launcherWindow.hide();
      return;
    }
    saveWindowState(launcherWindow);
    // El puente de sesión no debe sobrevivir al hub: si no, la app quedaría
    // viva sólo por esa ventana invisible (window-all-closed nunca llegaría).
    auth.cerrarPuente();
  });

  // Links externos (target=_blank) salen al navegador del sistema.
  launcherWindow.webContents.setWindowOpenHandler(({ url }) => {
    openExternalAllowed(url);
    return { action: "deny" };
  });

  // Menú de clic derecho (copiar, pegar, seleccionar todo): Electron no
  // trae ninguno, y sin esto no se puede pegar la contraseña en el login.
  contextMenu.attach({
    webContents: launcherWindow.webContents,
    ventana: launcherWindow,
    esDelSitio: isAllowedUrl,
    cargar: (url) => launcherWindow.loadURL(url),
  });
  diagnostics.attach(launcherWindow, "hub");

  // Zoom recordado. Los atajos del hub los atiende el renderer (React), así
  // que acá sólo se aplica el nivel guardado.
  launcherWindow.webContents.setZoomLevel(zoomGuardado());

  if (DEV_SERVER_URL) {
    launcherWindow.loadURL(DEV_SERVER_URL);
  } else {
    launcherWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  launcherWindow.on("closed", () => {
    launcherWindow = null;
  });
}

/**
 * Abre un servicio embebido en su propia ventana (barra del launcher +
 * página del servicio). Si ya está abierto, sólo la enfoca.
 */
function openService(serviceId, url, title) {
  return ventanaServicio.abrir({ id: serviceId, url, title });
}

// ── IPC del renderer ────────────────────────────────────────────────
ipcMain.handle("bling:open-service", (_event, { id, url, title }) => {
  const ok = openService(id, url, title);
  // Sólo los servicios del catálogo alimentan "Recientes": las ventanas de
  // cuenta (perfil, ajustes, notificaciones) no deben desplazar a los
  // servicios que el usuario realmente usa.
  if (ok && catalogoServicios.some((s) => s.id === id)) recents.add(id);
  return ok;
});
ipcMain.handle("bling:open-external", (_event, url) => openExternalAllowed(url));
ipcMain.handle("bling:app-version", () => app.getVersion());
ipcMain.on("bling:minimize", (event) => {
  BrowserWindow.fromWebContents(event.sender)?.minimize();
});
ipcMain.on("bling:close", (event) => {
  BrowserWindow.fromWebContents(event.sender)?.close();
});

// ── Ajustes ──────────────────────────────────────────────────────────
/** Aplica en caliente el efecto de un ajuste recién cambiado. */
function applySetting(ajustes, key) {
  if (key === "abrirAlIniciar" || key === undefined) {
    // Sólo tiene sentido en la app instalada: en dev apuntaría al
    // binario de electron, no a un launcher instalado.
    if (app.isPackaged) {
      app.setLoginItemSettings({
        openAtLogin: ajustes.abrirAlIniciar,
        path: process.execPath,
        args: [],
      });
    }
  }
  if (key === "minimizarBandeja" || key === undefined) {
    tray.setEnabled(ajustes.minimizarBandeja, catalogoServicios);
  }
  if (key === "descargarActualizaciones" || key === undefined) {
    updates.setAutoDownload(ajustes.descargarActualizaciones);
  }
  if (key === "zoom" || key === undefined) {
    // Ya se guardó desde acá (o el panel lo mandó por IPC): no se reescribe.
    aplicarZoom(ajustes.zoom, { persistir: false });
  }
}

settings.init({ onApply: applySetting });

// ── Registro y diagnóstico ───────────────────────────────────────────
// El reporte de "Acerca de" necesita el estado que vive acá, así que se
// pide por función en vez de copiarlo (la ventana puede no existir).
diagnostics.init({
  datos: () => ({
    ventana:
      launcherWindow && !launcherWindow.isDestroyed()
        ? { ...launcherWindow.getBounds(), maximizada: launcherWindow.isMaximized() }
        : null,
    ajustes: settings.load(),
    servicios: ventanaServicio.cantidad(),
  }),
});

// El renderer manda su catálogo para el submenú de la bandeja y la jump list.
ipcMain.on("bling:set-catalog", (_event, servicios) => {
  if (!Array.isArray(servicios)) return;
  catalogoServicios = servicios
    .filter((s) => s && typeof s.id === "string" && typeof s.name === "string")
    .map((s) => ({ id: s.id, name: s.name }));
  tray.refresh(catalogoServicios);
  actualizarTareas();
});

/**
 * Servicio pedido antes de que el hub existiera (arranque con --abrir= o
 * jump list). El renderer lo pregunta al montar: así no se pierde el pedido
 * por llegar antes de que hubiera quien escuchara.
 */
ipcMain.handle("bling:servicio-pendiente", () => {
  const id = servicioPendiente;
  servicioPendiente = null;
  return id;
});

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  // Segunda instancia: sólo enfocar la ventana existente.
  app.quit();
} else {
  app.on("second-instance", (_evento, argv) => {
    const pedido = servicioDeArgumentos(argv);
    // Si el hub se cerró pero quedaron ventanas de servicio abiertas,
    // launcherWindow es null: hay que recrearla, no ignorar el evento.
    if (!launcherWindow || launcherWindow.isDestroyed()) {
      if (pedido) servicioPendiente = pedido;
      createLauncherWindow();
      return;
    }
    if (launcherWindow.isMinimized()) launcherWindow.restore();
    launcherWindow.focus();
    // La instancia nueva puede venir de una tarea de la jump list.
    if (pedido) launcherWindow.webContents.send("tray:open-service", pedido);
  });

  Menu.setApplicationMenu(null);

  // Marcar el momento en que el usuario pide salir de verdad: así el
  // handler de "close" sabe que NO debe mandar la ventana a la bandeja.
  app.on("before-quit", () => {
    isQuitting = true;
    diagnostics.escribir("info", ["cerrando la aplicación"]);
  });

  // GPU, red o utilidades: si uno se cae, conviene saberlo después.
  app.on("child-process-gone", (_evento, detalles) => {
    diagnostics.escribir("error", [
      `proceso hijo caído: ${detalles.type}`,
      `${detalles.reason} (código ${detalles.exitCode})`,
    ]);
  });

  app.whenReady().then(() => {
    // Un servicio pedido por línea de comandos (o desde la jump list) se
    // abre apenas el hub avise que montó.
    servicioPendiente = servicioDeArgumentos(process.argv) || servicioPendiente;

    // Por defecto Electron rechaza TODOS los permisos en silencio: la red
    // social pediría notificaciones o cámara para los lives y nunca
    // funcionarían. Allowlist explícita; el resto se rechaza.
    const ALLOWED_PERMISSIONS = new Set([
      "notifications", // avisos de la red social
      "media", // micrófono y cámara para streams/lives
      "fullscreen", // vídeos de noticias a pantalla completa
      "clipboard-sanitized-write", // copiar enlaces
    ]);
    session.defaultSession.setPermissionRequestHandler(
      (_webContents, permission, callback) => {
        callback(ALLOWED_PERMISSIONS.has(permission));
      },
    );

    createLauncherWindow();
    updates.init({ openLink: openUpdateLink });
    recents.init();
    // Sesión de Bling: login nativo + perfil, sobre el jar compartido.
    auth.init({ getHub: () => launcherWindow });

    // Avisos nativos + globito: el contador llega del renderer y acá se
    // decide si hay algo nuevo que contar. El clic abre la bandeja.
    notificaciones.init({
      getHub: () => launcherWindow,
      abrirServicio: openService,
    });

    // Ventanas de servicio: barra del launcher arriba, página abajo.
    ventanaServicio.init({
      esUrlPermitida: isAllowedUrl,
      abrirExterno: openExternalAllowed,
      attachZoom,
      zoomGuardado,
    });

    // La bandeja necesita saber cuál es el hub (puede haber ventanas de
    // servicios abiertas). Se registra el getter antes de aplicar ajustes.
    tray.setHubGetter(() => launcherWindow);

    // Aplicar los ajustes guardados (bandeja, auto-launch, auto-download).
    // El catálogo llega del renderer apenas monta; hasta entonces la
    // bandeja queda sin submenú de servicios.
    applySetting(settings.load());

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createLauncherWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
