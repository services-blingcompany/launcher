import { describe, expect, it } from "vitest";
import { diasRestantes, vigenciaDe } from "./vigencia";

const ahora = new Date("2026-11-23T12:00:00Z");
const base = { requiredTier: "estudio", versions: {} };

describe("diasRestantes", () => {
  it("redondea hacia arriba y no baja de 0", () => {
    expect(diasRestantes("2026-11-24T11:00:00Z", ahora)).toBe(1);
    expect(diasRestantes("2026-11-30T12:00:00Z", ahora)).toBe(7);
    expect(diasRestantes("2026-11-20T12:00:00Z", ahora)).toBe(0);
    expect(diasRestantes(null, ahora)).toBeNull();
    expect(diasRestantes("no es fecha", ahora)).toBeNull();
  });
});

describe("vigenciaDe", () => {
  it("sin acceso ofrece la prueba gratis si existe", () => {
    expect(vigenciaDe({ ...base, hasAccess: false, pruebaDias: 14 }, ahora).texto).toBe("Plan estudio · 14 días gratis");
    expect(vigenciaDe({ ...base, hasAccess: false }, ahora).texto).toBe("Plan estudio");
  });

  it("en prueba cuenta los días y avisa al final", () => {
    const v = vigenciaDe({ ...base, hasAccess: true, enPrueba: true, accesoHasta: "2026-11-28T12:00:00Z" }, ahora);
    expect(v).toEqual({ texto: "Prueba: quedan 5 días", urgente: true });
    expect(vigenciaDe({ ...base, hasAccess: true, enPrueba: true, accesoHasta: "2026-11-23T20:00:00Z" }, ahora).texto).toBe("Prueba: queda 1 día");
  });

  it("con plan muestra lo que queda del período", () => {
    expect(vigenciaDe({ ...base, hasAccess: true, accesoHasta: "2026-12-23T12:00:00Z" }, ahora)).toEqual({
      texto: "En tu plan · 30 días",
      urgente: false,
    });
    expect(vigenciaDe({ ...base, hasAccess: true, accesoHasta: null }, ahora).texto).toBe("En tu plan");
  });
});
