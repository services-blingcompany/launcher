"use strict";

const { app, net, ipcMain, BrowserWindow } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

/**
 * Aviso de nuevas versiones.
 *
 * Fuente de verdad: los releases de GitHub del propio repo
 * (services-blingcompany/launcher). Cuando publicás una release con tag
 * vX.Y.Z y el instalador adjunto, el launcher la detecta solo: no hay
 * servidor propio ni costo de hosting.
 *
 * Para probar el UI sin publicar nada:
 *   BLING_UPDATE_DEBUG=1.2.0 npm start
 */
const UPDATE_REPO = "services-blingcompany/launcher";
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 h mientras esté abierto
const FIRST_CHECK_DELAY_MS = 5000; // no apurar la ventana al arrancar
const REQUEST_TIMEOUT_MS = 8000;

/** Última versión nueva conocida (UpdateInfo) o null si no hay. */
let current = null;
/** Versión que el usuario descartó con la X (no volver a auto-molestar). */
let dismissedVersion = null;

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

/** "v1.2.3" → [1, 2, 3]. Devuelve null si no es un semver parseable. */
function parseVersion(value) {
  const m = String(value ?? "")
    .trim()
    .replace(/^v/i)
    .match(/^(\d+)\.(\d+)\.(\d+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** ¿candidate es más nueva que base? */
function isNewer(candidate, base) {
  const a = parseVersion(candidate);
  const b = parseVersion(base);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) {
    if (a[i] > b[i]) return true;
    if (a[i] < b[i]) return false;
  }
  return false; // misma versión
}

/** Primer párrafo del changelog, sin viñetas, para el toast. */
function firstLine(notes) {
  const line = String(notes ?? "")
    .split("\n")
    .map((s) => s.trim())
    .find(Boolean);
  return (line ?? "").replace(/^[-*•\s]+/, "");
}

async function fetchLatest() {
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
    // 404 = todavía no hay releases publicados: silencio total.
    if (!res.ok) return null;

    const data = await res.json();
    const version = String(data.tag_name ?? "").replace(/^v/i, "");
    if (!parseVersion(version)) return null;

    // El asset .exe directo si existe; si no, la página del release.
    const asset = Array.isArray(data.assets)
      ? data.assets.find((a) => /\.exe$/i.test(a.name ?? ""))
      : null;
    const page =
      data.html_url || `https://github.com/${UPDATE_REPO}/releases/latest`;

    return {
      version,
      notes: firstLine(data.body),
      url: asset?.browser_download_url || page,
      page,
    };
  } finally {
    clearTimeout(timer);
  }
}

function broadcast(payload) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send("update:available", payload);
  }
}

async function check({ notify = true } = {}) {
  const debug = process.env.BLING_UPDATE_DEBUG;
  const latest = debug
    ? {
        version: debug.replace(/^v/i, ""),
        notes:
          process.env.BLING_UPDATE_DEBUG_NOTES ||
          "Nueva versión de prueba con mejoras de rendimiento y detalles visuales.",
        url: `https://github.com/${UPDATE_REPO}/releases/latest`,
        page: `https://github.com/${UPDATE_REPO}/releases/latest`,
      }
    : await fetchLatest();

  const base = app.getVersion();
  if (!latest || !isNewer(latest.version, base)) {
    current = null;
    return { status: "up-to-date", current: base };
  }

  current = latest;
  if (notify && dismissedVersion !== latest.version) broadcast(latest);
  return {
    status: "available",
    current: base,
    update: latest,
    dismissed: dismissedVersion === latest.version,
  };
}

/**
 * Registra el IPC y agenda la primera revisión (a los 5 s) y luego cada
 * 4 h. `openLink` viene del main y se encarga de validar el dominio.
 */
function init({ openLink }) {
  dismissedVersion = loadState().dismissedVersion ?? null;

  ipcMain.handle("update:check", () => check({ notify: false }));
  ipcMain.on("update:dismiss", (_event, version) => {
    dismissedVersion = String(version ?? current?.version ?? "");
    persist({ dismissedVersion });
  });
  ipcMain.handle("update:open", (_event, url) => openLink(url));

  setTimeout(() => {
    check().catch((err) => console.warn("[update] revisión falló:", err));
  }, FIRST_CHECK_DELAY_MS);
  setInterval(() => {
    check().catch((err) => console.warn("[update] revisión falló:", err));
  }, CHECK_INTERVAL_MS);
}

module.exports = { init };
