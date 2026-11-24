import type { Service } from "../data/services";

/**
 * En qué punto está la app de escritorio de un servicio en esta PC. De esto
 * salen el texto de estado de la fila, el botón principal y lo que hace el
 * clic (o Enter) sobre la fila.
 *
 * - `web`            no tiene app de PC (o todavía no se sabe): sólo navegador.
 * - `sin-licencia`   hay app pero el plan no la habilita: planes / prueba.
 * - `para-descargar` la app existe y no está en la PC.
 * - `descargando`    bajando el instalador.
 * - `descargada`     el instalador está en la PC pero falta instalar.
 * - `instalada`      el exe está: se abre.
 */
export type EstadoEscritorio =
  | "web"
  | "sin-licencia"
  | "para-descargar"
  | "descargando"
  | "descargada"
  | "instalada";

export type DatosEscritorio = {
  /** Versión disponible para esta plataforma (null si no hay binario). */
  version?: string | null;
  /** Versión del instalador guardado en disco (null si no hay). */
  guardada?: string | null;
  /** ¿El exe de la app está instalado? */
  ejecutable?: boolean | null;
  bajando?: boolean | null;
};

export function estadoEscritorio(service: Service, datos: DatosEscritorio): EstadoEscritorio {
  if (!service.licenseKey) return "web";
  const licencia = service.licencia;
  // Instalada gana: si el exe está, se abre (la app valida la licencia).
  if (datos.ejecutable) return "instalada";
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
export function textoEstado(estado: EstadoEscritorio, percent = 0): string | null {
  switch (estado) {
    case "instalada":
      return "Instalada en esta PC";
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
