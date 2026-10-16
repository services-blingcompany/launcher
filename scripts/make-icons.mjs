/**
 * Genera assets/icon.ico (+ icon.png) a partir del SVG de la marca.
 * Correr una vez: npm run icons  (requiere deps de dev instaladas).
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import pngToIco from "png-to-ico";

const here = dirname(fileURLToPath(import.meta.url));
const assetsDir = join(here, "..", "assets");
mkdirSync(assetsDir, { recursive: true });

const svg = readFileSync(join(assetsDir, "icon.svg"), "utf8");

function renderPng(width) {
  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: width } });
  return resvg.render().asPng();
}

// PNG de referencia (512) e ICO con los tamaños que usa Windows.
writeFileSync(join(assetsDir, "icon.png"), renderPng(512));

const ico = await pngToIco([
  renderPng(16),
  renderPng(24),
  renderPng(32),
  renderPng(48),
  renderPng(64),
  renderPng(128),
  renderPng(256),
]);
writeFileSync(join(assetsDir, "icon.ico"), ico);

console.log("OK: assets/icon.ico + assets/icon.png");
