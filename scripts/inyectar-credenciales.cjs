"use strict";

/**
 * Inyecta las credenciales OAuth de Google en electron/credentials.cjs antes de
 * empaquetar. El secret NO se commitea (el repo es p�blico): se toma de las
 * variables de entorno en el momento del build y se escribe en un archivo que
 * electron-builder empaqueta dentro del .asar.
 *
 * Uso (en el build):
 *   BLING_GOOGLE_CLIENT_ID=... BLING_GOOGLE_CLIENT_SECRET=... npm run dist
 *
 * Con PKCE la seguridad no depende del secret, pero as� evitamos dejarlo en Git.
 */

const fs = require("node:fs");
const path = require("node:path");

const client_id =
  process.env.BLING_GOOGLE_CLIENT_ID ||
  "872789804159-kv6bg1e60eh2iqv719dtnutqkh0nvlbk.apps.googleusercontent.com";
const client_secret = process.env.BLING_GOOGLE_CLIENT_SECRET || "";

if (!client_secret) {
  console.error(
    "\n[inyectar-credenciales] Falta BLING_GOOGLE_CLIENT_SECRET.\n" +
      "  Seteala antes de empaquetar, p. ej.:\n" +
      "    BLING_GOOGLE_CLIENT_SECRET=... npm run dist\n" +
      "  El ejecutable no podr� iniciar sesi�n con Google sin ella.\n"
  );
  process.exit(1);
}

const destino = path.join(__dirname, "..", "electron", "credentials.cjs");
const contenido = `// Generado por scripts/inyectar-credenciales.cjs en el build. No commitear.
"use strict";
module.exports = {
  GOOGLE_CLIENT_ID: ${JSON.stringify(client_id)},
  GOOGLE_CLIENT_SECRET: ${JSON.stringify(client_secret)},
};
`;

fs.writeFileSync(destino, contenido, "utf8");
console.log("[inyectar-credenciales] electron/credentials.cjs escrito para el build.");
