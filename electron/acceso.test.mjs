import { describe, expect, it } from "vitest";
import acceso from "./acceso.cjs";

const { esHostDeAcceso } = acceso;

describe("esHostDeAcceso", () => {
  it("reconoce la ventana de inicio de sesión de Google", () => {
    expect(esHostDeAcceso("https://accounts.google.com/gsi/select?client_id=1")).toBe(true);
    expect(esHostDeAcceso("https://accounts.google.com/o/oauth2/v2/auth")).toBe(true);
  });

  it("no acepta http (la sesión viaja cifrada o no viaja)", () => {
    expect(esHostDeAcceso("http://accounts.google.com/gsi/select")).toBe(false);
  });

  it("no acepta dominios parecidos", () => {
    expect(esHostDeAcceso("https://accounts.google.com.malo.com/login")).toBe(false);
    expect(esHostDeAcceso("https://accounts-google.com/login")).toBe(false);
    expect(esHostDeAcceso("https://malo.com/?x=accounts.google.com")).toBe(false);
    expect(esHostDeAcceso("https://sub.accounts.google.com/login")).toBe(false);
  });

  it("no acepta otros orígenes, ni siquiera el sitio propio", () => {
    expect(esHostDeAcceso("https://www.bling.uy/auth/login")).toBe(false);
    expect(esHostDeAcceso("file:///C:/algo.html")).toBe(false);
  });

  it("no rompe con entradas raras", () => {
    expect(esHostDeAcceso("")).toBe(false);
    expect(esHostDeAcceso(undefined)).toBe(false);
    expect(esHostDeAcceso("no es una url")).toBe(false);
  });
});
