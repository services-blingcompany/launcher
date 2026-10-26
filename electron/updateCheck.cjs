"use strict";

const { app, net, ipcMain, BrowserWindow } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { autoUpdater } = require("electron-updater");

/**
 * Actualizaciones: detecciÃ³n, descarga e instalaciÃ³n.
 *
 * En producciÃ³n usa electron-updater, que se apoya en los releases de
 * GitHub del propio repo: baja el instalador (con descarga diferencial
 * vÃ­a blockmap) y lo instala al salir o al pedirlo. No hay servidor
 * propio ni costo de hosting.
 *
 * El proceso principal es el Ãºnico que habla con GitHub y con el disco;
 * el renderer sÃ³lo recibe estados por IPC.
 *
 * Para probar el UI sin publicar nada (sÃ³lo en dev):
 *   BLING_UPDATE_DEBUG=1.2.0 npm start
 */
const UPDATE_REPO = "services-blingcompany/launcher";
const CHECK_INTERVAL_MS = 30 * 60 * 1000; // cada 30 min
const FIRST_CHECK_DELAY_MS = 5000; // no apurar la ventana al arrancar
const REQUEST_TIMEOUT_MS = 8000;

/** Ãšltima versiÃ³n nueva conocida (UpdateInfo) o null si no hay. */
let current = null;
/** VersiÃ³n que el usuario descartÃ³ con la X (no volver a auto-molestar). */
let dismissedVersion = null;
/** Ãšltimo progreso de descarga, o null si no hay descarga en curso. */
let progress = null;
/** true cuando la versiÃ³n nueva ya estÃ¡ descargada y lista para instalar. */
let downloaded = false;
/** Validador de dominios para los enlaces de "Novedades". */
let openLink = null;

function statePath() {
  return path.join(app.getPath("userData"), "update-state.json");
}

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(statePath(), "utf8")) || {};
  } catch {
    return {}; // primera vez, o estado corrupto: no pasa nada
  }
}

function persist(patch) {
  try {
    fs.mkdirSync(app.getPath("userData"), { recursive: true });
    fs.writeFileSync(
      statePath(),
      JSON.stringify({ ...loadState(), ...patch }, null, 2),
    );
  } catch (err) {
    console.warn("[update] no se pudo guardar el estado:", err.message);
  }
}

/** "v1.2.3" â†’ [1, 2, 3]. Devuelve null si no es un semver parseable. */
function parseVersion(value) {
  const m = String(value ?? "")
    .trim()
    .replace(/^v/i)
    .match(/^(\d+)\.(\d+)\.(\d+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** Â¿candidate es mÃ¡s nueva que base? */
function isNewer(candidate, base) {
  const a = parseVersion(candidate);
  const b = parseVersion(base);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) {
    if (a[i] > b[i]) return true;
    if (a[i] < b[i]) return false;
  }
  return false; // misma versiÃ³n
}

/** Primer pÃ¡rrafo del changelog, sin viÃ±etas, para el toast. */
function firstLine(notes) {
  // electron-updater puede devolver string o [{version, note}].
  let text = notes;
  if (Array.isArray(text)) text = text.map((n) => n?.note ?? "").join("\n");
  return String(text ?? "")
    .split("\n")
    .map((s) => s.trim())
    .find(Boolean)
    ?.replace(/^[-*â€¢\s]+/, "") ?? "";
}

function releaseUrl(version) {
  return `https://github.com/${UPDATE_REPO}/releases/tag/v${version}`;
}

/** UpdateInfo de electron-updater â†’ la forma que consume el renderer. */
function toUpdateInfo(info) {
  const version = String(info?.version ?? "").replace(/^v/i, "");
  return {
    version,
    notes: firstLine(info?.releaseNotes),
    url: releaseUrl(version),
    page: releaseUrl(version),
  };
}

function broadcast(channel, payload) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload);
  }
}

/** Estado completo para el renderer, en un solo objeto. */
function snapshot() {
  return {
    status: current ? "available" : "up-to-date",
    current: app.getVersion(),
    update: current,
    dismissed: current ? dismissedVersion === current.version : false,
    progress,
    downloaded,
  };
}

