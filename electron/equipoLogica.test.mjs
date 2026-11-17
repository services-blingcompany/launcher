import { describe, expect, it } from "vitest";
import logica from "./equipoLogica.cjs";

const { idDeWindows, idDeMac, idDeLinux, huellaDe, nombreDe, esRemoto } = logica;

describe("id de la máquina", () => {
  it("Windows: saca el MachineGuid de la salida de reg", () => {
    const salida = `
HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography
    MachineGuid    REG_SZ    1A2B3C4D-1111-2222-3333-444455556666
`;
    expect(idDeWindows(salida)).toBe("1a2b3c4d-1111-2222-3333-444455556666");
    expect(idDeWindows("ERROR: no se encontró")).toBeNull();
  });

  it("Mac: saca el IOPlatformUUID", () => {
    expect(idDeMac('  "IOPlatformUUID" = "AAAA1111-BBBB-2222-CCCC-333344445555"')).toBe(
      "aaaa1111-bbbb-2222-cccc-333344445555",
    );
    expect(idDeMac("")).toBeNull();
  });

  it("Linux: acepta sólo los 32 hex de machine-id", () => {
    expect(idDeLinux("0123456789abcdef0123456789abcdef\n")).toBe("0123456789abcdef0123456789abcdef");
    expect(idDeLinux("no-es-un-id")).toBeNull();
  });
});

describe("huella", () => {
  it("es sha256 hex con sal: nunca el id original", () => {
    const h = huellaDe("1a2b3c4d-1111-2222-3333-444455556666");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toContain("1a2b3c4d");
    expect(huellaDe("1a2b3c4d-1111-2222-3333-444455556666")).toBe(h);
    expect(huellaDe("otro-equipo")).not.toBe(h);
  });

  it("coincide con la que calcula el contable de escritorio (src-tauri/src/huella.rs)", () => {
    // Si cambia de un lado solo, el backend rechaza todas las renovaciones.
    expect(huellaDe("1a2b3c4d-1111-2222-3333-444455556666")).toBe(
      "a3b786a41c8e6ec3ea9d0d9a556caef236127b9de88ec7c309e8f7786f794fe5",
    );
  });
});

describe("escritorio remoto", () => {
  it("Windows por RDP sí; consola o otro sistema no", () => {
    expect(esRemoto({ SESSIONNAME: "RDP-Tcp#3" }, "win32")).toBe(true);
    expect(esRemoto({ SESSIONNAME: "Console" }, "win32")).toBe(false);
    expect(esRemoto({}, "win32")).toBe(false);
    expect(esRemoto({ SESSIONNAME: "RDP-Tcp#3" }, "darwin")).toBe(false);
  });
});

describe("nombre del equipo", () => {
  it("hostname y sistema", () => {
    expect(nombreDe("OFICINA-PC", "win32")).toBe("OFICINA-PC (Windows)");
    expect(nombreDe("", "darwin")).toBe("Equipo Mac");
  });
});
