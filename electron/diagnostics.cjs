"use strict";

const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");

/**
 * Registro en disco + reporte de diagnóstico para soporte.
 *
 * En la app instalada no hay consola donde mirar, así que todo lo que el
 * proceso principal avisa (warn/error) queda también en
 * userData/logs/launcher.log. El reporte que se copia desde "Acerca de"
 * junta ese registro con el entorno del equipo.
 *
 * Lo único que se guarda son avisos de la propia app: nunca credenciales,
 * correo, alias, tokens ni cookies.
 */

/** ~512 KB por archivo: alcanza para semanas y no crece sin control. */
const MAX_BYTES = 512 * 1024;
/** Cuántas líneas del registro van al reporte. */
const LINEAS_REPORTE = 120;

const PLATAFORMAS = { win32: "Windows", darwin: "macOS", linux: "Linux" };
let carpetaLogs = null;
let archivoLog = null;
let ultimaRevision = 0;
/** De dónde saca el reporte los datos que viven en main.cjs. */
let entorno = () => ({});

function formatear(valor) {
  if (typeof valor === "string") return valor;
  if (valor instanceof Error) return valor.stack || `${valor.name}: ${valor.message}`;
  if (valor === null || valor === undefined) return String(valor);
  try {
    return JSON.stringify(valor);
  } catch {
    return String(valor);
  }
}

/** Agrega una línea al registro. Si el archivo se llenó, lo recicla. */
function escribir(nivel, partes) {
  if (!archivoLog) return;
  try {
    const linea = `${new Date().toISOString()} [${nivel}] ${partes.map(formatear).join(" ")}\n`;
    fs.appendFileSync(archivoLog, linea, "utf8");
    reciclar();
  } catch {
    // Si el disco no deja escribir, el launcher igual tiene que andar.
  }
}

/**
 * Cuando el registro pasa el tope se guarda como launcher.1.log (y se pisa
 * el anterior). Chequear el tamaño cuesta, así que se mira cada 30 s.
 */
function reciclar() {
  const ahora = Date.now();
  if (ahora - ultimaRevision < 30_000) return;
  ultimaRevision = ahora;
  try {
    if (fs.statSync(archivoLog).size < MAX_BYTES) return;
    const anterior = path.join(carpetaLogs, "launcher.1.log");
    fs.rmSync(anterior, { force: true });
    fs.renameSync(archivoLog, anterior);
  } catch {
    // Si no se puede reciclar, sigue acumulando: no es motivo de falla.
  }
}

/** Últimas líneas del registro, para el reporte. */
function cola(lineas = LINEAS_REPORTE) {
  try {
    const texto = fs.readFileSync(archivoLog, "utf8");
    const todas = texto.split("\n").filter((linea) => linea.trim() !== "");
    return todas.slice(-lineas).join("\n");
  } catch {
    return "(todavía no hay registro)";
  }
}

/**
 * Engancha los avisos de una ventana: caída del proceso de render, carga
 * fallida, error de preload y los errores que salen por la consola del
 * renderer (que si no se pierden en el aire).
 */
function attach(win, etiqueta, { consola = true } = {}) {
  const wc = win.webContents;
  const prefijo = `[${etiqueta}] `;

  win.on("unresponsive", () => escribir("warn", [prefijo + "la ventana dejó de responder"]));
  win.on("responsive", () => escribir("info", [prefijo + "la ventana volvió a responder"]));

  wc.on("render-process-gone", (_evento, detalles) => {
    escribir("error", [
      prefijo + "se cayó el proceso de render:",
      `${detalles.reason} (código ${detalles.exitCode})`,
    ]);
  });

  wc.on("did-fail-load", (_evento, codigo, descripcion, url, esPrincipal) => {
    if (!esPrincipal) return;
    escribir("warn", [prefijo + `no cargó (${codigo} ${descripcion})`, url]);
  });

  wc.on("preload-error", (_evento, ruta, error) => {
    escribir("error", [prefijo + "error en el preload", ruta, error]);
  });

  // Electron nuevo manda (evento, detalles) y el viejo (evento, nivel, …):
  // se aceptan las dos formas. Sólo los errores: los avisos de las páginas
  // de los servicios son ruido que tapa lo que importa. En las ventanas que
  // cargan páginas de terceros (el puente de auth) se apaga del todo.
  if (!consola) return;
  wc.on("console-message", (_evento, ...args) => {
    const detalles = args[0] && typeof args[0] === "object" ? args[0] : null;
    const nivel = detalles ? detalles.level : args[0];
    if (nivel !== "error" && nivel !== 3) return;
    escribir("error", [
      prefijo + "consola del renderer:",
      detalles ? detalles.message : args[1],
    ]);
  });
}

