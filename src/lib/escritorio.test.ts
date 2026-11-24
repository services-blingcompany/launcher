import { describe, expect, it } from "vitest";
import type { Service, ServicioLicencia } from "../data/services";
import { estadoEscritorio, textoEstado } from "./escritorio";

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

describe("textoEstado", () => {
  it("dice claro si la app está o no en la PC", () => {
    expect(textoEstado("instalada")).toMatch(/Instalada/);
    expect(textoEstado("para-descargar")).toMatch(/descargala/);
    expect(textoEstado("descargando", 42)).toMatch(/42 %/);
    expect(textoEstado("web")).toBeNull();
  });
});
