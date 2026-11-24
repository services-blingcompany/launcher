"use strict";

const { app, net, ipcMain, BrowserWindow, shell } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const http = require("node:http");
const { execFile, spawn } = require("node:child_process");
const auth = require("./auth.cjs");
const logica = require("./licenciasLogica.cjs");
const equipo = require("./equipo.cjs");
const { esAliasRequerido } = require("./paseNavegador.cjs");

/**
 * Licencias de apps: catálogo remoto, descarga de binarios y apertura de
 * la app nativa.
 *
 * Catálogo y datos de descarga salen del backend vía la ventana puente de
 * bling.uy (mismo origen que la sesión; sin tocar CORS y con el mismo reto
 * de Cloudflare que ya resuelve auth.cjs). Los binarios viven en un bucket
 * R2 privado: el backend entrega una URL firmada corta, la descarga baja
 * directo del bucket y recién tras verificar el sha256 informado queda
 * guardada en `userData/apps/{key}/` con su manifest.
 *
 * La app descargada es un instalador (NSIS): "instalar" es ejecutarlo; en
 * cuanto aparezca el exe instalado, se le entrega su ticket de licencia.
 *
 * Apertura de la app nativa (el contable no tiene sesión propia): se pide
 * un ticket al backend con la sesión del launcher (POST .../ticket), se
 * monta un canal local de UN solo uso en 127.0.0.1 y se spawnea el exe con
 * `--bling-ticket=puerto:nonce`. Si la app ya estaba corriendo, la entrega
 * llega por second-instance. El ticket de 7 días lo renueva después la
 * propia app contra /renew; acá sólo se consigue y se entrega.
 */

/** Vida máxima de una descarga: corta a propósito (la URL firmada dura 5 min). */
const DESCARGA_TIMEOUT_MS = 15 * 60 * 1000;

/** Ventana del canal local que entrega el ticket al spawnear la app. */
const CANAL_TIMEOUT_MS = 30 * 1000;

/** Cuánto se espera a que NSIS copie el exe tras lanzar el instalador. */
const ESPERA_EJECUTABLE_MS = 120 * 1000;

/** Keys que ya están bajando (no se descarga la misma app dos veces a la vez). */
const enCurso = new Set();

/** Carpeta / manifest de una app descargada. */
function dirApp(key) {
  return path.join(app.getPath("userData"), "apps", key);
}

function manifestPath(key) {
  return path.join(dirApp(key), "manifest.json");
}

/** Versión descargada de una app, o null si no hay (o el manifest está roto). */
function instalado(key) {
  if (!logica.esClaveValida(key)) return null;
  try {
    const m = logica.parsearManifest(fs.readFileSync(manifestPath(key), "utf8"));
    if (!m) return null;
    const archivo = path.join(dirApp(key), m.archivo);
    if (!fs.existsSync(archivo)) return null;
    return { version: m.version, archivo, sha256: m.sha256 || "" };
  } catch {
    return null;
  }
}

/** Aviso de progreso a todas las ventanas (patrón de update:progress). */
function aviso(payload) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send("licencias:progreso", payload);
  }
}

/**
 * Fetch al backend desde adentro del puente (same-origin bling.uy). Devuelve
 * { status, datos } o tira si el puente no está (sin sesión / sin reto).
 * GET por defecto; POST para pedir el ticket de una app.
 */
async function getBackend(ruta, metodo = "GET", cuerpo = null) {
  const r = await auth.enPagina(`(async () => {
    const token = localStorage.getItem('access_token');
    const cuerpo = ${JSON.stringify(cuerpo)};
    const headers = token ? { Authorization: 'Bearer ' + token } : {};
    if (cuerpo) headers['Content-Type'] = 'application/json';
    const res = await fetch(${JSON.stringify(ruta)}, {
      method: ${JSON.stringify(metodo)},
      credentials: 'include', cache: 'no-store',
      headers,
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
    return { status: res.status, datos: await res.json().catch(() => null) };
  })()`);
  const resultado = r || { status: 0, datos: null };
  // Cuenta sin alias: el backend no deja seguir hasta elegirlo.
  if (esAliasRequerido(resultado.status, resultado.datos)) void auth.abrirElegirAlias();
  return resultado;
}