/** Fila del reporte, con la etiqueta alineada. */
function fila(etiqueta, valor) {
  return `${etiqueta.padEnd(13)} ${valor}`;
}

/** Windows 11 se identifica como 10.0.<build 22000+>: se nombra por lo que es. */
function sistema() {
  const version = os.release();
  if (process.platform === "win32") {
    const build = Number(version.split(".")[2] || 0);
    return `${build >= 22000 ? "Windows 11" : "Windows 10"} (${version})`;
  }
  return `${PLATAFORMAS[process.platform] || process.platform} ${version}`;
}

/**
 * Arma el texto del diagnóstico: sólo el equipo y la app. Sin datos de la
 * cuenta, para que se pueda pegar en cualquier lado sin pensarlo.
 */
function reporte() {
  const v = process.versions;
  const datos = entorno() || {};
  const lineas = [];

  lineas.push("Bling Launcher — diagnóstico");
  lineas.push(`Generado: ${new Date().toISOString()}`);
  lineas.push("");
  lineas.push("── Versión ──");
  lineas.push(fila("Aplicación", app.getVersion()));
  lineas.push(fila("Electron", v.electron));
  lineas.push(fila("Chromium", v.chrome));
  lineas.push(fila("Node", v.node));
  lineas.push(
    fila("Sistema", `${sistema()} · ${process.arch} · ${app.getLocale()}`),
  );

  lineas.push("");
  lineas.push("── Launcher ──");
  if (datos.ventana) {
    const { width, height, maximizada } = datos.ventana;
    lineas.push(fila("Ventana", `${width}x${height}${maximizada ? " (maximizada)" : ""}`));
  }
  if (datos.ajustes) {
    const valores = Object.entries(datos.ajustes)
      .map(([clave, valor]) => `${clave}=${valor ? "sí" : "no"}`)
      .join(" · ");
    lineas.push(fila("Ajustes", valores));
  }
  lineas.push(fila("Datos", app.getPath("userData")));
  lineas.push(fila("Registro", archivoLog || "(sin registro)"));

  lineas.push("");
  lineas.push(`── Registro (últimas ${LINEAS_REPORTE} líneas) ──`);
  lineas.push(cola());

  return lineas.join("\n");
}

/** Abre el diálogo de guardar y escribe el reporte. Devuelve la ruta o null. */
async function guardar(texto, ventana) {
  const opciones = {
    title: "Guardar el diagnóstico",
    defaultPath: path.join(app.getPath("downloads"), "bling-launcher-diagnostico.txt"),
    filters: [{ name: "Texto", extensions: ["txt"] }],
  };
  // Sin ventana (no debería pasar) el diálogo igual tiene que abrir.
  const { canceled, filePath } = ventana
    ? await dialog.showSaveDialog(ventana, opciones)
    : await dialog.showSaveDialog(opciones);
  if (canceled || !filePath) return null;
  fs.writeFileSync(filePath, texto || reporte(), "utf8");
  return filePath;
}

/**
 * Prepara la carpeta de logs, redirige los avisos de consola al archivo y
 * publica los handlers del reporte. `datos` devuelve el estado del launcher
 * (ventana, ajustes) que vive en main.cjs.
 */
function init({ datos } = {}) {
  if (typeof datos === "function") entorno = datos;

  try {
    carpetaLogs = path.join(app.getPath("userData"), "logs");
    fs.mkdirSync(carpetaLogs, { recursive: true });
    archivoLog = path.join(carpetaLogs, "launcher.log");
  } catch {
    carpetaLogs = null;
    archivoLog = null;
    return;
  }

  for (const nivel of ["warn", "error"]) {
    const original = console[nivel].bind(console);
    console[nivel] = (...partes) => {
      original(...partes);
      escribir(nivel, partes);
    };
  }

  escribir("info", [
    "── inicio",
    `v${app.getVersion()}`,
    `electron ${process.versions.electron}`,
    `${process.platform} ${process.arch}`,
  ]);

  ipcMain.handle("bling:diagnostico", () => reporte());
  ipcMain.handle("bling:diagnostico-guardar", (evento, texto) =>
    guardar(texto, BrowserWindow.fromWebContents(evento.sender)),
  );
  ipcMain.handle("bling:diagnostico-carpeta", async () => {
    if (carpetaLogs) await shell.openPath(carpetaLogs);
    return carpetaLogs;
  });
}

module.exports = { init, attach, escribir, reporte };
