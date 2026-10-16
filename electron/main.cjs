"use strict";

const { app, BrowserWindow, ipcMain, shell, Menu } = require("electron");
const path = require("node:path");
const updates = require("./updateCheck.cjs");

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

function createLauncherWindow() {
  launcherWindow = new BrowserWindow({
    width: 1180,
    height: 700,
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

  launcherWindow.once("ready-to-show", () => launcherWindow.show());

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
ipcMain.handle("bling:open-service", (_event, { id, url, title }) =>
  openService(id, url, title),
);
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
    if (launcherWindow) {
      if (launcherWindow.isMinimized()) launcherWindow.restore();
      launcherWindow.focus();
    }
  });

  Menu.setApplicationMenu(null);

  app.whenReady().then(() => {
    createLauncherWindow();
    updates.init({ openLink: openUpdateLink });

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createLauncherWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
