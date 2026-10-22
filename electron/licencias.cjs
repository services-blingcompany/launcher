"use strict";

const { app, net, ipcMain, BrowserWindow, shell } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const auth = require("./auth.cjs");
const logica = require("./licenciasLogica.cjs");

/**
 * Licencias de apps: catálogo remoto y descarga de binarios.
 *
 * Catálogo y datos de descarga salen del backend vía la ventana puente de
 * bling.uy (mismo origen que la sesión; sin tocar CORS y con el mismo reto
 * de Cloudflare que ya resuelve auth.cjs). Los binarios viven en un bucket
 * R2 privado: el backend entrega una URL firmada corta, la descarga baja
 * directo del bucket y recién tras verificar el sha256 informado queda
 * guardada en `userData/apps/{key}/` con su manifest.
 *
 * La app descargada es un instalador (NSIS): "instalar" es ejecutarlo. El
 * manifest recuerda qué versión hay en disco para no volver a bajarla.
 */

/** Vida máxima de una descarga: corta a propósito (la URL firmada dura 5 min). */
const DESCARGA_TIMEOUT_MS = 15 * 60 * 1000;

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
 * GET al backend desde adentro del puente (same-origin bling.uy). Devuelve
 * { status, datos } o tira si el puente no está (sin sesión / sin reto).
 */
async function getBackend(ruta) {
  const r = await auth.enPagina(`(async () => {
    const token = localStorage.getItem('access_token');
    const res = await fetch(${JSON.stringify(ruta)}, {
      credentials: 'include', cache: 'no-store',
      headers: token ? { Authorization: 'Bearer ' + token } : {},
    });
    return { status: res.status, datos: await res.json().catch(() => null) };
  })()`);
  return r || { status: 0, datos: null };
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

/** Ejecuta el instalador ya descargado (NSIS decide cuándo termina). */
async function instalar(key) {
  const guardado = instalado(key);
  if (!guardado) return false;
  const error = await shell.openPath(guardado.archivo);
  return !error; // openPath resuelve con "" cuando abrió bien
}

/** Registra el IPC del módulo (el renderer sólo llega hasta acá). */
function init() {
  ipcMain.handle("licencias:catalogo", () => catalogo());
  ipcMain.handle("licencias:descargar", (_event, key) => descargar(String(key ?? "")));
  ipcMain.handle("licencias:instalado", (_event, key) => instalado(String(key ?? "")));
  ipcMain.handle("licencias:instalar", (_event, key) => instalar(String(key ?? "")));
}

module.exports = { init, catalogo, descargar, instalado, instalar };
