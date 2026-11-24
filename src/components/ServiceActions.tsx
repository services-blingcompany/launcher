import type { CSSProperties, MouseEvent, ReactNode } from "react";
import {
  Briefcase,
  Calculator,
  Download,
  Globe,
  LayoutDashboard,
  LoaderCircle,
  Lock,
  Monitor,
  PackageCheck,
  Rocket,
  ShoppingBag,
  TrendingUp,
} from "lucide-react";
import type { Service } from "../data/services";
import type { EstadoEscritorio } from "../lib/escritorio";

/** Iconos del catálogo (los usan la fila y la tarjeta destacada). */
export const ICONOS_SERVICIO = {
  calculator: Calculator,
  briefcase: Briefcase,
  "layout-dashboard": LayoutDashboard,
  "trending-up": TrendingUp,
  "shopping-bag": ShoppingBag,
  rocket: Rocket,
} as const;

export type AccionesServicio = {
  /** Versión web en el navegador del sistema (con el pase de sesión). */
  onWeb: (service: Service) => void;
  onAbrir?: (service: Service) => void;
  onInstalar?: (service: Service) => void;
  onDescargar?: (service: Service) => void;
  onVerPlanes?: () => void;
};

/**
 * Lo que hace el clic (o Enter) sobre la fila o la tarjeta: la app de PC si
 * existe (abrirla, instalarla o bajarla), si no la web en el navegador.
 */
export function accionPrincipal(
  service: Service,
  estado: EstadoEscritorio,
  acciones: AccionesServicio,
) {
  if (service.status !== "available") return;
  switch (estado) {
    case "sin-licencia":
      acciones.onVerPlanes?.();
      return;
    case "instalada":
      acciones.onAbrir?.(service);
      return;
    case "descargada":
      acciones.onInstalar?.(service);
      return;
    case "para-descargar":
      acciones.onDescargar?.(service);
      return;
    case "descargando":
      return;
    default:
      acciones.onWeb(service);
  }
}

function Boton({
  children,
  label,
  onClick,
  relleno,
  rgb,
  grande,
  deshabilitado,
}: {
  children: ReactNode;
  label: string;
  onClick?: () => void;
  /** Botón principal (relleno con el acento) o secundario (contorno). */
  relleno: boolean;
  rgb: string;
  grande: boolean;
  deshabilitado?: boolean;
}) {
  const estilo: CSSProperties | undefined = relleno
    ? {
        color: `rgb(${rgb})`,
        background: `rgba(${rgb}, 0.12)`,
        borderColor: `rgba(${rgb}, 0.4)`,
      }
    : undefined;
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={deshabilitado}
      onClick={(e: MouseEvent) => {
        // La fila entera también es clicable: que no dispare las dos cosas.
        e.stopPropagation();
        onClick?.();
      }}
      style={estilo}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border font-mono tracking-wider uppercase transition-colors disabled:cursor-default ${
        grande ? "px-3.5 py-2 text-[10.5px]" : "px-3 py-1.5 text-[10px]"
      } ${
        relleno
          ? "hover:brightness-125"
          : "border-white/15 bg-white/[0.03] text-white/70 hover:border-white/35 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Las dos opciones de un servicio, siempre con icono y texto:
 *   [🖥 app de PC]  — abrir / instalar / descargar (sólo si hay app)
 *   [🌐 navegador]  — la web en el navegador del sistema
 * Un servicio sólo web muestra únicamente el del navegador, como principal.
 */
export function BotonesServicio({
  service,
  estado,
  percent = 0,
  grande = false,
  acciones,
}: {
  service: Service;
  estado: EstadoEscritorio;
  percent?: number;
  grande?: boolean;
  acciones: AccionesServicio;
}) {
  const rgb = service.accentRgb;
  const tam = grande ? 14 : 13;

  if (service.status !== "available") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 font-mono text-[10px] tracking-wider uppercase text-white/45">
        <Lock size={12} />
        Próximamente
      </span>
    );
  }

  if (estado === "sin-licencia") {
    const prueba = (service.licencia?.pruebaDias ?? 0) > 0;
    return (
      <Boton
        label={prueba ? "Probar gratis" : "Ver planes"}
        onClick={acciones.onVerPlanes}
        relleno
        rgb={rgb}
        grande={grande}
      >
        <Lock size={tam} />
        {prueba ? "Probar gratis" : "Ver planes"}
      </Boton>
    );
  }

  const web = (
    <Boton
      label={`Abrir ${service.name} en el navegador`}
      onClick={() => acciones.onWeb(service)}
      relleno={estado === "web"}
      rgb={rgb}
      grande={grande}
    >
      <Globe size={tam} />
      Abrir en el navegador
    </Boton>
  );

  if (estado === "web") return web;

  const pc =
    estado === "instalada" ? (
      <Boton
        label={`Abrir la app de ${service.name} instalada en tu PC`}
        onClick={() => acciones.onAbrir?.(service)}
        relleno
        rgb={rgb}
        grande={grande}
      >
        <Monitor size={tam} />
        Abrir app de PC
      </Boton>
    ) : estado === "descargada" ? (
      <Boton
        label={`Instalar la app de ${service.name} en tu PC`}
        onClick={() => acciones.onInstalar?.(service)}
        relleno
        rgb={rgb}
        grande={grande}
      >
        <PackageCheck size={tam} />
        Instalar app de PC
      </Boton>
    ) : estado === "descargando" ? (
      <Boton label="Descargando la app de PC" relleno rgb={rgb} grande={grande} deshabilitado>
        <LoaderCircle size={tam} className="animate-spin" />
        Descargando {percent} %
      </Boton>
    ) : (
      <Boton
        label={`Descargar la app de ${service.name} para tu PC`}
        onClick={() => acciones.onDescargar?.(service)}
        relleno
        rgb={rgb}
        grande={grande}
      >
        <Download size={tam} />
        Descargar app de PC
      </Boton>
    );

  return (
    <span className="flex items-center gap-1.5">
      {pc}
      {web}
    </span>
  );
}

/** Línea de estado de la app de escritorio, con un punto de color. */
export function LineaEstado({
  estado,
  texto,
  rgb,
}: {
  estado: EstadoEscritorio;
  texto: string | null;
  rgb: string;
}) {
  if (!texto) return null;
  const color =
    estado === "instalada"
      ? "rgb(52, 211, 153)"
      : estado === "para-descargar"
        ? "rgba(255, 255, 255, 0.35)"
        : `rgb(${rgb})`;
  return (
    <span className="mt-1 flex items-center gap-1.5 text-[11px] font-light text-white/60">
      <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
      <span className="truncate">{texto}</span>
    </span>
  );
}
