import { describe, expect, it } from "vitest";
import privacidad from "./privacidad.cjs";

const { limpiarRuta, limpiarUrl } = privacidad;

describe("limpiarRuta", () => {
  const raiz = "C:\\Users\\Bling Company";

  it("reemplaza la carpeta del usuario por una virgulilla", () => {
    expect(limpiarRuta("C:\\Users\\Bling Company\\AppData\\Roaming\\bling-launcher", raiz)).toBe(
      "~\\AppData\\Roaming\\bling-launcher",
    );
  });

  it("también cuando la ruta viene con barras normales", () => {
    expect(limpiarRuta("C:/Users/Bling Company/AppData/Roaming", raiz)).toBe(
      "~/AppData/Roaming",
    );
  });

  it("no distingue mayúsculas: Windows tampoco", () => {
    expect(limpiarRuta("c:\\users\\bling company\\datos", raiz)).toBe("~\\datos");
  });

  it("limpia varias apariciones en la misma línea", () => {
    const linea = `error en C:\\Users\\Bling Company\\a.txt y en C:\\Users\\Bling Company\\b.txt`;
    expect(limpiarRuta(linea, raiz)).toBe("error en ~\\a.txt y en ~\\b.txt");
  });

  it("no toca lo que no es una ruta del usuario", () => {
    expect(limpiarRuta("C:\\Program Files\\Bling\\algo.exe", raiz)).toBe(
      "C:\\Program Files\\Bling\\algo.exe",
    );
  });

  it("no rompe con valores que no son texto ni con raíz vacía", () => {
    expect(limpiarRuta(undefined, raiz)).toBe(undefined);
    expect(limpiarRuta("C:\\Users\\Bling Company", "")).toBe("C:\\Users\\Bling Company");
    expect(limpiarRuta("C:\\Users\\Bling Company", undefined)).toBe("C:\\Users\\Bling Company");
  });

  it("no confunde la raíz con un prefijo de otra carpeta", () => {
    // "Bling Company Otra" no es la carpeta del usuario, no se toca.
    expect(limpiarRuta("C:\\Users\\Bling Company Otra\\x", raiz)).toBe(
      "C:\\Users\\Bling Company Otra\\x",
    );
  });
});

describe("limpiarUrl", () => {
  it("saca la consulta del retorno de Google, donde viaja el código", () => {
    const url = "https://bling.uy/auth/callback?code=4/0AbC&scope=email#top";
    expect(limpiarUrl(url)).toBe("https://bling.uy/auth/callback");
  });

  it("saca también el fragmento, donde viajan los tokens", () => {
    expect(limpiarUrl("https://bling.uy/auth#access_token=abc123")).toBe(
      "https://bling.uy/auth",
    );
  });

  it("deja intacta una dirección sin consulta", () => {
    expect(limpiarUrl("https://bling.uy/bling")).toBe("https://bling.uy/bling");
  });

  it("corta una dirección que no parsea sin tocar el resto del texto", () => {
    expect(limpiarUrl("/api/notificaciones?token=abc")).toBe("/api/notificaciones");
    expect(limpiarUrl("texto suelto sin dirección")).toBe("texto suelto sin dirección");
  });

  it("conserva la barra final cuando la dirección la tiene", () => {
    expect(limpiarUrl("https://bling.uy/auth/?code=1")).toBe("https://bling.uy/auth/");
  });

  it("no rompe con valores vacíos", () => {
    expect(limpiarUrl("")).toBe("");
    expect(limpiarUrl(undefined)).toBe(undefined);
  });
});
