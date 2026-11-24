"use strict";

const { app, ipcMain } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

/**
 * Servicios que el usuario abrió por última vez, en orden de uso.
 *
 * Se guarda sólo el id (nunca URLs ni datos personales) en
 * userData/recents.json. El renderer los pide por IPC; no tiene acceso
 * al disco. Máximo MAX_ITEMS, sin duplicados (el más reciente gana).
 */
const MAX_ITEMS = 6;

function statePath() {
  return path.join(app.getPath("userData"), "recents.json");
}

/**
 * Cuántas veces se abrió cada servicio (userData/usos.json, sólo id → número).
 * Con esto el launcher destaca la app de escritorio que la persona más usa.
 */
function usosPath() {
  return path.join(app.getPath("userData"), "usos.json");
}

function loadUsos() {
  try {
    const raw = JSON.parse(fs.readFileSync(usosPath(), "utf8"));
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const limpio = {};
    for (const [id, n] of Object.entries(raw)) {
      if (Number.isFinite(n) && n > 0) limpio[id] = Math.floor(n);
    }
    return limpio;
  } catch {
    return {};
  }
}

function sumarUso(id) {
  const usos = loadUsos();
  usos[id] = (usos[id] || 0) + 1;
  try {
    fs.mkdirSync(app.getPath("userData"), { recursive: true });
    fs.writeFileSync(usosPath(), JSON.stringify(usos, null, 2));
  } catch (err) {
    console.warn("[recents] no se pudieron guardar los usos:", err.message);
  }
}

function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(statePath(), "utf8"));
    return Array.isArray(raw) ? raw.filter((x) => typeof x === "string") : [];
  } catch {
    return []; // primera vez, o estado corrupto
  }
}

function save(ids) {
  try {
    fs.mkdirSync(app.getPath("userData"), { recursive: true });
    fs.writeFileSync(statePath(), JSON.stringify(ids, null, 2));
  } catch (err) {
    console.warn("[recents] no se pudo guardar:", err.message);
  }
}

/** Mueve `id` al frente, sin duplicar, y recorta a MAX_ITEMS. */
function add(id) {
  const clean = String(id ?? "").trim();
  if (!clean) return load();
  sumarUso(clean);
  const next = [clean, ...load().filter((x) => x !== clean)].slice(0, MAX_ITEMS);
  save(next);
  return next;
}

function init() {
  ipcMain.handle("bling:recents", () => load());
  ipcMain.handle("bling:recents-add", (_event, id) => add(id));
  // Vaciar la lista desde Ajustes → Datos.
  ipcMain.handle("bling:recents-clear", () => {
    save([]);
    try {
      fs.rmSync(usosPath(), { force: true });
    } catch {
      // no había usos guardados
    }
    return [];
  });
  ipcMain.handle("bling:usos", () => loadUsos());
}

module.exports = { init, add };
