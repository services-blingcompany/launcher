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
  /**
   * Nivel de zoom del renderer (Chromium: 1.2^zoom, así que 0 es 100 % y
   * cada 0,5 es ~10 %). Se cambia con Ctrl + / Ctrl − / Ctrl 0.
   */
  zoom: 0,
};

const esBooleano = (valor) => typeof valor === "boolean";
const esNivelDeZoom = (valor) =>
  typeof valor === "number" && Number.isFinite(valor) && valor >= -3 && valor <= 4;

/** Validador por ajuste: por el IPC sólo entra el tipo que corresponde. */
const VALIDAR = {
  abrirAlIniciar: esBooleano,
  minimizarBandeja: esBooleano,
  descargarActualizaciones: esBooleano,
  zoom: esNivelDeZoom,
};

function statePath() {
  return path.join(app.getPath("userData"), "settings.json");
}

function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(statePath(), "utf8"));
    if (!raw || typeof raw !== "object") return { ...DEFAULTS };
    // Sólo se aceptan claves conocidas y del tipo que corresponde: nada de
    // campos extra heredados de una versión vieja ni de valores raros.
    const out = { ...DEFAULTS };
    for (const [key, valida] of Object.entries(VALIDAR)) {
      if (valida(raw[key])) out[key] = raw[key];
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
  if (!VALIDAR[key] || !VALIDAR[key](value)) return load();
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
