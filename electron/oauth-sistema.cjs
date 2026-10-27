"use strict";

/**
 * Inicio de sesi�n con Google en el NAVEGADOR DEL SISTEMA (no una ventana del
 * launcher). As� el usuario usa la cuenta de Google que ya tiene abierta y no
 * tiene que recordarla.
 *
 * C�mo funciona (OAuth 2.0 para apps nativas, RFC 8252):
 *  1. Se levanta un servidor local en 127.0.0.1 en un puerto ef�mero.
 *  2. Se abre el navegador del sistema en la URL de autorizaci�n de Google con
 *     `response_type=code`, PKCE (code_challenge) y `state` anti-CSRF.
 *  3. El usuario confirma con su cuenta (Google ya lo conoce).
 *  4. Google redirige el navegador a http://127.0.0.1:<puerto>?code=...&state=...
 *  5. El servidor local valida el `state`, muestra "ya pod�s cerrar esta pesta�a"
 *     y canjea el `code` por un access_token contra oauth2.googleapis.com.
 *
 * Se devuelve el access_token de Google; quien llama lo manda a
 * /api/auth/social igual que har�a la web.
 *
 * Es l�gica pura + red: el canje y el armado de la URL se prueban solos.
 */

const http = require("node:http");
const crypto = require("node:crypto");
const { shell } = require("electron");

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "openid email profile";

/** Espera m�xima para que el usuario termine de entrar (5 minutos). */
const ESPERA_MS = 5 * 60 * 1000;

const base64url = (buf) =>
  buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** code_challenge PKCE (S256) a partir del code_verifier. */
function retoPkce(verifier) {
  return base64url(crypto.createHash("sha256").update(verifier).digest());
}

/** URL de autorizaci�n de Google para el flujo de c�digo + PKCE. */
function urlAutorizacion({ clientId, redirectUri, state, codeChallenge }) {
  const p = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPE,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    prompt: "select_account",
    access_type: "offline",
  });
  return `${AUTH_URL}?${p.toString()}`;
}

/** Canjea el code de autorizaci�n por tokens. */
async function canjearCode({ code, codeVerifier, clientId, clientSecret, redirectUri }) {
  const cuerpo = new URLSearchParams({
    code,
    code_verifier: codeVerifier,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: cuerpo.toString(),
  });
  const datos = await res.json().catch(() => ({}));
  if (!res.ok || !datos.access_token) {
    throw new Error(datos.error_description || datos.error || "Google no devolvió el token");
  }
  return datos;
}

const PAGINA_OK = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>Bling Launcher</title></head><body style="font-family:system-ui;background:#0a0a0a;color:#eee;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center">
<div><h2 style="font-weight:600">Listo ✔</h2><p style="color:#aaa">Ya podés cerrar esta pestaña y volver al Bling Launcher.</p></div>
</body></html>`;

const PAGINA_ERROR = (motivo) => `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>Bling Launcher</title></head><body style="font-family:system-ui;background:#0a0a0a;color:#eee;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center">
<div><h2 style="font-weight:600">No se pudo iniciar sesión</h2><p style="color:#aaa">${motivo}</p></div>
</body></html>`;

/**
 * Corre el flujo completo y devuelve { accessToken, idToken }.
 * Rechaza si el usuario no termina a tiempo o Google devuelve error.
 */
function iniciarSesionGoogle({ clientId, clientSecret }) {
  return new Promise((resolve, reject) => {
    const state = base64url(crypto.randomBytes(16));
    const codeVerifier = base64url(crypto.randomBytes(32));
    const codeChallenge = retoPkce(codeVerifier);
    let terminado = false;

    const server = http.createServer((req, res) => {
      try {
        const url = new URL(req.url, "http://127.0.0.1");
        const codigo = url.searchParams.get("code");
        const estado = url.searchParams.get("state");
        const err = url.searchParams.get("error");

        // Petición ajena al flujo (favicon, CSS, recargas sin code): se ignora
        // sin tocar el estado. Sin esto, el navegador pide /favicon.ico de la
        // página "Listo" y se interpretaba como un state inválido, cancelando
        // el intercambio que ya iba bien.
        if (!codigo && !err) {
          res.writeHead(204);
          res.end();
          return;
        }

        if (err) {
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(PAGINA_ERROR("Cancelaste el acceso con Google."));
          if (!terminado) {
            terminado = true;
            cerrar();
            reject(new Error(err));
          }
          return;
        }

        if (estado !== state) {
          res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
          res.end(PAGINA_ERROR("La verificación de seguridad no coincidió."));
          if (!terminado) {
            terminado = true;
            cerrar();
            reject(new Error("state inválido"));
          }
          return;
        }

        if (!codigo) {
          // El usuario llegó sin code (recargó): no hacemos nada, esperamos.
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(PAGINA_OK);
          return;
        }

        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(PAGINA_OK);

        canjearCode({
          code: codigo,
          codeVerifier,
          clientId,
          clientSecret,
          redirectUri,
        })
          .then((datos) => {
            terminado = true;
            cerrar();
            resolve({ accessToken: datos.access_token, idToken: datos.id_token || null });
          })
          .catch((e) => {
            terminado = true;
            cerrar();
            reject(e);
          });
      } catch (e) {
        terminado = true;
        cerrar();
        reject(e);
      }
    });

    let redirectUri = null;

    function cerrar() {
      clearTimeout(temporizador);
      try {
        server.close();
      } catch {}
    }

    const temporizador = setTimeout(() => {
      if (terminado) return;
      terminado = true;
      cerrar();
      reject(new Error("Tiempo agotado esperando el inicio de sesión con Google"));
    }, ESPERA_MS);

    server.on("error", (e) => {
      if (terminado) return;
      terminado = true;
      cerrar();
      reject(e);
    });

    server.listen(0, "127.0.0.1", () => {
      const puerto = server.address().port;
      redirectUri = `http://127.0.0.1:${puerto}`;
      const authUrl = urlAutorizacion({
        clientId,
        redirectUri,
        state,
        codeChallenge,
      });
      shell.openExternal(authUrl).catch(() => {
        terminado = true;
        cerrar();
        reject(new Error("No se pudo abrir el navegador"));
      });
    });
  });
}

module.exports = { iniciarSesionGoogle, urlAutorizacion, retoPkce, canjearCode, base64url };
