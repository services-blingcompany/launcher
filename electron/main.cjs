"use strict";

const { app, BrowserWindow, ipcMain, shell, Menu, screen, session } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const updates = require("./updateCheck.cjs");
const recents = require("./recents.cjs");

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

/** Ventana principal (el hub). */
let launcherWindow = null;
/** Ventanas embebidas por servicio, para no abrir dos veces el mismo. */
const serviceWindows = new Map();

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
  launcherWindow.on("close", () => saveWindowState(launcherWindow));

  // Links externos (target=_blank) salen al navegador del sistema.
  launcherWindow.webContents.setWindowOpenHandler(({ url }) => {
    openExternalAllowed(url);
    return { action: "deny" };
  });

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

  win.on("closed", () => serviceWindows.delete(serviceId));

  serviceWindows.set(serviceId, win);
  win.loadURL(url);
  return true;
}

// ── IPC del renderer ────────────────────────────────────────────────
ipcMain.handle("bling:open-service", (_event, { id, url, title }) => {
  const ok = openService(id, url, title);
  // Abrirlo lo registra como "usado": alimenta la sección de recientes.
  if (ok) recents.add(id);
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

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createLauncherWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
