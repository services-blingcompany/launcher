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

/**
 * Convierte el acelerador de Electron a algo que se lea como se escribe en
 * Windows: "CommandOrControl+Shift+B" → "Ctrl + Shift + B".
 *
 * El atajo lo registra el proceso principal, así que el panel de ajustes
 * muestra exactamente la combinación que quedó activa (o ninguna, si otra
 * aplicación ya la estaba usando).
 */
export function etiquetaDeAtajo(atajo: string | null | undefined): string {
  if (!atajo) return "";

  return atajo
    .split("+")
    .map((parte) => {
      const tecla = parte.trim().toLowerCase();
      if (tecla === "commandorcontrol" || tecla === "control" || tecla === "cmdorctrl") {
        return "Ctrl";
      }
      if (tecla === "command" || tecla === "cmd" || tecla === "super" || tecla === "meta") {
        return "Cmd";
      }
      if (tecla === "alt" || tecla === "option") return "Alt";
      if (tecla === "shift") return "Shift";
      // Una tecla suelta (letra, número, F1…) se muestra en mayúscula.
      return parte.trim().length === 1 ? parte.trim().toUpperCase() : parte.trim();
    })
    .join(" + ");
}
