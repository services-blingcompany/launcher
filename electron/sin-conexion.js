"use strict";

/**
 * Pantalla de "no pudimos conectar".
 *
 * El proceso principal la abre con dos datos en la dirección: la dirección que
 * falló (`u`) y el motivo (`m`). No le pide nada por IPC: "Reintentar" es un
 * enlace a esa misma dirección, y el proceso principal ya sabe qué hacer con
 * ella (es una dirección del sitio, así que la deja pasar).
 */
const parametros = new URLSearchParams(location.search);
const destino = parametros.get("u") || "";
const motivo = parametros.get("m") || "sitio";

/** Lo que se dice en cada caso; el sitio es el motivo por defecto. */
const TEXTOS = {
  internet: {
    titulo: "Parece que no hay internet",
    detalle: "Revisá la conexión de este equipo y probá de nuevo.",
  },
  sitio: {
    titulo: "No pudimos conectar con Bling",
    detalle: "El servicio no está respondiendo. Puede ser algo momentáneo.",
  },
};

const texto = TEXTOS[motivo] || TEXTOS.sitio;
document.getElementById("titulo").textContent = texto.titulo;
document.getElementById("detalle").textContent = texto.detalle;

const boton = document.getElementById("reintentar");
if (destino) {
  boton.href = destino;
} else {
  boton.hidden = true;
}

// De qué dirección se trata, para soporte: es el sitio, nunca datos de cuenta.
try {
  const sitio = document.getElementById("sitio");
  if (destino) sitio.textContent = new URL(destino).host;
} catch {
  // Si la dirección no se puede leer, no se muestra nada.
}
