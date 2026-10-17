"use strict";

const { contextBridge, ipcRenderer } = require("electron");

// API mínima y tipada hacia el renderer. Sin nodeIntegration: el renderer
// sólo puede pedir estas cosas.
contextBridge.exposeInMainWorld("bling", {
  openService: (service) => ipcRenderer.invoke("bling:open-service", service),
  openExternal: (url) => ipcRenderer.invoke("bling:open-external", url),
  minimize: () => ipcRenderer.send("bling:minimize"),
  close: () => ipcRenderer.send("bling:close"),

  // ── Recientes ──
  /** Ids de servicios abiertos por última vez, más reciente primero. */
  getRecents: () => ipcRenderer.invoke("bling:recents"),
  /** Registra un servicio como usado. Devuelve la lista ya actualizada. */
  addRecent: (id) => ipcRenderer.invoke("bling:recents-add", id),

  // ── Actualizaciones ──
  appVersion: () => ipcRenderer.invoke("bling:app-version"),
  checkForUpdates: () => ipcRenderer.invoke("update:check"),
  dismissUpdate: (version) => ipcRenderer.send("update:dismiss", version),
  openUpdateLink: (url) => ipcRenderer.invoke("update:open", url),
  /** Suscripción al aviso push que emite el main al encontrar versión. */
  onUpdateAvailable: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("update:available", listener);
    return () => ipcRenderer.removeListener("update:available", listener);
  },
});
