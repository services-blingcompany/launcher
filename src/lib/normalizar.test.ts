import { describe, expect, it } from "vitest";
import { normalizar, etiquetaDeAtajo } from "./normalizar";

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

describe("etiquetaDeAtajo", () => {
  it("escribe el atajo como se usa en Windows", () => {
    expect(etiquetaDeAtajo("CommandOrControl+Shift+B")).toBe("Ctrl + Shift + B");
  });

  it("traduce las variantes de cada tecla", () => {
    expect(etiquetaDeAtajo("Control+Alt+F5")).toBe("Ctrl + Alt + F5");
    expect(etiquetaDeAtajo("Command+Option+P")).toBe("Cmd + Alt + P");
    expect(etiquetaDeAtajo("Super+Shift+1")).toBe("Cmd + Shift + 1");
  });

  it("no muestra nada cuando no hay atajo activo", () => {
    expect(etiquetaDeAtajo(null)).toBe("");
    expect(etiquetaDeAtajo(undefined)).toBe("");
    expect(etiquetaDeAtajo("")).toBe("");
  });
});
