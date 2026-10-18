import { describe, expect, it } from "vitest";
import {
  ZOOM_MAX,
  ZOOM_MIN,
  acotarZoom,
  nivelDeTeclaZoom,
  porcentajeDeZoom,
} from "./zoom";

describe("acotarZoom", () => {
  it("redondea a medios pasos", () => {
    expect(acotarZoom(0.3)).toBe(0.5);
    expect(acotarZoom(0.2)).toBe(0);
    expect(acotarZoom(-0.3)).toBe(-0.5);
  });

  it("no se pasa de los límites", () => {
    expect(acotarZoom(99)).toBe(ZOOM_MAX);
    expect(acotarZoom(-99)).toBe(ZOOM_MIN);
  });
});

describe("porcentajeDeZoom", () => {
  it("el nivel 0 es 100 % y cada nivel suma un 20 %", () => {
    expect(porcentajeDeZoom(0)).toBe("100%");
    expect(porcentajeDeZoom(1)).toBe("120%");
    expect(porcentajeDeZoom(-1)).toBe("83%");
  });
});

describe("nivelDeTeclaZoom", () => {
  it("Ctrl + y Ctrl = agrandan", () => {
    expect(nivelDeTeclaZoom("+", 0)).toBe(0.5);
    expect(nivelDeTeclaZoom("=", 0)).toBe(0.5);
  });

  it("Ctrl - y Ctrl _ achican", () => {
    expect(nivelDeTeclaZoom("-", 0)).toBe(-0.5);
    expect(nivelDeTeclaZoom("_", 0)).toBe(-0.5);
  });

  it("Ctrl 0 vuelve al 100 %", () => {
    expect(nivelDeTeclaZoom("0", 2)).toBe(0);
  });

  it("cualquier otra tecla no cambia el zoom", () => {
    expect(nivelDeTeclaZoom("a", 0)).toBeNull();
    expect(nivelDeTeclaZoom("F5", 1)).toBeNull();
    expect(nivelDeTeclaZoom("+", 0)).not.toBeNull();
  });

  it("manteniendo la tecla no se pasa de los límites", () => {
    expect(nivelDeTeclaZoom("+", ZOOM_MAX)).toBe(ZOOM_MAX);
    expect(nivelDeTeclaZoom("-", ZOOM_MIN)).toBe(ZOOM_MIN);
  });
});