/** Catálogo de apps con los flags de licencia del usuario de la sesión. */
async function catalogo() {
  try {
    const r = await getBackend("/api/v1/licenses");
    if (r.status === 401) return { ok: false, codigo: "sin-sesion" };
    if (r.status !== 200) return { ok: false, codigo: logica.codigoDeEstado(r.status) };
    const apps = Array.isArray(r.datos && r.datos.apps) ? r.datos.apps : [];
    return { ok: true, apps, plataforma: logica.plataformaDe(process.platform, process.arch) };
  } catch {
    return { ok: false, codigo: "sin-conexion" };
  }
}

/**
 * Descarga el binario de una app: pide la URL firmada al backend, baja el
 * archivo del bucket calculando el sha256 sobre la marcha y sólo lo guarda
 * si la integridad cierra. Progreso por push en "licencias:progreso".
 */
async function descargar(key) {
  if (!logica.esClaveValida(key)) return { ok: false, codigo: "sin-version" };
  if (enCurso.has(key)) return { ok: false, codigo: "en-curso" };
  enCurso.add(key);

  try {
    const plataforma = logica.plataformaDe(process.platform, process.arch);
    const info = await getBackend(
      `/api/v1/licenses/${encodeURIComponent(key)}/download?platform=${encodeURIComponent(plataforma)}`,
    );
    if (info.status !== 200) return { ok: false, codigo: logica.codigoDeEstado(info.status) };

    const datos = info.datos || {};
    if (!datos.url || !datos.sha256) return { ok: false, codigo: "servidor" };

    const dir = dirApp(key);
    fs.mkdirSync(dir, { recursive: true });
    const nombre = logica.nombreArchivo({ url: datos.url, key, version: datos.version });
    const destino = path.join(dir, nombre);
    const temporal = `${destino}.part`;

    const resultado = await bajarArchivo(datos.url, temporal, (p) => {
      aviso({ key, transferidos: p.transferidos, total: p.total });
    });

    if (!logica.integridadOk(resultado.sha256, datos.sha256)) {
      // Un archivo que no coincide con el sha256 publicado no se guarda
      // ni se ofrece a instalar: se borra y se cuenta el motivo.
      fs.rmSync(temporal, { force: true });
      return { ok: false, codigo: "integridad" };
    }

    fs.renameSync(temporal, destino);
    fs.writeFileSync(
      manifestPath(key),
      JSON.stringify(
        {
          version: datos.version,
          archivo: nombre,
          sha256: resultado.sha256,
          descargadoEn: new Date().toISOString(),
        },
        null,
        2,
      ),
    );

    aviso({ key, transferidos: resultado.transferidos, total: resultado.transferidos, listo: true });
    return { ok: true, key, version: datos.version, archivo: destino };
  } catch {
    return { ok: false, codigo: "red" };
  } finally {
    enCurso.delete(key);
  }
}

/** Baja la URL a disco en streaming, calculando sha256 y avisando progreso. */
async function bajarArchivo(url, destino, onProgreso) {
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), DESCARGA_TIMEOUT_MS);
  try {
    const res = await net.fetch(url, { signal: control.signal });
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

    const total = Number(res.headers.get("content-length")) || 0;
    const hash = crypto.createHash("sha256");
    const salida = fs.createWriteStream(destino);
    const lector = res.body.getReader();
    let transferidos = 0;
    let ultimoAviso = 0;

    for (;;) {
      const { done, value } = await lector.read();
      if (done) break;
      if (!value || !value.length) continue;
      hash.update(value);
      transferidos += value.length;
      if (!salida.write(Buffer.from(value))) {
        await new Promise((r) => salida.once("drain", r));
      }
      const ahora = Date.now();
      if (onProgreso && ahora - ultimoAviso > 200) {
        ultimoAviso = ahora;
        onProgreso({ transferidos, total });
      }
    }

    await new Promise((resolve, reject) =>
      salida.end((err) => (err ? reject(err) : resolve())),
    );
    return { sha256: hash.digest("hex"), transferidos };
  } finally {
    clearTimeout(reloj);
  }
}

