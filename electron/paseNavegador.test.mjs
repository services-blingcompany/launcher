import { describe, expect, it } from "vitest";
import pase from "./paseNavegador.cjs";

const { destinoDelPase, urlEntrar } = pase;

describe("destinoDelPase", () => {
  it("el sitio principal viaja como ruta relativa", () => {
    expect(destinoDelPase("https://www.bling.uy/planes")).toBe("/planes");
    expect(destinoDelPase("https://bling.uy/bling?x=1#y")).toBe("/bling?x=1#y");
    expect(destinoDelPase("https://www.bling.uy")).toBe("/");
  });

  it("las apps con dominio propio viajan absolutas", () => {
    expect(destinoDelPase("https://dashboard.bling.uy/perfil")).toBe("https://dashboard.bling.uy/perfil");
    expect(destinoDelPase("https://contable.bling.uy")).toBe("https://contable.bling.uy/");
  });

  it("sin pase para lo ajeno, http, puertos, credenciales o auth", () => {
    for (const url of [
      "https://evil.com",
      "https://bling.uy.evil.com/",
      "http://www.bling.uy/",
      "https://www.bling.uy:8443/",
      "https://x@www.bling.uy/",
      "https://www.bling.uy/auth/login",
      "no es url",
    ]) {
      expect(destinoDelPase(url)).toBeNull();
    }
  });
});

describe("urlEntrar", () => {
  const codigo = "a".repeat(43);

  it("arma la URL de canje en el sitio", () => {
    expect(urlEntrar("https://www.bling.uy", codigo, "/planes")).toBe(
      `https://www.bling.uy/auth/launcher/entrar?codigo=${codigo}&destino=%2Fplanes`,
    );
  });

  it("rechaza códigos con forma rara", () => {
    expect(urlEntrar("https://www.bling.uy", "corto", "/")).toBeNull();
    expect(urlEntrar("https://www.bling.uy", `${codigo}&destino=x`, "/")).toBeNull();
    expect(urlEntrar("https://www.bling.uy", undefined, "/")).toBeNull();
  });
});
