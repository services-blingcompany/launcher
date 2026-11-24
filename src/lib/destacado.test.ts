import { describe, expect, it } from "vitest";
import type { Service } from "../data/services";
import { elegirDestacado } from "./destacado";

const base = { tagline: "", accentRgb: "0, 0, 0", accent: "" } as const;
const s = (id: string, extra: Partial<Service> = {}): Service => ({
  ...base,
  id,
  name: id,
  icon: "calculator",
  url: `https://${id}.bling.uy`,
  status: "available",
  ...extra,
});

const catalogo = [s("contable", { featured: true }), s("jobs"), s("editor")];

describe("elegirDestacado", () => {
  it("sin apps instaladas destaca la del catálogo", () => {
    expect(elegirDestacado(catalogo, new Set(), { jobs: 50 }).id).toBe("contable");
  });

  it("con una app instalada que se usa, la destaca", () => {
    expect(elegirDestacado(catalogo, new Set(["editor"]), { editor: 3 }).id).toBe("editor");
  });

  it("entre varias instaladas, gana la más usada", () => {
    const instaladas = new Set(["contable", "editor"]);
    expect(elegirDestacado(catalogo, instaladas, { contable: 2, editor: 9 }).id).toBe("editor");
  });

  it("empate entre instaladas: gana la destacada por defecto", () => {
    const instaladas = new Set(["editor", "contable"]);
    expect(elegirDestacado(catalogo, instaladas, { contable: 4, editor: 4 }).id).toBe("contable");
  });

  it("instalada pero nunca abierta desde el launcher: queda la de por defecto", () => {
    expect(elegirDestacado(catalogo, new Set(["editor"]), {}).id).toBe("contable");
  });

  it("los usos de servicios web no cuentan (no están instalados)", () => {
    expect(elegirDestacado(catalogo, new Set(["contable"]), { jobs: 99, contable: 1 }).id).toBe(
      "contable",
    );
  });

  it("nunca destaca algo que no está disponible", () => {
    const conSoon = [s("contable", { featured: true }), s("pronto", { status: "soon" })];
    expect(elegirDestacado(conSoon, new Set(["pronto"]), { pronto: 10 }).id).toBe("contable");
  });
});
