import type { Service } from "../data/services";

/**
 * En qué punto está la app de escritorio de un servicio en esta PC. De esto
 * salen el texto de estado de la fila, el botón principal y lo que hace el
 * clic (o Enter) sobre la fila.
 *
 * - `web`                 no tiene app de PC (o todavía no se sabe): sólo navegador.
 * - `sin-licencia`        hay app pero el plan no la habilita: planes / prueba.
 * - `para-descargar`      la app existe y no está en la PC.
 * - `descargando`         bajando el instalador (primera vez o actualización).
 * - `descargada`          el instalador está en la PC pero falta instalar.
 * - `instalada`           está instalada y al día (o no se sabe su versión).
 * - `desactualizada`      instalada, pero el catálogo tiene una versión más nueva.
 * - `actualizacion-lista` la versión nueva ya se bajó: falta instalarla.
 */
export type EstadoEscritorio =
  | "web"
  | "sin-licencia"
  | "para-descargar"
  | "descargando"
  | "descargada"
  | "instalada"
  | "desactualizada"
  | "actualizacion-lista";

export type DatosEscritorio = {
  /** Versión disponible para esta plataforma (null si no hay binario). */
  version?: string | null;
  /** Versión del instalador guardado en disco (null si no hay). */
  guardada?: string | null;
  /** ¿El exe de la app está instalado? */
  ejecutable?: boolean | null;
  /** Versión instalada según su instalador (null si no se sabe). */
  instalada?: string | null;
  bajando?: boolean | null;
  /** Versión elegida a mano para volver atrás: mientras esté, no se ofrece actualizar. */
  fijada?: string | null;
};

/** "1.2.10" → [1, 2, 10]; null si no es X.Y.Z. */
function partes(v: string): number[] | null {
  const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(v.trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** ¿`nueva` es una versión posterior a `actual`? (false si alguna no se entiende) */
export function esMasNueva(nueva: string, actual: string): boolean {
  const a = partes(nueva);
  const b = partes(actual);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
}

export function estadoEscritorio(service: Service, datos: DatosEscritorio): EstadoEscritorio {
  if (!service.licenseKey) return "web";
  const licencia = service.licencia;

  if (datos.ejecutable) {
    // La persona eligió esta versión (la nueva le daba problemas): no se le
    // insiste con actualizar hasta que vuelva a la última.
    if (datos.fijada && datos.instalada === datos.fijada) return "instalada";
    const hayNueva =
      licencia?.hasAccess &&
      datos.version &&
      datos.instalada &&
      esMasNueva(datos.version, datos.instalada);
    if (!hayNueva) return "instalada";
    if (datos.bajando) return "descargando";
    if (datos.guardada === datos.version) return "actualizacion-lista";
    return "desactualizada";
  }

  // Sin respuesta del catálogo remoto (sin sesión, sin red) no se sabe si
  // hay app ni si se puede usar: se ofrece la web y el gate resuelve adentro.
  if (!licencia) return "web";
  if (!licencia.hasAccess) return "sin-licencia";
  if (!datos.version) return "web";
  if (datos.bajando) return "descargando";
  if (datos.guardada === datos.version) return "descargada";
  return "para-descargar";
}

/** Línea de estado bajo el nombre (null = no se muestra nada). */
export function textoEstado(
  estado: EstadoEscritorio,
  datos: { percent?: number; version?: string | null; instalada?: string | null; fijada?: string | null } = {},
): string | null {
  const { percent = 0, version, instalada, fijada } = datos;
  switch (estado) {
    case "instalada":
      if (instalada && fijada === instalada) {
        return `Instalada v${instalada} · versión elegida, no se actualiza sola`;
      }
      return instalada ? `Instalada en esta PC · v${instalada}` : "Instalada en esta PC";
    case "desactualizada":
      return `Instalada v${instalada} · hay una versión nueva (v${version})`;
    case "actualizacion-lista":
      return `Versión v${version} descargada · falta instalarla`;
    case "descargada":
      return "Descargada · falta instalarla";
    case "descargando":
      return `Descargando la app de PC… ${percent} %`;
    case "para-descargar":
      return "No está en esta PC · descargala para usarla sin el navegador";
    default:
      return null;
  }
}
