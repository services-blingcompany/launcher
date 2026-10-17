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
  const next = [clean, ...load().filter((x) => x !== clean)].slice(0, MAX_ITEMS);
  save(next);
  return next;
}

function init() {
  ipcMain.handle("bling:recents", () => load());
  ipcMain.handle("bling:recents-add", (_event, id) => add(id));
}

module.exports = { init, add };