// â”€â”€ Modo dev: chequeo contra GitHub sin instalar nada â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// electron-updater sÃ³lo funciona con la app empaquetada, asÃ­ que en
// desarrollo se mantiene un chequeo liviano contra la API de GitHub
// (y la simulaciÃ³n por variable de entorno) para poder probar el UI.
async function fetchLatestDev() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await net.fetch(
      `https://api.github.com/repos/${UPDATE_REPO}/releases/latest`,
      {
        signal: controller.signal,
        headers: {
          // GitHub exige User-Agent; Accept fija el shape de la respuesta.
          "User-Agent": "Bling-Launcher",
          Accept: "application/vnd.github+json",
        },
      },
    );
    // 404 = todavÃ­a no hay releases publicados: silencio total.
    if (!res.ok) return null;
    const data = await res.json();
    const version = String(data.tag_name ?? "").replace(/^v/i, "");
    if (!parseVersion(version)) return null;
    return {
      version,
      notes: firstLine(data.body),
      url: releaseUrl(version),
      page: releaseUrl(version),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function checkDev({ notify = true } = {}) {
  const debug = process.env.BLING_UPDATE_DEBUG;
  const latest = debug
    ? {
        version: debug.replace(/^v/i, ""),
        notes:
          process.env.BLING_UPDATE_DEBUG_NOTES ||
          "Nueva versiÃ³n de prueba con mejoras de rendimiento y detalles visuales.",
        url: releaseUrl(debug.replace(/^v/i, "")),
        page: releaseUrl(debug.replace(/^v/i, "")),
      }
    : await fetchLatestDev();

  const base = app.getVersion();
  if (!latest || !isNewer(latest.version, base)) {
    current = null;
    downloaded = false;
    progress = null;
    return snapshot();
  }

  current = latest;
  // En dev no hay descarga real: el botÃ³n "instalar" cae al enlace.
  downloaded = false;
  if (notify && dismissedVersion !== latest.version) {
    broadcast("update:available", latest);
  }
  return snapshot();
}

// â”€â”€ ProducciÃ³n: electron-updater â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let updaterReady = false;

function initUpdater() {
  if (updaterReady) return;
  updaterReady = true;

  // La app no estÃ¡ firmada con certificado comercial: sin esto,
  // electron-updater rechaza el instalador bajado por falta de firma.
  autoUpdater.verifyUpdateCodeSignature = false;
  // No instalar por nuestra cuenta: el usuario decide con el botÃ³n, y
  // si lo deja estar, se instala al salir de todos modos.
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-available", (info) => {
    current = toUpdateInfo(info);
    if (dismissedVersion !== current.version) {
      broadcast("update:available", current);
    }
  });

  autoUpdater.on("update-not-available", () => {
    current = null;
    downloaded = false;
    progress = null;
  });

  autoUpdater.on("download-progress", (p) => {
    progress = {
      percent: Math.round(p?.percent ?? 0),
      transferred: p?.transferred ?? 0,
      total: p?.total ?? 0,
      bytesPerSecond: p?.bytesPerSecond ?? 0,
    };
    broadcast("update:progress", progress);
  });

  autoUpdater.on("update-downloaded", (info) => {
    current = toUpdateInfo(info);
    downloaded = true;
    progress = null;
    broadcast("update:downloaded", current);
  });

  autoUpdater.on("error", (err) => {
    // Un fallo de red no debe romper nada: se reintenta en el prÃ³ximo
    // chequeo automÃ¡tico. SÃ³lo se avisa al renderer si habÃ­a descarga.
    console.warn("[update] error de electron-updater:", err?.message ?? err);
    progress = null;
    broadcast("update:progress", null);
  });
}

async function checkProd({ notify = true } = {}) {
  initUpdater();
  // autoDownload la controla el ajuste "descargarActualizaciones".
  try {
    await autoUpdater.checkForUpdates();
  } catch (err) {
    console.warn("[update] revisiÃ³n fallÃ³:", err?.message ?? err);
  }
  if (notify && current && dismissedVersion !== current.version) {
    broadcast("update:available", current);
  }
  return snapshot();
}

async function check(opts) {
  return app.isPackaged ? checkProd(opts) : checkDev(opts);
}

// â”€â”€ IPC â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Arranca la descarga de la versiÃ³n disponible (sÃ³lo empaquetado). */
async function download() {
  if (!app.isPackaged || !current) return snapshot();
  initUpdater();
  try {
    await autoUpdater.downloadUpdate();
  } catch (err) {
    console.warn("[update] descarga fallÃ³:", err?.message ?? err);
  }
  return snapshot();
}

/** Cierra la app y lanza el instalador ya descargado. */
function install() {
  if (!app.isPackaged || !downloaded) return false;
  // isSilent=false: muestra el asistente de NSIS.
  autoUpdater.quitAndInstall(false, true);
  return true;
}

/**
 * Registra el IPC y agenda la primera revisiÃ³n (a los 5 s) y luego cada
 * 4 h. `openLink` viene del main y se encarga de validar el dominio; se
 * usa para el enlace de "Novedades" (pÃ¡gina del release).
 */
function init({ openLink: validateAndOpen }) {
  openLink = validateAndOpen;
  dismissedVersion = loadState().dismissedVersion ?? null;

  ipcMain.handle("update:check", () => check({ notify: false }));
  ipcMain.on("update:dismiss", (_event, version) => {
    dismissedVersion = String(version ?? current?.version ?? "");
    persist({ dismissedVersion });
  });
  ipcMain.handle("update:open", (_event, url) => openLink(url));
  ipcMain.handle("update:download", () => download());
  ipcMain.on("update:install", () => install());

  setTimeout(() => {
    check().catch((err) => console.warn("[update] revisiÃ³n fallÃ³:", err));
  }, FIRST_CHECK_DELAY_MS);
  setInterval(() => {
    check().catch((err) => console.warn("[update] revisiÃ³n fallÃ³:", err));
  }, CHECK_INTERVAL_MS);
}

/** El ajuste "descargarActualizaciones" se aplica en caliente. */
function setAutoDownload(enabled) {
  autoUpdater.autoDownload = Boolean(enabled);
}

module.exports = { init, setAutoDownload };