/**
 * Raíces donde NSIS puede haber instalado (por usuario y por máquina).
 * electron-builder instala por usuario en %LOCALAPPDATA%\\Programs; Tauri
 * (Contable desde 1.1) en %LOCALAPPDATA% directo. Sin esa raíz, Contable
 * instalado nunca aparecía como instalado.
 */
function raicesInstalacion() {
  const local = process.env.LOCALAPPDATA || "";
  return [
    local ? path.join(local, "Programs") : "",
    local,
    process.env.ProgramFiles || "",
  ].filter(Boolean);
}

/** DisplayVersion de una clave del registro, o null (no existe, error, no Windows). */
function leerRegistro(raiz, clave) {
  return new Promise((resolve) => {
    execFile(
      "reg",
      ["query", `${raiz}\\${clave}`, "/v", "DisplayVersion"],
      { windowsHide: true, timeout: 5000 },
      (err, salida) => resolve(err ? null : logica.leerDisplayVersion(salida)),
    );
  });
}

/**
 * Versión de la app nativa instalada (la que escribe su instalador en el
 * registro), o null si no está instalada o no se sabe. Con esto el launcher
 * ofrece «Actualizar» cuando el catálogo tiene una más nueva.
 */
async function versionInstalada(key) {
  if (process.platform !== "win32" || !ejecutable(key)) return null;
  const clave = logica.claveDesinstalacion(key);
  if (!clave) return null;
  return (await leerRegistro("HKCU", clave)) || (await leerRegistro("HKLM", clave));
}

/** Primera candidata del exe instalado que existe en disco, o null. */
function ejecutable(key) {
  if (!logica.esClaveValida(key)) return null;
  return (
    logica.ejecutablesPara(key, raicesInstalacion()).find((ruta) => fs.existsSync(ruta)) ||
    null
  );
}

/**
 * Pide el ticket de acceso de la app al backend, con la sesión del launcher.
 * Sólo con licencia vigente: 401 sin sesión, 403 sin licencia (mismos
 * códigos que el resto del módulo).
 */
async function pedirTicket(key, reemplazar = null) {
  if (!logica.esClaveValida(key)) return { ok: false, codigo: "sin-version" };
  // Cada apertura dice desde qué equipo: el backend limita cuántos usa cada
  // persona según su plan y ata el ticket a éste.
  const dispositivo = equipo.obtener(logica.plataformaDe(process.platform, process.arch));
  try {
    const r = await getBackend(
      `/api/v1/licenses/${encodeURIComponent(key)}/ticket`,
      "POST",
      { dispositivo, reemplazar: Number.isInteger(reemplazar) ? reemplazar : null },
    );
    if (r.status === 409 && r.datos && r.datos.codigo === "limite-equipos") {
      return {
        ok: false,
        codigo: "limite-equipos",
        limite: r.datos.limite,
        equipos: Array.isArray(r.datos.equipos) ? r.datos.equipos : [],
      };
    }
    if (r.status !== 200 || !r.datos || !r.datos.ticket) {
      return { ok: false, codigo: logica.codigoDeEstado(r.status) };
    }
    return {
      ok: true,
      ticket: r.datos.ticket,
      expiresAt: r.datos.expiresAt || null,
      huella: dispositivo.huella,
    };
  } catch {
    return { ok: false, codigo: "red" };
  }
}

/**
 * Canal local de UN solo uso: queda escuchando en 127.0.0.1 en un puerto
 * efímero y entrega el ticket a quien llegue con el nonce correcto; a los
 * demás, 404. Si nadie lo pide en CANAL_TIMEOUT_MS se cierra. Devuelve
 * { puerto, nonce, llego } (llego resuelve true si se entregó).
 */
function crearCanalTicket(entrega) {
  const nonce = crypto.randomBytes(16).toString("hex");
  let confirmar;
  const llego = new Promise((resolver) => {
    confirmar = resolver;
  });
  const servidor = http.createServer((req, res) => {
    let url = null;
    try {
      url = new URL(req.url, "http://127.0.0.1");
    } catch {
      // URL irresoluble: cae al 404 de abajo.
    }
    if (
      url &&
      req.method === "GET" &&
      url.pathname === "/ticket" &&
      url.searchParams.get("nonce") === nonce
    ) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(entrega));
      terminar(true);
      return;
    }
    res.writeHead(404);
    res.end();
  });
  function terminar(entregado) {
    clearTimeout(reloj);
    servidor.close();
    confirmar(entregado);
  }
  const reloj = setTimeout(() => terminar(false), CANAL_TIMEOUT_MS);
  return new Promise((resolver) => {
    servidor.listen(0, "127.0.0.1", () => {
      resolver({ puerto: servidor.address().port, nonce, llego });
    });
  });
}

