"use strict";

const { contextBridge, ipcRenderer } = require("electron");

// API mínima y tipada hacia el renderer. Sin nodeIntegration: el renderer
// sólo puede pedir estas cuatro cosas.
contextBridge.exposeInMainWorld("bling", {
  openService: (service) => ipcRenderer.invoke("bling:open-service", service),
  openExternal: (url) => ipcRenderer.invoke("bling:open-external", url),
  minimize: () => ipcRenderer.send("bling:minimize"),
  close: () => ipcRenderer.send("bling:close"),
});
