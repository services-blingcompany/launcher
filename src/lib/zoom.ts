/**
 * Zoom de la interfaz.
 *
 * Chromium mide el zoom en niveles (factor = 1.2^nivel), así que 0 es el
 * 100 % y cada 0,5 es ~10 %. Estos números son la fuente de verdad para el
 * renderer; el proceso principal usa el mismo valor como "zoom" del ajuste.
 */
export const ZOOM_MIN = -3; // ~57 %
export const ZOOM_MAX = 4; // ~207 %
export const PASO_ZOOM = 0.5;

/** Nivel válido más cercano (los medios pasos son los que se muestran). */
export function acotarZoom(nivel: number) {
  const redondeado = Math.round(nivel / PASO_ZOOM) * PASO_ZOOM;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, redondeado));
}

/** "83 %": lo que se ve en el panel de ajustes. */
export function porcentajeDeZoom(nivel: number) {
  return `${Math.round(1.2 ** nivel * 100)}%`;
}

/**
 * Nivel que corresponde a una tecla con Ctrl, o null si no es de zoom.
 * Ctrl 0 vuelve al 100 %.
 */
export function nivelDeTeclaZoom(
  tecla: string,
  nivelActual: number,
): number | null {
  if (tecla === "0") return 0;
  if (tecla === "+" || tecla === "=") return acotarZoom(nivelActual + PASO_ZOOM);
  if (tecla === "-" || tecla === "_") return acotarZoom(nivelActual - PASO_ZOOM);
  return null;
}
