"use strict";

const { Tray, Menu, app } = require("electron");
const path = require("node:path");

/**
 * Bandeja del sistema.
 *
 * Sólo existe si el usuario la encendió en Ajustes. Clic en el ícono o
 * en "Abrir Bling Launcher" restaura la ventana del hub; "Salir" cierra
 * todo de verdad (a diferencia de cerrar la ventana, que va a la bandeja).
 *
 * El hub no se busca entre todas las ventanas: puede haber varias de
 * servicios embebidos abiertas. Quien sabe cuál es el hub es el proceso
 * principal, que pasa `getHub` al construir la bandeja.
 */
let tray = null;
/** Devuelve la ventana del hub, o null si no existe. */
let getHub = () => null;

function iconPath() {
  return path.join(__dirname, "..", "assets", "tray-icon.png");
}

/** Devuelve la ventana del hub enfocable, o null. */
function hubVivo() {
  const hub = getHub();
  return hub && !hub.isDestroyed() ? hub : null;
}

function focusearLauncher() {
  const hub = hubVivo();
  if (!hub) return;
  if (hub.isMinimized()) hub.restore();
  hub.show();
  hub.focus();
}

/** Construye el menú contextual con los servicios disponibles. */
function buildMenu(servicios) {
  const items = [
    { label: "Abrir Bling Launcher", click: focusearLauncher },
    { type: "separator" },
  ];

  if (Array.isArray(servicios) && servicios.length) {
    items.push({
      label: "Servicios",
      submenu: servicios.map((s) => ({
        label: s.name,
        click: () => {
          // Pide al renderer que abra el servicio: reutiliza la misma
          // allowlist y el registro de recientes que ya existen.
          focusearLauncher();
          hubVivo()?.webContents.send("tray:open-service", s.id);
        },
      })),
    });
    items.push({ type: "separator" });
  }

  items.push({
    label: "Salir",
    click: () => app.quit(),
  });

  return Menu.buildFromTemplate(items);
}

/**
 * Crea (o destruye) la bandeja según el ajuste.
 * `servicios` es el catálogo del renderer, para el submenú.
 */
function setEnabled(enabled, servicios) {
  if (!enabled) {
    if (tray) {
      tray.destroy();
      tray = null;
    }
    return;
  }
  if (tray) return; // ya existe: sólo refrescar el menú

  tray = new Tray(iconPath());
  tray.setToolTip("Bling Launcher");
  tray.setContextMenu(buildMenu(servicios));
  // Doble clic / clic izquierdo en el ícono restaura el hub.
  tray.on("click", focusearLauncher);
  tray.on("double-click", focusearLauncher);
}

/** Refresca el menú (p. ej. cuando cambia el catálogo de servicios). */
function refresh(servicios) {
  if (tray) tray.setContextMenu(buildMenu(servicios));
}

/**
 * El proceso principal inyecta cómo encontrar el hub. Se registra antes
 * de crear la bandeja para que los clicks ya resuelvan la ventana.
 */
function setHubGetter(fn) {
  if (typeof fn === "function") getHub = fn;
}

module.exports = { setEnabled, refresh, setHubGetter };

