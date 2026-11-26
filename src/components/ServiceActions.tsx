import type { MouseEvent, ReactNode } from "react";
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
  RefreshCw,
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
  /** Otras versiones de la app de PC (volver a una anterior). */
  onVersiones?: (service: Service) => void;
};

/**
 * Lo que hace el clic (o Enter) sobre la fila o la tarjeta: la app de PC si
 * existe (abrirla, actualizarla, instalarla o bajarla), si no la web.
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
    case "actualizacion-lista":
      acciones.onInstalar?.(service);
      return;
    case "para-descargar":
    case "desactualizada":
      acciones.onDescargar?.(service);
      return;
    case "descargando":
      return;
    default:
      acciones.onWeb(service);
  }
}

/**
 * Botón de acción. Sobrio a propósito: el color de cada servicio queda en su
 * icono y los botones van en la escala de grises del launcher. El único con
 * color es el principal de la tarjeta destacada, en el amarillo de Bling
 * (el mismo de «Instalar ahora» en el aviso de actualización).
 */
function Boton({
  children,
  label,
  onClick,
  principal,
  destacado,
  deshabilitado,
}: {
  children: ReactNode;
  label: string;
  onClick?: () => void;
  /** Acción principal (relleno suave) o secundaria (sólo contorno). */
  principal: boolean;
  /** En la tarjeta destacada: más grande y, si es principal, amarilla. */
  destacado: boolean;
  deshabilitado?: boolean;
}) {
  const tono = principal
    ? destacado
      ? "border-[#ffcc00]/35 bg-[#ffcc00]/10 text-[#ffcc00] hover:border-[#ffcc00]/60 hover:bg-[#ffcc00]/20"
      : "border-white/20 bg-white/[0.07] text-white/90 hover:border-white/35 hover:bg-white/[0.12] hover:text-white"
    : "border-white/10 bg-transparent text-white/55 hover:border-white/25 hover:text-white";
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
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border font-mono tracking-wider uppercase transition-colors disabled:cursor-default disabled:opacity-80 ${
        destacado ? "px-3.5 py-2 text-[10.5px]" : "px-3 py-1.5 text-[10px]"
      } ${tono}`}
    >
      {children}
    </button>
  );
}

/**
 * Las dos opciones de un servicio, siempre con icono y texto:
 *   [🖥 app de PC]  — abrir / actualizar / instalar / descargar (si hay app)
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
  const tam = grande ? 14 : 13;

  if (service.status !== "available") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 font-mono text-[10px] tracking-wider uppercase text-white/40">
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
        principal
        destacado={grande}
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
      principal={estado === "web"}
      destacado={grande}
    >
      <Globe size={tam} />
      Abrir en el navegador
    </Boton>
  );

  if (estado === "web") return web;

  const pc = (() => {
    switch (estado) {
      case "instalada":
        return (
          <Boton
            label={`Abrir la app de ${service.name} instalada en tu PC`}
            onClick={() => acciones.onAbrir?.(service)}
            principal
            destacado={grande}
          >
            <Monitor size={tam} />
            Abrir app de PC
          </Boton>
        );
      case "desactualizada":
        return (
          <Boton
            label={`Descargar la versión nueva de ${service.name}`}
            onClick={() => acciones.onDescargar?.(service)}
            principal
            destacado={grande}
          >
            <RefreshCw size={tam} />
            Actualizar app de PC
          </Boton>
        );
      case "descargada":
      case "actualizacion-lista":
        return (
          <Boton
            label={`Instalar ${service.name} en tu PC`}
            onClick={() => acciones.onInstalar?.(service)}
            principal
            destacado={grande}
          >
            <PackageCheck size={tam} />
            {estado === "descargada" ? "Instalar app de PC" : "Instalar actualización"}
          </Boton>
        );
      case "descargando":
        return (
          <Boton label="Descargando la app de PC" principal destacado={grande} deshabilitado>
            <LoaderCircle size={tam} className="animate-spin" />
            Descargando {percent} %
          </Boton>
        );
      default:
        return (
          <Boton
            label={`Descargar la app de ${service.name} para tu PC`}
            onClick={() => acciones.onDescargar?.(service)}
            principal
            destacado={grande}
          >
            <Download size={tam} />
            Descargar app de PC
          </Boton>
        );
    }
  })();

  return (
    <span className="flex items-center gap-1.5">
      {pc}
      {web}
    </span>
  );
}

/** Línea de estado de la app de escritorio, con un punto que marca el estado. */
export function LineaEstado({
  estado,
  texto,
}: {
  estado: EstadoEscritorio;
  texto: string | null;
}) {
  if (!texto) return null;
  const punto =
    estado === "instalada"
      ? "bg-emerald-400/80"
      : estado === "desactualizada" || estado === "actualizacion-lista"
        ? "bg-amber-300/80"
        : "bg-white/30";
  return (
    <span className="mt-1 flex items-center gap-1.5 text-[11px] font-light text-white/55">
      <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${punto}`} />
      <span className="truncate">{texto}</span>
    </span>
  );
}
