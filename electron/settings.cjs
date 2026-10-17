"use strict";

const { app, ipcMain } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

/**
 * Ajustes del launcher, persistidos en userData/settings.json.
 *
 * El renderer sólo lee y escribe esta lista corta por IPC: nunca toca el
 * disco ni conoce rutas. Cada cambio se aplica de inmediato en el proceso
 * principal (auto-launch, bandeja, descarga automática de updates), así
 * que la UI y el estado real nunca se desincronizan.
 */
const DEFAULTS = {
  /** Abrir el launcher al iniciar Windows. */
  abrirAlIniciar: false,
  /** Al cerrar la ventana, minimizar a la bandeja en vez de salir. */
  minimizarBandeja: false,
  /** Descargar las actualizaciones sin preguntar (se instalan al salir). */
  descargarActualizaciones: true,
};

/** Nombres de ajuste válidos → tipo. Fuente de verdad para el IPC. */
const KEYS = new Set(Object.keys(DEFAULTS));

function statePath() {
  return path.join(app.getPath("userData"), "settings.json");
}

function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(statePath(), "utf8"));
    if (!raw || typeof raw !== "object") return { ...DEFAULTS };
    // Sólo se aceptan claves conocidas y booleanas: nada de campos extra
    // heredados de una versión vieja ni de valores raros.
    const out = { ...DEFAULTS };
    for (const key of KEYS) {
      if (typeof raw[key] === "boolean") out[key] = raw[key];
    }
    return out;
  } catch {
    return { ...DEFAULTS }; // primera vez, o archivo corrupto
  }
}

function save(next) {
  try {
    fs.mkdirSync(app.getPath("userData"), { recursive: true });
    fs.writeFileSync(statePath(), JSON.stringify(next, null, 2));
  } catch (err) {
    console.warn("[settings] no se pudo guardar:", err.message);
  }
}

/** Escribe un ajuste. Devuelve los ajustes ya actualizados. */
function set(key, value) {
  if (!KEYS.has(key) || typeof value !== "boolean") return load();
  const next = { ...load(), [key]: value };
  save(next);
  return next;
}

/**
 * Registra el IPC.
 * `onApply` recibe (ajustes, clave) después de cada cambio, para que el
 * main aplique el efecto correspondiente (bandeja, auto-launch, etc.).
 */
function init({ onApply } = {}) {
  ipcMain.handle("bling:settings-get", () => load());
  ipcMain.handle("bling:settings-set", (_event, key, value) => {
    const next = set(key, value);
    if (typeof onApply === "function") onApply(next, key);
    return next;
  });
}

module.exports = { init, load, set, DEFAULTS };
