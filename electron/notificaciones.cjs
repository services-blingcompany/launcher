"use strict";

const { BrowserWindow, Notification, ipcMain, nativeImage } = require("electron");
const path = require("node:path");
const diagnostics = require("./diagnostics.cjs");
const settings = require("./settings.cjs");
const tray = require("./tray.cjs");

/**
 * Notificaciones nativas y globito en la barra de tareas.
 *
 * El contador lo sigue pidiendo el renderer (cada minuto, con la sesión del
 * jar compartido) y lo avisa por IPC. Acá se compara con el anterior: si
 * subió, sale el aviso de Windows; mientras haya sin leer, el icono del
 * launcher en la barra de tareas queda marcado.
 *
 * El cuerpo del aviso es genérico a propósito: en la pantalla de bloqueo se
 * lee sin pedir permiso, así que no viaja el texto de la notificación.
 */
let ultimo = -1;
/** Devuelve el hub (para el globito) y abre una ventana de servicio. */
let getHub = () => null;
let abrirServicio = () => false;

/** Misma página que PAGINAS.notificaciones del renderer. */
const NOTIFICACIONES = {
  id: "notificaciones",
  url: "https://bling.uy/bling/notifications",
  title: "Notificaciones",
};

/** Marca (o desmarca) el icono del hub en la barra de tareas. */
function globito(activo) {
  const hub = getHub();
  if (!hub || hub.isDestroyed()) return;
  if (!activo) {
    hub.setOverlayIcon(null, "");
    return;
  }
  const icono = nativeImage.createFromPath(
    path.join(__dirname, "..", "assets", "tray-icon.png"),
  );
  hub.setOverlayIcon(icono, "Tenés notificaciones sin leer");
}

/** Aviso de escritorio nativo, con la bandeja como destino del clic. */
function avisar(conteo) {
  if (!Notification.isSupported()) return;
  const aviso = new Notification({
    title: "Bling",
    body:
      conteo === 1
        ? "Tenés una notificación nueva"
        : `Tenés ${conteo} notificaciones nuevas`,
  });
  aviso.on("click", () => {
    abrirServicio(NOTIFICACIONES.id, NOTIFICACIONES.url, NOTIFICACIONES.title);
  });
  aviso.show();
  diagnostics.escribir("info", [`aviso de escritorio: ${conteo} sin leer`]);
}

/**
 * Nuevo contador (viene del renderer). El primer valor sólo se registra:
 * lo que ya estaba sin leer cuando se abrió la app no es una novedad.
 */
function actualizar(conteo) {
  const subio = ultimo >= 0 && conteo > ultimo;
  globito(conteo > 0);
  tray.setContador(conteo);
  if (subio && settings.load().avisosEscritorio) avisar(conteo);
  ultimo = conteo;
}

function init({ getHub: getHubFn, abrirServicio: abrirServicioFn } = {}) {
  if (typeof getHubFn === "function") getHub = getHubFn;
  if (typeof abrirServicioFn === "function") abrirServicio = abrirServicioFn;

  ipcMain.on("bling:notificaciones", (_evento, conteo) => {
    const n = Number(conteo);
    if (!Number.isFinite(n) || n < 0) return;
    actualizar(n);
  });
}

module.exports = { init };
