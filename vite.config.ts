import { defineConfig } from "vite";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * Content Security Policy del renderer.
 *
 * El hub no pide nada por red —todo pasa por IPC— y el CSS y las fuentes las
 * sirve el propio bundle, así que la política puede ser cerrada. Lo único
 * que se afloja es img-src: los avatares llegan por https desde bling.uy.
 *
 * Va en el build y no en dev porque el servidor de Vite necesita su
 * websocket. Electron avisa en cada arranque cuando no hay CSP: sin esto,
 * un XSS en el renderer tendría la puerta abierta a script inline.
 */
const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  // Los subconjuntos chicos de fuente los incrusta Vite como data: URI.
  "font-src 'self' data:",
  "connect-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

function cspPlugin(): Plugin {
  return {
    name: "bling-csp",
    apply: "build",
    transformIndexHtml(html) {
      const meta = `<meta http-equiv="Content-Security-Policy" content="${CSP}" />`;
      return html.replace("<head>", `<head>\n    ${meta}`);
    },
  };
}

// base: "./" es imprescindible: en el empaquetado el renderer se sirve
// desde file:// y las rutas absolutas (/assets/...) no resolverían.
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss(), cspPlugin()],
  build: {
    outDir: "dist",
    assetsDir: "assets",
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
