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

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

/** Ventana principal (el hub). */
let launcherWindow = null;
/** Ventanas embebidas por servicio, para no abrir dos veces el mismo. */
const serviceWindows = new Map();

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
  contextMenu.attach(launcherWindow, { esDelSitio: isAllowedUrl });

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
 * Abre un servicio embebido en su propia ventana. Si ya está abierto,
 * sólo la enfoca (idempotente, como un launcher de verdad).
 */
function openService(serviceId, url, title) {
  if (!isAllowedUrl(url)) return false;

  const existing = serviceWindows.get(serviceId);
  if (existing && !existing.isDestroyed()) {
    if (existing.isMinimized()) existing.restore();
    existing.focus();
    return true;
  }

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    backgroundColor: "#09090b",
    title: title || "Bling",
    icon: path.join(__dirname, "..", "assets", "icon.ico"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.once("ready-to-show", () => win.show());

  // Navegación interna al mismo dominio queda en la ventana del servicio;
  // todo lo demás se abre en el navegador del sistema.
  win.webContents.setWindowOpenHandler(({ url: target }) => {
    openExternalAllowed(target);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, target) => {
    if (!isAllowedUrl(target)) {
      event.preventDefault();
      openExternalAllowed(target);
    }
  });

  // Dentro de los servicios el clic derecho hace falta igual (o más):
  // copiar texto, pegar, copiar el enlace de una nota o el alias de alguien.
  contextMenu.attach(win, { esDelSitio: isAllowedUrl });

  win.on("closed", () => serviceWindows.delete(serviceId));

  serviceWindows.set(serviceId, win);
  win.loadURL(url);
  return true;
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
}

settings.init({ onApply: applySetting });

// El renderer manda su catálogo para el submenú de la bandeja.
ipcMain.on("bling:set-catalog", (_event, servicios) => {
  if (!Array.isArray(servicios)) return;
  catalogoServicios = servicios
    .filter((s) => s && typeof s.id === "string" && typeof s.name === "string")
    .map((s) => ({ id: s.id, name: s.name }));
  tray.refresh(catalogoServicios);
});

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  // Segunda instancia: sólo enfocar la ventana existente.
  app.quit();
} else {
  app.on("second-instance", () => {
    // Si el hub se cerró pero quedaron ventanas de servicio abiertas,
    // launcherWindow es null: hay que recrearla, no ignorar el evento.
    if (!launcherWindow || launcherWindow.isDestroyed()) {
      createLauncherWindow();
      return;
    }
    if (launcherWindow.isMinimized()) launcherWindow.restore();
    launcherWindow.focus();
  });

  Menu.setApplicationMenu(null);

  // Marcar el momento en que el usuario pide salir de verdad: así el
  // handler de "close" sabe que NO debe mandar la ventana a la bandeja.
  app.on("before-quit", () => {
    isQuitting = true;
  });

  app.whenReady().then(() => {
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
