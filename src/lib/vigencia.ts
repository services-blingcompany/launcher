import type { ServicioLicencia } from "../data/services";

/**
 * Cuánto le queda a la persona para usar un servicio con licencia, en texto
 * corto para la insignia de la fila. Sale del catálogo del backend:
 * accesoHasta (fin del plan o del permiso), enPrueba y pruebaDias.
 */

const DIA_MS = 24 * 60 * 60 * 1000;

/** Días enteros que faltan (redondeo hacia arriba: «vence hoy» = 1). Null sin fecha. */
export function diasRestantes(hasta: string | null | undefined, ahora: Date = new Date()): number | null {
  if (!hasta) return null;
  const fin = new Date(hasta).getTime();
  if (Number.isNaN(fin)) return null;
  return Math.max(0, Math.ceil((fin - ahora.getTime()) / DIA_MS));
}

function dias(n: number): string {
  return n === 1 ? "1 día" : `${n} días`;
}

export type Vigencia = {
  /** Texto de la insignia. */
  texto: string;
  /** Aviso fuerte: prueba o plan por terminar (7 días o menos). */
  urgente: boolean;
};

export function vigenciaDe(licencia: ServicioLicencia, ahora: Date = new Date()): Vigencia {
  if (!licencia.hasAccess) {
    const prueba = licencia.pruebaDias ?? 0;
    return {
      texto: prueba > 0
        ? `Plan ${licencia.requiredTier} · ${dias(prueba)} gratis`
        : `Plan ${licencia.requiredTier}`,
      urgente: false,
    };
  }
  const faltan = diasRestantes(licencia.accesoHasta, ahora);
  if (licencia.enPrueba) {
    if (faltan === null) return { texto: "En prueba", urgente: false };
    return {
      texto: faltan === 0 ? "Prueba: termina hoy" : `Prueba: ${faltan === 1 ? "queda" : "quedan"} ${dias(faltan)}`,
      urgente: faltan <= 7,
    };
  }
  if (faltan === null) return { texto: "En tu plan", urgente: false };
  if (faltan === 0) return { texto: "En tu plan · vence hoy", urgente: true };
  return { texto: `En tu plan · ${dias(faltan)}`, urgente: faltan <= 7 };
}
