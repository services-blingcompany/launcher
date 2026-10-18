import { describe, expect, it } from "vitest";
import conexion from "./conexion.cjs";

const { motivoDeFalla } = conexion;

describe("motivoDeFalla", () => {
  it("dice que no hay internet cuando el equipo está desconectado", () => {
    expect(motivoDeFalla(-106)).toBe("internet"); // ERR_INTERNET_DISCONNECTED
  });

  it("también cuando la dirección no se resuelve", () => {
    expect(motivoDeFalla(-105)).toBe("internet"); // ERR_NAME_NOT_RESOLVED
    expect(motivoDeFalla(-137)).toBe("internet");
    expect(motivoDeFalla(-21)).toBe("internet");
  });

  it("dice que el sitio no contesta cuando hay internet", () => {
    expect(motivoDeFalla(-7)).toBe("sitio"); // ERR_TIMED_OUT
    expect(motivoDeFalla(-102)).toBe("sitio"); // ERR_CONNECTION_REFUSED
    expect(motivoDeFalla(-101)).toBe("sitio");
    expect(motivoDeFalla(-100)).toBe("sitio");
  });

  it("no muestra nada en una navegación cancelada a propósito", () => {
    // ERR_ABORTED: pasa cuando el launcher manda un enlace al navegador.
    expect(motivoDeFalla(-3)).toBe(null);
  });

  it("no muestra nada ante errores que no son de red", () => {
    expect(motivoDeFalla(-20)).toBe(null); // ERR_BLOCKED_BY_CLIENT
    expect(motivoDeFalla(-501)).toBe(null); // ERR_INSECURE_RESPONSE
    expect(motivoDeFalla(0)).toBe(null);
    expect(motivoDeFalla(undefined)).toBe(null);
  });
});
