"use strict";

const { Menu, clipboard } = require("electron");

/**
 * Menú contextual nativo para las ventanas del launcher.
 *
 * Electron no trae menú de clic derecho: sin esto no se puede pegar la
 * contraseña en el login, copiar el alias de BlingPay, ni copiar texto
 * dentro de Bling Social. Se arma según lo que haya debajo del cursor:
 * enlace, imagen, texto seleccionado o campo editable. Si no hay nada
 * que ofrecer, no aparece.
 *
 * Se le pasa de dónde escuchar (`webContents`) porque en las ventanas de
 * servicio la página vive en su propia vista y no en la ventana; `ventana`
 * es dónde se ancla el menú y `cargar` cómo abrir un enlace del sitio
 * dentro de esa misma vista.
 */
function attach({ webContents, ventana, esDelSitio, cargar }) {
  webContents.on("context-menu", (_event, params) => {
    const items = [];
    const puede = params.editFlags || {};
    // Si Chromium no reporta el estado, dejamos que el rol decida.
    const flag = (v) => (typeof v === "boolean" ? v : undefined);

    // ── Enlaces ──
    // Sólo se ofrece abrir los del propio sitio (misma allowlist que la
    // navegación); los ajenos se pueden copiar, no abrir.
    if (params.linkURL) {
      if (
        typeof esDelSitio === "function" &&
        typeof cargar === "function" &&
        esDelSitio(params.linkURL)
      ) {
        items.push({
          label: "Abrir enlace en esta ventana",
          click: () => cargar(params.linkURL),
        });
      }
      items.push({
        label: "Copiar enlace",
        click: () => clipboard.writeText(params.linkURL),
      });
      items.push({ type: "separator" });
    }

    // ── Imágenes ──
    if (params.mediaType === "image" && params.srcURL) {
      items.push({
        label: "Copiar imagen",
        click: () => webContents.copyImageAt(params.x, params.y),
      });
      items.push({
        label: "Guardar imagen…",
        click: () => webContents.downloadURL(params.srcURL),
      });
      items.push({ type: "separator" });
    }

    // ── Texto ──
    if (params.isEditable) {
      items.push(
        { label: "Deshacer", role: "undo", enabled: flag(puede.canUndo) },
        { label: "Rehacer", role: "redo", enabled: flag(puede.canRedo) },
        { type: "separator" },
        { label: "Cortar", role: "cut", enabled: flag(puede.canCut) },
        { label: "Copiar", role: "copy", enabled: flag(puede.canCopy) },
        { label: "Pegar", role: "paste", enabled: flag(puede.canPaste) },
        { label: "Seleccionar todo", role: "selectAll" },
      );
    } else if (params.selectionText) {
      items.push(
        { label: "Copiar", role: "copy" },
        { label: "Seleccionar todo", role: "selectAll" },
      );
    }

    if (items.length === 0) return;

    // Un separador suelto al final queda mal (p. ej. enlace sin texto).
    while (items.length > 0 && items[items.length - 1].type === "separator") {
      items.pop();
    }
    if (items.length === 0) return;

    Menu.buildFromTemplate(items).popup({ window: ventana });
  });
}

module.exports = { attach };
