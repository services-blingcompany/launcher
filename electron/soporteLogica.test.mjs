import { describe, expect, it } from "vitest";
import logica from "./soporteLogica.cjs";

const {
  MAX_CAPTURAS,
  armarDatosEquipo,
  descripcionConDatos,
  capturasValidas,
  tituloCorto,
} = logica;

describe("armarDatosEquipo", () => {
  it("arma el bloque esencial con el separador de la casa", () => {
    expect(
      armarDatosEquipo({
        sistema: "Windows 10.0.26100",
        aplicacion: "Bling Launcher 1.18.0",
        locale: "es-UY",
        timezone: "America/Montevideo",
      }),
    ).toBe(
      "Windows 10.0.26100 · Bling Launcher 1.18.0 · es-UY · America/Montevideo",
    );
  });

  it("omite lo que falte y limpia espacios", () => {
    expect(
      armarDatosEquipo({ sistema: "  macOS 15 ", aplicacion: null, locale: "es", timezone: "" }),
    ).toBe("macOS 15 · es");
  });

  it("sin ningún dato queda vacío (no se inventa nada)", () => {
    expect(armarDatosEquipo({})).toBe("");
  });
});

describe("descripcionConDatos", () => {
  const MENSAJE = "El launcher no arranca en Windows.";

  it("sin datos, el mensaje va tal cual", () => {
    expect(descripcionConDatos(MENSAJE, null)).toBe(MENSAJE);
    expect(descripcionConDatos(`  ${MENSAJE}  `, "")).toBe(MENSAJE);
  });

  it("con datos agrega el bloque debajo del mensaje", () => {
    const resultado = descripcionConDatos(MENSAJE, "Windows · es-UY");
    expect(resultado.startsWith(MENSAJE)).toBe(true);
    expect(resultado).toContain("Datos del equipo: Windows · es-UY");
    // El bloque va DESPUÉS del mensaje, separado por una línea.
    expect(resultado.indexOf("Datos del equipo")).toBeGreaterThan(MENSAJE.length);
  });
});

describe("capturasValidas", () => {
  const _cap = (i = 1, type = "image/avif") => ({
    url: `/uploads/messages/2026/10/c${i}.avif`,
    filename: `c${i}.png`,
    type,
    size: 1000 + i,
  });

  it(`acepta de 0 a ${MAX_CAPTURAS} imágenes`, () => {
    expect(capturasValidas([])).toBe(true);
    expect(capturasValidas([_cap(1), _cap(2), _cap(3), _cap(4)])).toBe(true);
  });

  it("rechaza la quinta captura", () => {
    const cinco = [_cap(1), _cap(2), _cap(3), _cap(4), _cap(5)];
    expect(capturasValidas(cinco)).toBe(false);
  });

  it("rechaza lo que no sea imagen o venga roto", () => {
    expect(capturasValidas([{ ..._cap(1), type: "application/pdf" }])).toBe(false);
    expect(capturasValidas([{ url: "", type: "image/avif" }])).toBe(false);
    expect(capturasValidas([null])).toBe(false);
    expect(capturasValidas("no")).toBe(false);
    expect(capturasValidas(undefined)).toBe(false);
  });
});

describe("tituloCorto", () => {
  it("respeta el título del backend si entra", () => {
    expect(tituloCorto("No inicia sesión")).toBe("No inicia sesión");
  });

  it("corta en palabra completa con puntos suspensivos", () => {
    const largo = "Desde la actualización de ayer el launcher se cierra apenas lo abro";
    const corto = tituloCorto(largo, 20);
    expect(corto.endsWith("…")).toBe(true);
    expect(corto.length).toBeLessThanOrEqual(21);
    expect(corto.startsWith("Desde la")).toBe(true);
  });

  it("sin título tiene un marcador", () => {
    expect(tituloCorto("")).toBe("(sin asunto)");
    expect(tituloCorto(null)).toBe("(sin asunto)");
  });
});
