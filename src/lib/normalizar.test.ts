import { describe, expect, it } from "vitest";
import { normalizar } from "./normalizar";

describe("normalizar", () => {
  it("saca los acentos y las mayúsculas", () => {
    expect(normalizar("Seguí")).toBe("segui");
    expect(normalizar("postulá")).toBe("postula");
    expect(normalizar("NOTICIAS")).toBe("noticias");
  });

  it("recorta los espacios de los costados", () => {
    expect(normalizar("  Bling Social  ")).toBe("bling social");
  });

  it("deja el texto que ya viene normalizado", () => {
    expect(normalizar("bling")).toBe("bling");
  });

  it("la ñ se compara como n (escribir sin tildes también la encuentra)", () => {
    expect(normalizar("Ñandú")).toBe("nandu");
  });
});
