/**
 * Páginas de cuenta del ecosistema. Viven en bling.uy y se abren en las
 * ventanas embebidas del launcher, que comparten la sesión (misma cookie):
 * lo que ya esté logueado adentro, no vuelve a pedir credenciales.
 */
export type PaginaCuenta = { id: string; url: string; title: string };

export const PAGINAS: {
  perfil: PaginaCuenta;
  ajustes: PaginaCuenta;
  notificaciones: PaginaCuenta;
} = {
  perfil: {
    id: "perfil",
    url: "https://bling.uy/bling/profile",
    title: "Mi perfil",
  },
  ajustes: {
    id: "cuenta-ajustes",
    url: "https://bling.uy/bling/settings",
    title: "Ajustes de cuenta",
  },
  notificaciones: {
    id: "notificaciones",
    url: "https://bling.uy/bling/notifications",
    title: "Notificaciones",
  },
};

/** Abre una página de cuenta en su propia ventana del launcher. */
export function abrirCuenta(pagina: PaginaCuenta) {
  void window.bling.openService({ ...pagina });
}
