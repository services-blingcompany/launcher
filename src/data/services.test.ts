import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SERVICES } from "./services";
import { PAGINAS } from "../lib/cuenta";

/**
 * Contrato del catálogo con el proceso principal: todo URL que el launcher
 * pueda abrir tiene que estar en la allowlist de electron/main.cjs, o la
 * ventana se abre vacía y nadie se entera hasta que un usuario lo reporta.
 */
function hostsPermitidos(): string[] {
  const main = readFileSync("electron/main.cjs", "utf8");
  const declaracion = /const ALLOWED_HOSTS = new Set\(\[([^\]]*)\]\)/.exec(main);
  return [...(declaracion?.[1] ?? "").matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

describe("catálogo de servicios", () => {
  it("no repite ids", () => {
    const ids = SERVICES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("lo que está disponible tiene URL https del sitio", () => {
    for (const servicio of SERVICES.filter((s) => s.status === "available")) {
      expect(servicio.url, `${servicio.id} dice disponible y no tiene URL`).toMatch(
        /^https:\/\/(www\.)?bling\.uy(\/|$)/,
      );
    }
  });

  it("lo que falta no tiene URL (tarjeta Próximamente)", () => {
    for (const servicio of SERVICES.filter((s) => s.status === "soon")) {
      expect(servicio.url, `${servicio.id} dice próximamente y tiene URL`).toBeUndefined();
    }
  });

  it("una sola tarjeta es la destacada", () => {
    expect(SERVICES.filter((s) => s.featured)).toHaveLength(1);
  });

  it("los acentos son rgb listos para usar en CSS", () => {
    for (const servicio of SERVICES) {
      expect(servicio.accentRgb, `${servicio.id} tiene un accentRgb raro`).toMatch(
        /^\d{1,3}, \d{1,3}, \d{1,3}$/,
      );
    }
  });
});

describe("allowlist del proceso principal", () => {
  const permitidos = hostsPermitidos();

  it("la allowlist se pudo leer (si no, este test no protege nada)", () => {
    expect(permitidos.length).toBeGreaterThan(0);
  });

  it("cada página que el launcher puede abrir tiene su host permitido", () => {
    const abribles = [
      ...SERVICES.filter((s) => s.url),
      ...Object.values(PAGINAS),
    ];
    for (const pagina of abribles) {
      const host = new URL(pagina.url as string).hostname;
      expect(permitidos, `${pagina.id} (${host}) no está en ALLOWED_HOSTS`).toContain(host);
    }
  });

  it("las páginas de cuenta viven en el sitio y con https", () => {
    for (const pagina of Object.values(PAGINAS)) {
      expect(pagina.url).toMatch(/^https:\/\/(www\.)?bling\.uy(\/|$)/);
    }
  });

  it("no repite ids de páginas de cuenta", () => {
    const ids = Object.values(PAGINAS).map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
