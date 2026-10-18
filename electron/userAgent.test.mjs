import { describe, expect, it } from "vitest";
import userAgent from "./userAgent.cjs";

const { limpiar } = userAgent;

/** Lo que manda Electron hoy, con el nombre de la app adelante. */
const UA_ELECTRON =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) BlingLauncher/1.11.0 Chrome/152.0.7977.167 Electron/44.8.0 Safari/537.36";

describe("limpiar (user agent)", () => {
  it("saca la huella de Electron", () => {
    expect(limpiar(UA_ELECTRON)).toBe(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) BlingLauncher/1.11.0 Chrome/152.0.7977.167 Safari/537.36",
    );
  });

  it("deja el nombre del launcher, que sirve para reconocer el tráfico", () => {
    expect(limpiar(UA_ELECTRON)).toContain("BlingLauncher/1.11.0");
  });

  it("no deja espacios dobles ni la palabra Electron", () => {
    const limpio = limpiar(UA_ELECTRON);
    expect(limpio).not.toContain("  ");
    expect(limpio).not.toContain("Electron");
  });

  it("deja igual un user agent que ya está limpio", () => {
    const chrome = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/152.0.7977.167 Safari/537.36";
    expect(limpiar(chrome)).toBe(chrome);
  });

  it("no rompe si no hay user agent", () => {
    expect(limpiar(undefined)).toBe("");
    expect(limpiar(42)).toBe("");
  });
});
