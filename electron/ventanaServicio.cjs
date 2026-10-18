"use strict";

const { BaseWindow, WebContentsView, ipcMain } = require("electron");
const path = require("node:path");
const contextMenu = require("./contextMenu.cjs");
const diagnostics = require("./diagnostics.cjs");

/**
 * Ventanas de servicio.
 *
 * Cada servicio abre una ventana propia con la barra del launcher arriba
 * (atrás, adelante, recargar, título, abrir en el navegador y controles de
 * ventana) y la página del servicio abajo, en una vista aparte.
 *
 * Es una BaseWindow con dos vistas hermanas, cada una con su rectángulo: la
 * barra mide siempre 36 px y la página ocupa el resto. La página del
 * servicio no lleva preload —no puede pedirle nada al proceso principal,
 * igual que antes—; la barra sí, pero sólo acciones de su ventana, y es el
 * proceso principal el que resuelve de cuál se trata según quién lo pide.
 */
const ALTO_BARRA = 36;

/** serviceId → { ventana, barra, contenido } (una ventana por servicio). */
const abiertas = new Map();
/** webContents.id de la barra → la misma entrada, para resolver el IPC. */
const porBarra = new Map();

/** Colaboradores que vienen de main.cjs (evita require circular). */
let esUrlPermitida = () => false;
let abrirExterno = () => {};
let attachZoom = () => {};
let zoomGuardado = () => 0;

/** Cuántas ventanas de servicio hay abiertas. */
function cantidad() {
  return abiertas.size;
}

/** Lo que la barra necesita saber de la ventana, en un solo objeto. */
function avisar({ ventana, barra, contenido, nombre }) {
  if (ventana.isDestroyed() || barra.webContents.isDestroyed()) return;
  const wc = contenido.webContents;
  const tituloPagina = wc.getTitle();
  barra.webContents.send("bling:barra-estado", {
    atras: wc.navigationHistory.canGoBack(),
    adelante: wc.navigationHistory.canGoForward(),
    cargando: wc.isLoading(),
    // La barra dice el nombre del servicio (lo que el usuario abrió); el
    // título de la página queda como detalle al pasar el mouse.
    titulo: nombre || tituloPagina || "Bling",
    detalle: tituloPagina || "",
    maximizada: ventana.isMaximized(),
  });
}

/** Aplica el zoom a las páginas embebidas (la barra no cambia de tamaño). */
function setZoom(nivel) {
  for (const { ventana, contenido } of abiertas.values()) {
    if (!ventana.isDestroyed()) contenido.webContents.setZoomLevel(nivel);
  }
}

/** Ejecuta una acción de la barra sobre esa ventana (botón o atajo). */
function accionar(registro, nombre) {
  if (!registro) return;
  const { ventana, contenido } = registro;
  if (ventana.isDestroyed()) return;
  const wc = contenido.webContents;

  switch (nombre) {
    case "atras":
      wc.navigationHistory.goBack();
      break;
    case "adelante":
      wc.navigationHistory.goForward();
      break;
    case "recargar":
      wc.reload();
      break;
    case "externo":
      abrirExterno(wc.getURL());
      break;
    case "minimizar":
      ventana.minimize();
      break;
    case "maximizar":
      if (ventana.isMaximized()) ventana.unmaximize();
      else ventana.maximize();
      break;
    case "cerrar":
      ventana.close();
      break;
    default:
      return;
  }
  avisar(registro);
}

/**
 * Atajos de navegación, como en un navegador: F5 y Ctrl R recargan, Alt y
 * las flechas van atrás o adelante, y Ctrl W cierra la ventana. Electron no
 * trae ninguno con el menú de la app apagado, así que se atienden a mano
 * sobre la página del servicio (que no tiene renderer propio que los lea).
 */
function attachAtajos(wc, registro) {
  wc.on("before-input-event", (evento, tecla) => {
    if (tecla.type !== "keyDown") return;
    const key = String(tecla.key || "").toLowerCase();
    let accion = null;
    if (tecla.key === "F5" || (tecla.control && !tecla.shift && key === "r")) accion = "recargar";
    else if (tecla.control && key === "w") accion = "cerrar";
    else if (tecla.alt && tecla.key === "ArrowLeft") accion = "atras";
    else if (tecla.alt && tecla.key === "ArrowRight") accion = "adelante";
    if (!accion) return;
    evento.preventDefault();
    accionar(registro, accion);
  });
}

/**
 * Abre un servicio embebido en su propia ventana. Si ya está abierto, sólo
 * la enfoca (idempotente, como un launcher de verdad).
 */
