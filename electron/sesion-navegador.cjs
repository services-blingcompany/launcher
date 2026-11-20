"use strict";

/**
 * «Entrar con el navegador»: toma la sesión de Bling que la persona ya tiene
 * abierta en su navegador, sin escribir la contraseña.
 *
 * Mismo esquema que el login de Google para apps nativas (RFC 8252 + PKCE):
 *  1. Se genera un `verifier` secreto y su `challenge` (sha256, base64url).
 *  2. Se levanta un receptor en 127.0.0.1 (puerto efímero).
 *  3. Se abre www.bling.uy/auth/launcher?challenge&state&port en el navegador.
 *     Ahí, con la sesión abierta, la persona confirma «Conectar».
 *  4. La web vuelve a http://127.0.0.1:<puerto>/?codigo=…&state=… .
 *  5. Quien llama canjea el código con el verifier (que nunca sale de acá).
 */

const http = require("node:http");
const crypto = require("node:crypto");
const { shell } = require("electron");
const { base64url, retoPkce } = require("./oauth-sistema.cjs");

const ESPERA_MS = 5 * 60 * 1000;

const PAGINA = (titulo, texto) => `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>Bling Launcher</title></head><body style="font-family:system-ui;background:#0a0a0a;color:#eee;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center">
<div><h2 style="font-weight:600">${titulo}</h2><p style="color:#aaa">${texto}</p></div>
</body></html>`;

/** URL de la página de conexión en la web. */
function urlConectar(sitio, { challenge, state, puerto }) {
  const q = new URLSearchParams({ challenge, state, port: String(puerto) });
  return `${sitio}/auth/launcher?${q.toString()}`;
}

/**
 * Abre el navegador y espera el código. Devuelve { codigo, verifier }.
 * Rechaza si la persona cancela, si el state no coincide o si no termina a tiempo.
 */
function esperarCodigoDelNavegador({ sitio }) {
  return new Promise((resolve, reject) => {
    const state = base64url(crypto.randomBytes(16));
    const verifier = base64url(crypto.randomBytes(32));
    const challenge = retoPkce(verifier);
    let terminado = false;

    const terminar = (error, valor) => {
      if (terminado) return;
      terminado = true;
      clearTimeout(temporizador);
      try {
        server.close();
      } catch {}
      if (error) reject(error);
      else resolve(valor);
    };

    const server = http.createServer((req, res) => {
      const url = new URL(req.url, "http://127.0.0.1");
      const codigo = url.searchParams.get("codigo");
      const error = url.searchParams.get("error");
      // favicon u otras peticiones del navegador: se ignoran.
      if (!codigo && !error) {
        res.writeHead(204);
        res.end();
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      if (url.searchParams.get("state") !== state) {
        res.end(PAGINA("No se pudo conectar", "La verificación de seguridad no coincidió. Probá de nuevo desde el launcher."));
        terminar(new Error("state inválido"));
        return;
      }
      if (error) {
        res.end(PAGINA("Cancelado", "No se conectó el launcher. Podés cerrar esta pestaña."));
        terminar(new Error("cancelado"));
        return;
      }
      res.end(PAGINA("Listo ✔", "Ya podés cerrar esta pestaña y volver al Bling Launcher."));
      terminar(null, { codigo, verifier });
    });

    const temporizador = setTimeout(() => terminar(new Error("tiempo agotado")), ESPERA_MS);
    server.on("error", (e) => terminar(e));
    server.listen(0, "127.0.0.1", () => {
      const puerto = server.address().port;
      shell.openExternal(urlConectar(sitio, { challenge, state, puerto })).catch(() => {
        terminar(new Error("No se pudo abrir el navegador"));
      });
    });
  });
}

module.exports = { esperarCodigoDelNavegador, urlConectar };
