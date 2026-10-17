/**
 * Genera assets/icon.ico (+ icon.png, tray-icon.png) desde la campana
 * oficial BlingBellNoBg.png (PNG 1962² con alfa). El PNG se embebe como
 * data URI en el SVG que rasteriza resvg — nunca se abre ni se pega en chat.
 *
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

const bellUri =
  "data:image/png;base64," +
  readFileSync(join(assetsDir, "BlingBellNoBg.png")).toString("base64");

// Mismo contenedor que el icono original: tile oscuro #09090b, rx 22 %,
// borde blanco al 8 %. La campana reemplaza al rombo en el centro.
const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#09090b"/>
  <rect x="0.5" y="0.5" width="63" height="63" rx="13.5" fill="none" stroke="#ffffff" stroke-opacity="0.08"/>
  <image href="${bellUri}" x="7" y="7" width="50" height="50"/>
</svg>`;

function render(svg, width) {
  return new Resvg(svg, { fitTo: { mode: "width", value: width } })
    .render()
    .asPng();
}

// PNG de referencia (512) e ICO con los tamaños que usa Windows.
writeFileSync(join(assetsDir, "icon.png"), render(iconSvg, 512));

const ico = await pngToIco([
  render(iconSvg, 16),
  render(iconSvg, 24),
  render(iconSvg, 32),
  render(iconSvg, 48),
  render(iconSvg, 64),
  render(iconSvg, 128),
  render(iconSvg, 256),
]);
writeFileSync(join(assetsDir, "icon.ico"), ico);

// Icono de bandeja: la campana sola, sobre transparente. Se entrega a 32
// (Windows lo reescala a 16 en la taskbar); el PNG lleva alfa.
const traySvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <image href="${bellUri}" width="64" height="64"/>
</svg>`;
writeFileSync(join(assetsDir, "tray-icon.png"), render(traySvg, 32));

console.log("OK: assets/icon.ico + assets/icon.png + assets/tray-icon.png");
