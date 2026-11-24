/**
 * Páginas de cuenta del ecosistema. Viven en el dashboard
 * (dashboard.bling.uy) y se abren en el navegador del sistema con el pase de
 * sesión del launcher (ver paseNavegador.cjs): no piden la contraseña.
 *
 * Antes eran www.bling.uy/bling/*, que daban 404 desde que www.bling.uy es el
 * sitio de presentación, y se abrían en una ventana aparte del launcher.
 * Las notificaciones no son una página: se ven en el panel del launcher.
 */
export type PaginaCuenta = { id: string; url: string; title: string };

export const PAGINAS: {
  perfil: PaginaCuenta;
  ajustes: PaginaCuenta;
} = {
  perfil: {
    id: "perfil",
    url: "https://dashboard.bling.uy/profile",
    title: "Mi perfil",
  },
  ajustes: {
    id: "cuenta-ajustes",
    url: "https://dashboard.bling.uy/settings",
    title: "Ajustes de cuenta",
  },
};

/** Abre una página de cuenta en el navegador del sistema, con la sesión. */
export function abrirCuenta(pagina: PaginaCuenta) {
  void window.bling.openExternal(pagina.url);
}

/** Evento con el que cualquier parte de la UI abre el panel de notificaciones. */
export const EVENTO_NOTIFICACIONES = "bling:abrir-notificaciones";

export function abrirNotificaciones() {
  window.dispatchEvent(new Event(EVENTO_NOTIFICACIONES));
}
