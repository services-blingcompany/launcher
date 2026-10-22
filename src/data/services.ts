export type ServiceStatus = "available" | "soon";

/** Estado de licencia del usuario para un servicio, según el catálogo remoto. */
export type ServicioLicencia = {
  hasAccess: boolean;
  requiredTier: string;
  /** Última versión por plataforma ({"win-x64": "1.2.0"}); vacío = sin binarios. */
  versions: Record<string, string>;
};

export type Service = {
  id: string;
  name: string;
  tagline: string;
  /** URL de producción. Vacío = todavía no sale (tarjeta "Próximamente"). */
  url?: string;
  icon: "newspaper" | "users" | "trending-up" | "shopping-bag" | "rocket" | "calculator";
  /** rgb del acento, para la luz que sigue al cursor. */
  accentRgb: string;
  /** Hex del texto/icono del acento. */
  accent: string;
  badge?: string;
  /** Tarjeta grande arriba de todo (sólo una). */
  featured?: boolean;
  /**
   * Producto del backend de licencias que habilita este servicio. Si tiene,
   * el launcher pide el catálogo remoto (GET /api/v1/licenses) y decide con
   * `licencia` si se abre, se descarga o se invita a los planes.
   */
  licenseKey?: string;
  /** Estado de licencia del usuario; lo completa useLicencias desde el backend. */
  licencia?: ServicioLicencia;
  status: ServiceStatus;
};

/**
 * Catálogo del launcher. Las URLs de prod de Predicciones/Tienda todavía
 * no están confirmadas: quedan como "Próximamente" hasta que las pases
 * acá (un solo lugar para cambiar).
 */
export const SERVICES: Service[] = [
  {
    id: "noticias",
    name: "Bling Noticias",
    tagline: "Lo que pasa en Uruguay y el mundo, al minuto.",
    url: "https://bling.uy",
    icon: "newspaper",
    accentRgb: "255, 204, 0",
    accent: "text-[#ffcc00]",
    badge: "En vivo",
    featured: true,
    status: "available",
  },
  {
    id: "social",
    name: "Bling Social",
    tagline: "La red social uruguaya: seguí, publicá y conectá.",
    url: "https://bling.uy/bling",
    icon: "users",
    accentRgb: "16, 185, 129",
    accent: "text-emerald-400",
    status: "available",
  },
  {
    id: "contable",
    name: "Contable",
    tagline: "Facturación y gestión contable: en la web o instalado en tu PC.",
    url: "https://contable.bling.uy",
    icon: "calculator",
    accentRgb: "34, 211, 238",
    accent: "text-cyan-400",
    licenseKey: "contable",
    status: "available",
  },
  {
    id: "predicciones",
    name: "Predicciones",
    tagline: "Mercado de predicciones del ecosistema Bling.",
    icon: "trending-up",
    accentRgb: "59, 130, 246",
    accent: "text-blue-400",
    status: "soon",
  },
  {
    id: "tienda",
    name: "BlingShop",
    tagline: "Tienda del ecosistema: productos y servicios Bling.",
    icon: "shopping-bag",
    accentRgb: "168, 85, 247",
    accent: "text-purple-400",
    status: "soon",
  },
  {
    id: "fundadores",
    name: "Fundadores",
    tagline: "El programa de fundadores: postulá tu proyecto.",
    url: "https://bling.uy/fundadores",
    icon: "rocket",
    accentRgb: "244, 63, 94",
    accent: "text-rose-400",
    status: "available",
  },
];
