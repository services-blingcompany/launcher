import type { MouseEvent } from "react";
import {
  ArrowUpRight,
  ExternalLink,
  Lock,
  Newspaper,
  TrendingUp,
  ShoppingBag,
  Users,
  Rocket,
} from "lucide-react";
import type { Service } from "../data/services";

const ICONS = {
  newspaper: Newspaper,
  users: Users,
  "trending-up": TrendingUp,
  "shopping-bag": ShoppingBag,
  rocket: Rocket,
} as const;

/**
 * Fila de servicio (layout horizontal): icono a la izquierda, nombre y
 * tagline al medio, acción a la derecha. La luz especular sigue al
 * cursor con --mx/--my. Si está "soon" queda bloqueada.
 *
 * `selected` la marca cuando el usuario la recorre con ↑↓. La acción
 * secundaria (abrir en el navegador del sistema) es un botón aparte:
 * HTML no permite anidar botones.
 */
export default function ServiceRow({
  service,
  selected = false,
  onOpen,
  onOpenExternal,
}: {
  service: Service;
  selected?: boolean;
  onOpen: (service: Service) => void;
  onOpenExternal: (service: Service) => void;
}) {
  const Icon = ICONS[service.icon];
  const disponible = service.status === "available";

  function seguirCursor(e: MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - rect.top}px`);
  }

  return (
    <div
      data-sid={service.id}
      onMouseMove={seguirCursor}
      onClick={() => disponible && onOpen(service)}
      className={`group relative flex w-full items-center gap-4 overflow-hidden rounded-xl border bg-zinc-950/80 pr-3 pl-4 text-left transition-all duration-300 outline-none ${
        selected && disponible
          ? "border-white/25 bg-zinc-900/70"
          : "border-white/10"
      } ${disponible ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}
    >
      {/* Halo del acento, detrás del icono */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-8 top-1/2 h-24 w-40 -translate-y-1/2 rounded-full blur-3xl opacity-15 transition-opacity duration-500 group-hover:opacity-30"
        style={{
          background: `radial-gradient(closest-side, rgba(${service.accentRgb}, 0.55), transparent)`,
        }}
      />
      {/* Luz especular que sigue al cursor */}
      {disponible && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          style={{
            background: `radial-gradient(220px circle at var(--mx, 50%) var(--my, 50%), rgba(${service.accentRgb}, 0.10), transparent 70%)`,
          }}
        />
      )}
      {/* Barra de selección por teclado */}
      {selected && disponible && (
        <span
          aria-hidden
          className="absolute inset-y-3 left-0 w-[2px] rounded-full"
          style={{ background: `rgb(${service.accentRgb})` }}
        />
      )}

      <span
        className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 ${service.accent}`}
      >
        <Icon size={17} />
      </span>

      <span className="relative min-w-0 flex-1 py-3.5">
        <span className="flex items-center gap-2">
          <span className="truncate font-[var(--font-barlow)] text-[15px] font-light text-white">
            {service.name}
          </span>
          {service.badge && disponible && (
            <span
              className="shrink-0 rounded-full border px-2 py-0.5 font-mono text-[8px] tracking-widest uppercase"
              style={{
                color: `rgb(${service.accentRgb})`,
                background: `rgba(${service.accentRgb}, 0.08)`,
                borderColor: `rgba(${service.accentRgb}, 0.25)`,
              }}
            >
              {service.badge}
            </span>
          )}
        </span>
        <span className="mt-0.5 block truncate text-[11px] font-light text-white/55">
          {service.tagline}
        </span>
      </span>

      <span className="relative flex shrink-0 items-center gap-1">
        {/* Acción secundaria: aparece al pasar el cursor o al recorrer
            con el teclado. */}
        {disponible && (
          <button
            type="button"
            aria-label={`Abrir ${service.name} en el navegador del sistema`}
            title="Abrir en el navegador del sistema"
            onClick={(e) => {
              e.stopPropagation();
              onOpenExternal(service);
            }}
            className="rounded-lg border border-white/10 bg-white/5 p-2 text-white/40 opacity-0 transition-all duration-300 hover:border-white/25 hover:text-white focus-visible:opacity-100 focus-visible:outline-none group-hover:opacity-100"
          >
            <ExternalLink size={12} />
          </button>
        )}

        {disponible ? (
          <ArrowUpRight
            size={15}
            className={`transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 ${
              selected ? "text-white" : "text-white/25 group-hover:text-white"
            }`}
          />
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 font-mono text-[8px] tracking-widest uppercase text-white/45">
            <Lock size={8} />
            Próximamente
          </span>
        )}
      </span>
    </div>
  );
}
