/**
 * electron-builder sólo escribe resources/app-update.yml cuando construye
 * un instalador (NSIS), no con `--dir`. Ese fichero es el que
 * electron-updater lee para saber desde dónde buscar versiones nuevas.
 *
 * El build local rápido (`npm run local`) usa --dir, así que este script
 * lo escribe a mano derivándolo del `publish` de package.json (fuente
 * única de verdad). Así el paquete local se comporta igual que el
 * instalado y se puede probar el flujo de actualización sin instalar.
 *
 * Uso: node scripts/ensure-app-update-yml.mjs [ruta-a-win-unpacked]
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

const publish = pkg.build?.publish;
if (!publish || publish.provider !== "github") {
  console.log("[app-update] no hay publish de github en package.json; nada que hacer.");
  process.exit(0);
}

const { owner, repo } = publish;
if (!owner || !repo) {
  console.error("[app-update] publish de github sin owner/repo.");
  process.exit(1);
}

// Los archivos van a <win-unpacked>/resources/, pero si se pasa la ruta
// como argumento se respeta (p. ej. para probar otras carpetas).
const target =
  process.argv[2] ??
  join(root, "release", "win-unpacked", "resources", "app-update.yml");

if (existsSync(target)) {
  console.log(`[app-update] ya existe: ${target}`);
  process.exit(0);
}

mkdirSync(dirname(target), { recursive: true });
const content =
  `owner: ${owner}\n` +
  `repo: ${repo}\n` +
  `provider: ${publish.provider}\n` +
  `updaterCacheDirName: ${pkg.name}-updater\n`;
writeFileSync(target, content);
console.log(`[app-update] escrito: ${target}`);
