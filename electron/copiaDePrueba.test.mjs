import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { esCopiaDePrueba } = require("./copiaDePrueba.cjs");

const instalado = "/home/x/Programs/bling-launcher/Bling Launcher.exe";
const prueba = "/proyectos/launcher/release/win-unpacked/Bling Launcher.exe";
const conDesinstalador = (ruta) => ruta.includes("bling-launcher") && ruta.endsWith("Uninstall Bling Launcher.exe");

describe("esCopiaDePrueba", () => {
  it("el instalado (con desinstalador al lado) no es copia de prueba", () => {
    expect(esCopiaDePrueba(instalado, { existe: conDesinstalador, env: {} })).toBe(false);
  });

  it("win-unpacked (sin desinstalador) es copia de prueba", () => {
    expect(esCopiaDePrueba(prueba, { existe: conDesinstalador, env: {} })).toBe(true);
  });

  it("BLING_PROBAR_ACTUALIZACIONES=1 la deja buscar versiones", () => {
    expect(esCopiaDePrueba(prueba, { existe: conDesinstalador, env: { BLING_PROBAR_ACTUALIZACIONES: "1" } })).toBe(false);
  });
});
