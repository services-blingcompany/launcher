export type ServiceStatus = "available" | "soon";

/** Estado de licencia del usuario para un servicio, según el catálogo remoto. */
export type ServicioLicencia = {
  hasAccess: boolean;
  requiredTier: string;
  /** Última versión por plataforma ({"win-x64": "1.2.0"}); vacío = sin binarios. */
  versions: Record<string, string>;
  /** Fin del acceso (plan o permiso), ISO; null/ausente = sin fecha conocida. */
  accesoHasta?: string | null;
  /** El acceso es la prueba gratis del plan. */
  enPrueba?: boolean;
  /** Sin acceso: días de prueba gratis que ofrece el plan (0 = no hay). */
  pruebaDias?: number;
};

export type Service = {
  id: string;
  name: string;
  tagline: string;
  /** URL de producción. Vacío = todavía no sale (tarjeta "Próximamente"). */
  url?: string;
  icon:
    | "calculator"
    | "briefcase"
    | "layout-dashboard"
    | "trending-up"
    | "shopping-bag"
    | "rocket";
  /** rgb del acento, para la luz que sigue al cursor. */
  accentRgb: string;
  /** Hex del texto/icono del acento. */
  accent: string;
  badge?: string;
  /**
   * Destacado por defecto (sólo uno). Si la persona tiene instalada otra app
   * de escritorio y la usa más, el launcher destaca esa (ver lib/destacado).
   */
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
    id: "contable",
    name: "Contable",
    tagline: "Conciliación y gestión contable: en la web o instalado en tu PC.",
    url: "https://contable.bling.uy",
    icon: "calculator",
    accentRgb: "34, 211, 238",
    accent: "text-cyan-400",
    licenseKey: "contable",
    featured: true,
    status: "available",
  },
  {
    id: "jobs",
    name: "Jobs",
    tagline: "Empleo sin vueltas: empresas identificadas y sueldo a la vista.",
    url: "https://jobs.bling.uy",
    icon: "briefcase",
    accentRgb: "16, 185, 129",
    accent: "text-emerald-400",
    status: "available",
  },
  {
    id: "dashboard",
    name: "Dashboard",
    tagline: "Tu cuenta, tus planes y tus servicios en un solo panel.",
    url: "https://dashboard.bling.uy",
    icon: "layout-dashboard",
    accentRgb: "255, 204, 0",
    accent: "text-[#ffcc00]",
    status: "available",
  },
  {
    id: "fundadores",
    name: "Fundadores",
    tagline: "El programa de fundadores: postulá tu proyecto.",
    url: "https://www.bling.uy/fundadores",
    icon: "rocket",
    accentRgb: "244, 63, 94",
    accent: "text-rose-400",
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
];
