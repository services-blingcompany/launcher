"use strict";

const { contextBridge, ipcRenderer } = require("electron");

/**
 * Puente de la barra de las ventanas de servicio.
 *
 * Es lo único que la barra puede pedir, y ni siquiera sabe sobre qué ventana
 * actúa: el proceso principal resuelve la ventana a partir de quién manda el
 * mensaje. La página del servicio, que vive en otra vista, no tiene preload
 * ni acceso a nada de esto.
 */
contextBridge.exposeInMainWorld("barra", {
  accion: (nombre) => ipcRenderer.send("bling:barra", nombre),
  onEstado: (callback) => {
    const listener = (_evento, estado) => callback(estado);
    ipcRenderer.on("bling:barra-estado", listener);
    return () => ipcRenderer.removeListener("bling:barra-estado", listener);
  },
});
