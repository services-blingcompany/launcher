/**
 * Huella de este equipo para el límite de equipos por persona.
 *
 * Lee el id de la máquina del sistema operativo (Windows: MachineGuid; Mac:
 * IOPlatformUUID; Linux: /etc/machine-id). Si no se puede leer, usa un id
 * aleatorio guardado en la carpeta de la app (sigue siendo estable en esta
 * PC). La huella se calcula una vez por ejecución.
 */
"use strict";

const { app } = require("electron");
const { execFileSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const logica = require("./equipoLogica.cjs");

let cache = null;

function idDelSistema() {
  try {
    if (process.platform === "win32") {
      const salida = execFileSync(
        "reg",
        ["query", "HKLM\\SOFTWARE\\Microsoft\\Cryptography", "/v", "MachineGuid"],
        { encoding: "utf8", windowsHide: true, timeout: 5000 },
      );
      return logica.idDeWindows(salida);
    }
    if (process.platform === "darwin") {
      const salida = execFileSync("ioreg", ["-rd1", "-c", "IOPlatformExpertDevice"], {
        encoding: "utf8",
        timeout: 5000,
      });
      return logica.idDeMac(salida);
    }
    return logica.idDeLinux(fs.readFileSync("/etc/machine-id", "utf8"));
  } catch {
    return null;
  }
}

/** Respaldo: id aleatorio propio de esta instalación, guardado en userData. */
function idDeRespaldo() {
  const archivo = path.join(app.getPath("userData"), "equipo.json");
  try {
    const guardado = JSON.parse(fs.readFileSync(archivo, "utf8"));
    if (guardado && typeof guardado.id === "string" && guardado.id.length >= 32) return guardado.id;
  } catch {
    // no existe o está roto: se crea uno nuevo
  }
  const id = crypto.randomBytes(32).toString("hex");
  try {
    fs.writeFileSync(archivo, JSON.stringify({ id }), { encoding: "utf8", mode: 0o600 });
  } catch {
    // sin disco: vale para esta ejecución
  }
  return id;
}

/** { huella, nombre, plataforma, remoto } de este equipo. */
function obtener(plataforma) {
  if (!cache) {
    const id = idDelSistema() || idDeRespaldo();
    cache = {
      huella: logica.huellaDe(id),
      nombre: logica.nombreDe(os.hostname(), process.platform),
    };
  }
  return { ...cache, plataforma, remoto: logica.esRemoto(process.env, process.platform) };
}

module.exports = { obtener };
