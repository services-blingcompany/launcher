import { describe, expect, it } from "vitest";
import type { Service, ServicioLicencia } from "../data/services";
import { esMasNueva, estadoEscritorio, textoEstado } from "./escritorio";

const lic = (extra: Partial<ServicioLicencia> = {}): ServicioLicencia => ({
  hasAccess: true,
  requiredTier: "base",
  versions: { "win-x64": "1.2.0" },
  ...extra,
});
const svc = (extra: Partial<Service> = {}): Service => ({
  id: "contable",
  name: "Contable",
  tagline: "",
  url: "https://contable.bling.uy",
  icon: "calculator",
  accentRgb: "0, 0, 0",
  accent: "",
  licenseKey: "contable",
  status: "available",
  ...extra,
});

describe("estadoEscritorio", () => {
  it("un servicio sin licencia es sólo web", () => {
    expect(estadoEscritorio(svc({ licenseKey: undefined }), {})).toBe("web");
  });

  it("sin respuesta del catálogo remoto se ofrece la web", () => {
    expect(estadoEscritorio(svc(), {})).toBe("web");
  });

  it("instalada gana aunque el catálogo no haya respondido", () => {
    expect(estadoEscritorio(svc(), { ejecutable: true })).toBe("instalada");
  });

  it("sin acceso al plan va a planes", () => {
    expect(estadoEscritorio(svc({ licencia: lic({ hasAccess: false }) }), {})).toBe(
      "sin-licencia",
    );
  });

  it("con acceso y sin binario para la plataforma, sólo web", () => {
    expect(estadoEscritorio(svc({ licencia: lic() }), { version: null })).toBe("web");
  });

  it("recorre descargar → descargando → descargada", () => {
    const s = svc({ licencia: lic() });
    expect(estadoEscritorio(s, { version: "1.2.0" })).toBe("para-descargar");
    expect(estadoEscritorio(s, { version: "1.2.0", bajando: true })).toBe("descargando");
    expect(estadoEscritorio(s, { version: "1.2.0", guardada: "1.2.0" })).toBe("descargada");
  });

  it("un instalador viejo guardado no cuenta como descargada", () => {
    const s = svc({ licencia: lic() });
    expect(estadoEscritorio(s, { version: "1.2.0", guardada: "1.1.0" })).toBe("para-descargar");
  });
});

describe("actualizaciones de la app de PC", () => {
  const s = svc({ licencia: lic({ versions: { "win-x64": "1.2.1" } }) });

  it("instalada y al día", () => {
    expect(estadoEscritorio(s, { ejecutable: true, instalada: "1.2.1", version: "1.2.1" })).toBe(
      "instalada",
    );
  });

  it("instalada con una versión vieja: desactualizada", () => {
    expect(estadoEscritorio(s, { ejecutable: true, instalada: "1.2.0", version: "1.2.1" })).toBe(
      "desactualizada",
    );
  });

  it("la nueva bajando y después lista para instalar", () => {
    const base = { ejecutable: true, instalada: "1.2.0", version: "1.2.1" };
    expect(estadoEscritorio(s, { ...base, bajando: true })).toBe("descargando");
    expect(estadoEscritorio(s, { ...base, guardada: "1.2.1" })).toBe("actualizacion-lista");
  });

  it("sin saber la versión instalada no ofrece actualizar", () => {
    expect(estadoEscritorio(s, { ejecutable: true, instalada: null, version: "1.2.1" })).toBe(
      "instalada",
    );
  });

  it("compara versiones por número, no como texto", () => {
    expect(esMasNueva("1.10.0", "1.9.9")).toBe(true);
    expect(esMasNueva("1.2.0", "1.2.0")).toBe(false);
    expect(esMasNueva("1.2.0", "1.3.0")).toBe(false);
    expect(esMasNueva("basura", "1.0.0")).toBe(false);
  });
});

describe("textoEstado", () => {
  it("dice claro si la app está o no en la PC, y qué versión", () => {
    expect(textoEstado("instalada", { instalada: "1.2.1" })).toBe("Instalada en esta PC · v1.2.1");
    expect(textoEstado("desactualizada", { instalada: "1.2.0", version: "1.2.1" })).toMatch(
      /v1\.2\.0.*v1\.2\.1/,
    );
    expect(textoEstado("para-descargar")).toMatch(/descargala/);
    expect(textoEstado("descargando", { percent: 42 })).toMatch(/42 %/);
    expect(textoEstado("web")).toBeNull();
  });
});
