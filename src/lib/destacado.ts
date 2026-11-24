import type { Service } from "../data/services";

/**
 * Qué servicio va en la tarjeta grande de arriba.
 *
 * 1. Si la persona tiene apps de escritorio instaladas, la que más abrió
 *    (empate: la destacada por defecto, después el orden del catálogo).
 * 2. Si no, la destacada por defecto del catálogo (Contable).
 * 3. Si no hay ninguna marcada, el primer servicio disponible.
 *
 * Es lógica pura: entra el catálogo, qué apps están instaladas y los usos,
 * sale un servicio. Se prueba en destacado.test.ts.
 */
export function elegirDestacado(
  servicios: Service[],
  instaladas: ReadonlySet<string>,
  usos: Readonly<Record<string, number>>,
): Service {
  const disponibles = servicios.filter((s) => s.status === "available");
  const porDefecto =
    disponibles.find((s) => s.featured) ?? disponibles[0] ?? servicios[0];

  let elegido: Service | null = null;
  let maxUsos = 0;
  for (const s of disponibles) {
    if (!instaladas.has(s.id)) continue;
    const n = usos[s.id] ?? 0;
    if (n > maxUsos || (n === maxUsos && n > 0 && s.id === porDefecto?.id)) {
      elegido = s;
      maxUsos = n;
    }
  }
  return elegido ?? porDefecto;
}