function abrir({ id, url, title }) {
  if (!esUrlPermitida(url)) return false;

  const existente = abiertas.get(id);
  if (existente && !existente.ventana.isDestroyed()) {
    const { ventana } = existente;
    if (ventana.isMinimized()) ventana.restore();
    ventana.show();
    ventana.focus();
    return true;
  }

  const ventana = new BaseWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    frame: false, // la barra es nuestra, como la titlebar del hub
    backgroundColor: "#09090b",
    title: title || "Bling",
    icon: path.join(__dirname, "..", "assets", "icon.ico"),
  });

  // Arriba la barra (con preload y acceso al main), abajo la página del
  // servicio (sin preload: no puede pedir nada).
  const barra = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, "barra-servicio-preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  const contenido = new WebContentsView({
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  ventana.contentView.addChildView(barra);
  ventana.contentView.addChildView(contenido);

  const entrada = { ventana, barra, contenido, nombre: title || "" };
  const idBarra = barra.webContents.id;
  abiertas.set(id, entrada);
  porBarra.set(idBarra, entrada);

  const acomodar = () => {
    if (ventana.isDestroyed()) return;
    const [ancho, alto] = ventana.getContentSize();
    barra.setBounds({ x: 0, y: 0, width: ancho, height: ALTO_BARRA });
    contenido.setBounds({
      x: 0,
      y: ALTO_BARRA,
      width: ancho,
      height: Math.max(0, alto - ALTO_BARRA),
    });
  };
  acomodar();
  ventana.on("resize", acomodar);
  for (const evento of ["maximize", "unmaximize", "restore"]) {
    ventana.on(evento, () => {
      acomodar();
      avisar(entrada);
    });
  }

  // La ventana aparece apenas está lista la barra (no espera al sitio).
  barra.webContents.once("did-finish-load", () => ventana.show());

  const wc = contenido.webContents;

  // Navegación interna al mismo dominio queda en la ventana del servicio;
  // todo lo demás se abre en el navegador del sistema.
  wc.setWindowOpenHandler(({ url: destino }) => {
    abrirExterno(destino);
    return { action: "deny" };
  });
  wc.on("will-navigate", (evento, destino) => {
    if (!esUrlPermitida(destino)) {
      evento.preventDefault();
      abrirExterno(destino);
    }
  });

  // La barra refleja lo que pasa en la página: título, navegación y carga.
  wc.on("page-title-updated", (_evento, nuevo) => {
    ventana.setTitle(nuevo);
    avisar(entrada);
  });
  for (const evento of [
    "did-start-loading",
    "did-stop-loading",
    "did-navigate",
    "did-navigate-in-page",
    "did-fail-load",
  ]) {
    wc.on(evento, () => avisar(entrada));
  }

  // Dentro de los servicios el clic derecho hace falta igual (o más):
  // copiar texto, pegar, copiar el enlace de una nota o el alias de alguien.
  contextMenu.attach({
    webContents: wc,
    ventana,
    esDelSitio: esUrlPermitida,
    cargar: (destino) => wc.loadURL(destino),
  });

  // Zoom: acá no hay renderer propio que atienda los atajos, así que se
  // aplican desde el proceso principal sobre la página embebida. Igual que
  // los atajos de navegación (F5, Ctrl R, Ctrl W, Alt + flechas).
  wc.setZoomLevel(zoomGuardado());
  attachZoom(wc);
  attachAtajos(wc, entrada);

  diagnostics.attachContenido(barra.webContents, `barra:${id}`);
  diagnostics.attachContenido(wc, `servicio:${id}`);

  ventana.on("closed", () => {
    porBarra.delete(idBarra);
    abiertas.delete(id);
  });

  barra.webContents.loadFile(path.join(__dirname, "barra-servicio.html"));
  wc.loadURL(url);
  diagnostics.escribir("info", [`abriendo ${id}`, url]);
  avisar(entrada);
  return true;
}

function init(opciones = {}) {
  if (typeof opciones.esUrlPermitida === "function") esUrlPermitida = opciones.esUrlPermitida;
  if (typeof opciones.abrirExterno === "function") abrirExterno = opciones.abrirExterno;
  if (typeof opciones.attachZoom === "function") attachZoom = opciones.attachZoom;
  if (typeof opciones.zoomGuardado === "function") zoomGuardado = opciones.zoomGuardado;

  ipcMain.on("bling:barra", (evento, nombre) => {
    accionar(porBarra.get(evento.sender.id), nombre);
  });
}

module.exports = { init, abrir, setZoom, cantidad };
