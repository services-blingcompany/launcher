"use strict";

const fs = require("node:fs");
const path = require("node:path");

/**
 * ¿Este ejecutable es una copia de prueba y no el launcher instalado?
 *
 * `npm run local` arma release/win-unpacked con el mismo app-update.yml que
 * el instalado, así que también buscaba versiones nuevas y, al "actualizarse",
 * instalaba encima del launcher real. El instalado (NSIS) siempre tiene el
 * desinstalador al lado del .exe; la copia de prueba no.
 *
 * Para probar el flujo de actualización con la copia de prueba:
 *   BLING_PROBAR_ACTUALIZACIONES=1
 */
function esCopiaDePrueba(execPath, { existe = fs.existsSync, env = process.env } = {}) {
  if (env.BLING_PROBAR_ACTUALIZACIONES === "1") return false;
  const carpeta = path.dirname(String(execPath || ""));
  return !existe(path.join(carpeta, "Uninstall Bling Launcher.exe"));
}

module.exports = { esCopiaDePrueba };
