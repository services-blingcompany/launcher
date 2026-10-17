/**
 * Normaliza texto para comparar sin importar acentos ni mayúsculas.
 *
 * "Seguí" → "segui", "postulá" → "postula". Sin esto, el buscador del
 * launcher no encuentra nada si el usuario escribe sin tildes.
 */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}
