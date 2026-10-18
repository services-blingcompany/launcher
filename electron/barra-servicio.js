"use strict";

/**
 * Lógica de la barra: no sabe en qué ventana está ni qué servicio carga.
 * Manda órdenes y pinta el estado que le pasa el proceso principal.
 */
const botones = {
  atras: "atras",
  adelante: "adelante",
  recargar: "recargar",
  externo: "externo",
  minimizar: "minimizar",
  maximizar: "maximizar",
  cerrar: "cerrar",
};

for (const [id, accion] of Object.entries(botones)) {
  document.getElementById(id).addEventListener("click", () => window.barra.accion(accion));
}

/** Ícono de maximizar / restaurar, según cómo esté la ventana. */
const ICONO_MAXIMIZAR = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none"
  stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="4" y="4" width="16" height="16" rx="2" /></svg>`;
const ICONO_RESTAURAR = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none"
  stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="8" y="4" width="12" height="12" rx="2" /><path d="M16 16v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2" /></svg>`;

const atras = document.getElementById("atras");
const adelante = document.getElementById("adelante");
const recargar = document.getElementById("recargar");
const titulo = document.getElementById("titulo");
const progreso = document.getElementById("progreso");
const maximizar = document.getElementById("maximizar");

window.barra.onEstado((estado) => {
  atras.disabled = !estado.atras;
  adelante.disabled = !estado.adelante;
  recargar.classList.toggle("cargando", estado.cargando);
  progreso.classList.toggle("activo", estado.cargando);
  if (estado.titulo) {
    titulo.textContent = estado.titulo;
    titulo.title = estado.detalle || estado.titulo;
  }
  maximizar.innerHTML = estado.maximizada ? ICONO_RESTAURAR : ICONO_MAXIMIZAR;
  maximizar.title = estado.maximizada ? "Restaurar" : "Maximizar";
});