/**
 * Abre la app nativa instalada con su ticket: pide el ticket, monta el
 * canal local y la spawnea con el argumento. Si ya estaba corriendo, la
 * segunda instancia recibe los args por second-instance y el ticket llega
 * igual. Sin exe instalado → no-instalada (la UI ofrece descargar/instalar).
 */
async function abrir(key, reemplazar = null) {
  if (!logica.esClaveValida(key)) return { ok: false, codigo: "sin-version" };
  const exe = ejecutable(key);
  if (!exe) return { ok: false, codigo: "no-instalada" };
  const t = await pedirTicket(key, reemplazar);
  if (!t.ok) return t;
  // La app renueva el ticket con la huella: sólo vale en este equipo.
  const canal = await crearCanalTicket({ ticket: t.ticket, expiresAt: t.expiresAt, huella: t.huella });
  try {
    const hijo = spawn(exe, [logica.argumentoTicket(canal.puerto, canal.nonce)], {
      stdio: "ignore",
    });
    // Un error de spawn tardío no es un evento que se pueda ignorar: se
    // traga acá y el timeout del canal resuelve el resultado en false.
    hijo.on("error", () => {});
  } catch {
    void canal.llego; // el canal se cierra con su propio timeout
    return { ok: false, codigo: "red" };
  }
  const entrego = await canal.llego;
  return entrego ? { ok: true } : { ok: false, codigo: "red" };
}

/** Aviso a las ventanas de que el exe de una app apareció (o no) en la PC. */
function avisoEjecutable(key, presente) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send("licencias:ejecutable", { key, presente });
  }
}

/**
 * Tras lanzar el instalador: espera a que NSIS copie el exe (suele
 * autoabrirlo) y en ese caso avisa a la UI y le entrega el ticket solo —
 * si la app quedó corriendo sin ticket, la entrega es por second-instance.
 */
function vigilarEjecutable(key) {
  const inicio = Date.now();
  const reloj = setInterval(() => {
    const exe = ejecutable(key);
    if (!exe && Date.now() - inicio <= ESPERA_EJECUTABLE_MS) return;
    clearInterval(reloj);
    avisoEjecutable(key, Boolean(exe));
    if (exe) void abrir(key);
  }, 1500);
}

/** Ejecuta el instalador ya descargado (NSIS decide cuándo termina). */
async function instalar(key) {
  const guardado = instalado(key);
  if (!guardado) return false;
  const error = await shell.openPath(guardado.archivo);
  if (error) return false; // openPath resuelve con "" cuando abrió bien
  vigilarEjecutable(key);
  return true;
}

/** Registra el IPC del módulo (el renderer sólo llega hasta acá). */
function init() {
  ipcMain.handle("licencias:catalogo", () => catalogo());
  ipcMain.handle("licencias:descargar", (_event, key) => descargar(String(key ?? "")));
  ipcMain.handle("licencias:instalado", (_event, key) => instalado(String(key ?? "")));
  ipcMain.handle("licencias:instalar", (_event, key) => instalar(String(key ?? "")));
  // reemplazar: id del equipo a liberar para abrir en éste (límite de equipos).
  ipcMain.handle("licencias:abrir", (_event, key, reemplazar) =>
    abrir(String(key ?? ""), Number.isInteger(reemplazar) ? reemplazar : null),
  );
  ipcMain.handle("licencias:ejecutable", (_event, key) => Boolean(ejecutable(String(key ?? ""))));
  ipcMain.handle("licencias:version-instalada", (_event, key) =>
    versionInstalada(String(key ?? "")),
  );
}

module.exports = { init, catalogo, descargar, instalado, instalar, abrir, ejecutable, pedirTicket };
