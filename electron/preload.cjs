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
  /** Vacía la lista de recientes. Devuelve la lista (vacía). */
  clearRecents: () => ipcRenderer.invoke("bling:recents-clear"),

  // ── Ajustes ──
  getSettings: () => ipcRenderer.invoke("bling:settings-get"),
  /** Cambia un ajuste booleano. Devuelve los ajustes ya actualizados. */
  setSetting: (key, value) =>
    ipcRenderer.invoke("bling:settings-set", key, value),
  /** Manda el catálogo al proceso principal (para el menú de bandeja). */
  setCatalog: (servicios) => ipcRenderer.send("bling:set-catalog", servicios),
  /** El proceso principal pide abrir un servicio vía bandeja. */
  onOpenService: (callback) => {
    const listener = (_event, id) => callback(id);
    ipcRenderer.on("tray:open-service", listener);
    return () => ipcRenderer.removeListener("tray:open-service", listener);
  },

  // ── Sesión ──
  /** Perfil de la sesión activa, o null si no hay nadie logueado. */
  authStatus: () => ipcRenderer.invoke("auth:status"),
  /** Login nativo. Devuelve { ok, user?, error?, necesitaVerificar? }. */
  authLogin: (credenciales) => ipcRenderer.invoke("auth:login", credenciales),
  /** Cierra sesión en el backend y borra las cookies del jar compartido. */
  authLogout: () => ipcRenderer.invoke("auth:logout"),
  /** Contador de notificaciones sin leer (0 sin sesión). */
  authNotifications: () => ipcRenderer.invoke("auth:notifications"),
  /** El main avisa cuando la sesión cambia (login, expiración o cierre). */
  onAuthChanged: (callback) => {
    const listener = (_event, user) => callback(user);
    ipcRenderer.on("auth:changed", listener);
    return () => ipcRenderer.removeListener("auth:changed", listener);
  },

  // ── Diagnóstico ──
  /** Reporte de entorno y últimas líneas del registro, sin datos de la cuenta. */
  getDiagnostics: () => ipcRenderer.invoke("bling:diagnostico"),
  /** Guarda el reporte como .txt. Devuelve la ruta elegida, o null. */
  saveDiagnostics: (texto) =>
    ipcRenderer.invoke("bling:diagnostico-guardar", texto),
  /** Abre la carpeta del registro en el explorador. */
  openLogsFolder: () => ipcRenderer.invoke("bling:diagnostico-carpeta"),

  // ── Actualizaciones ──
  appVersion: () => ipcRenderer.invoke("bling:app-version"),
  checkForUpdates: () => ipcRenderer.invoke("update:check"),
  dismissUpdate: (version) => ipcRenderer.send("update:dismiss", version),
  openUpdateLink: (url) => ipcRenderer.invoke("update:open", url),
  /** Descarga la versión disponible (no instala todavía). */
  downloadUpdate: () => ipcRenderer.invoke("update:download"),
  /** Cierra la app y lanza el instalador ya descargado. */
  installUpdate: () => ipcRenderer.send("update:install"),
  /** Suscripción al aviso push que emite el main al encontrar versión. */
  onUpdateAvailable: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("update:available", listener);
    return () => ipcRenderer.removeListener("update:available", listener);
  },
  /** Progreso de descarga (null cuando no hay descarga en curso). */
  onUpdateProgress: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("update:progress", listener);
    return () => ipcRenderer.removeListener("update:progress", listener);
  },
  /** La versión nueva ya bajó y está lista para instalar. */
  onUpdateDownloaded: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("update:downloaded", listener);
    return () => ipcRenderer.removeListener("update:downloaded", listener);
  },
});
