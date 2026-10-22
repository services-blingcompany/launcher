import { describe, expect, it } from "vitest";
import logica from "./licenciasLogica.cjs";

const { plataformaDe, esClaveValida, nombreArchivo, codigoDeEstado, integridadOk, parsearManifest } =
  logica;

describe("plataformaDe", () => {
  it("mapea el proceso actual a la convención del backend", () => {
    expect(plataformaDe("win32", "x64")).toBe("win-x64");
    expect(plataformaDe("win32", "arm64")).toBe("win-arm64");
    expect(plataformaDe("darwin", "arm64")).toBe("mac-arm64");
    expect(plataformaDe("darwin", "x64")).toBe("mac-x64");
    expect(plataformaDe("linux", "x64")).toBe("linux-x64");
  });

  it("cualquier arquitectura desconocida cae a x64", () => {
    expect(plataformaDe("linux", "ia32")).toBe("linux-x64");
  });
});

describe("esClaveValida", () => {
  it("acepta las keys del catálogo (letras, números y guiones)", () => {
    expect(esClaveValida("contable")).toBe(true);
    expect(esClaveValida("bling-contable-2")).toBe(true);
  });

  it("rechaza claves que podrían salirse de la carpeta de apps", () => {
    expect(esClaveValida("../otracosa")).toBe(false);
    expect(esClaveValida("a/b")).toBe(false);
    expect(esClaveValida("")).toBe(false);
    expect(esClaveValida(null)).toBe(false);
    expect(esClaveValida(123)).toBe(false);
  });
});

describe("nombreArchivo", () => {
  it("usa el nombre real del artefacto, que está en la URL firmada", () => {
    expect(
      nombreArchivo({
        url: "https://cuentas.r2.cloudflarestorage.com/apps/contable/1.2.0/Contable-Setup-1.2.0.exe?X-Amz-Signature=abc",
        key: "contable",
        version: "1.2.0",
      }),
    ).toBe("Contable-Setup-1.2.0.exe");
  });

  it("falla con un nombre armado si la URL no da pista", () => {
    expect(nombreArchivo({ url: "no-es-url", key: "contable", version: "1.2.0" })).toBe(
      "Bling-contable-1.2.0.exe",
    );
  });
});

describe("codigoDeEstado", () => {
  it("traduce los estados del backend a los códigos que entiende el renderer", () => {
    expect(codigoDeEstado(401)).toBe("sin-sesion");
    expect(codigoDeEstado(403)).toBe("sin-licencia");
    expect(codigoDeEstado(404)).toBe("sin-version");
    expect(codigoDeEstado(503)).toBe("sin-descargas");
    expect(codigoDeEstado(500)).toBe("servidor");
    expect(codigoDeEstado(0)).toBe("servidor");
  });
});

describe("integridadOk", () => {
  const sha = "a".repeat(64);

  it("acepta el mismo sha256 (con cualquier capitalización)", () => {
    expect(integridadOk(sha, sha)).toBe(true);
    expect(integridadOk(sha.toUpperCase(), sha)).toBe(true);
  });

  it("rechaza cualquier cosa que no cierre", () => {
    expect(integridadOk("b".repeat(64), sha)).toBe(false);
    expect(integridadOk("", sha)).toBe(false);
    expect(integridadOk("abc", sha)).toBe(false);
    expect(integridadOk(sha, undefined)).toBe(false);
  });
});

describe("parsearManifest", () => {
  it("lee un manifest válido", () => {
    const m = parsearManifest(
      JSON.stringify({ version: "1.2.0", archivo: "Contable-Setup-1.2.0.exe" }),
    );
    expect(m.version).toBe("1.2.0");
  });

  it("un manifest corrupto o incompleto da null (no lanza)", () => {
    expect(parsearManifest("roto{")).toBe(null);
    expect(parsearManifest("{}")).toBe(null);
    expect(parsearManifest(JSON.stringify({ version: "1.0.0" }))).toBe(null);
    expect(parsearManifest(null)).toBe(null);
  });
});
