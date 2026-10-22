import type { MouseEvent } from "react";
import {
  ArrowUpRight,
  Calculator,
  Download,
  ExternalLink,
  Lock,
  Newspaper,
  Play,
  Rocket,
  ShoppingBag,
  TrendingUp,
  Users,
} from "lucide-react";
import type { Service } from "../data/services";

const ICONS = {
  newspaper: Newspaper,
  users: Users,
  "trending-up": TrendingUp,
  "shopping-bag": ShoppingBag,
  rocket: Rocket,
  calculator: Calculator,
} as const;

/**
 * Fila de servicio (layout horizontal): icono a la izquierda, nombre y
 * tagline al medio, acción a la derecha. La luz especular sigue al
 * cursor con --mx/--my. Si está "soon" queda bloqueada.
 *
 * Los servicios con licencia (licenseKey) muestran su estado: "En tu plan",
 * "Plan X" con acceso a los planes, o los botones de Descargar/Instalar del
 * binario de escritorio, con su progreso y sus errores.
 *
 * `selected` la marca cuando el usuario la recorre con ↑↓. La acción
 * secundaria (abrir en el navegador del sistema) es un botón aparte:
 * HTML no permite anidar botones.
 */
export default function ServiceRow({
  service,
  selected = false,
  descarga = null,
  bajando = null,
  guardada = null,
  version = null,
  error = null,
  onOpen,
  onOpenExternal,
  onDescargar,
  onInstalar,
  onVerPlanes,
}: {
  service: Service;
  selected?: boolean;
  /** Progreso de descarga del binario (null si no hay). */
  descarga?: { percent: number } | null;
  bajando?: boolean | null;
  /** Versión del binario ya guardada en disco (null si no hay). */
  guardada?: string | null;
  /** Versión del binario disponible para la plataforma actual (null si no hay). */
  version?: string | null;
  error?: string | null;
  onOpen: (service: Service) => void;
  onOpenExternal: (service: Service) => void;
  onDescargar?: (service: Service) => void;
  onInstalar?: (service: Service) => void;
  onVerPlanes?: () => void;
}) {
  const Icon = ICONS[service.icon];
  const disponible = service.status === "available";

  // Servicio con licencia: hasta que el catálogo remoto responda, `licencia`
  // es undefined y la fila se comporta como cualquier otra (el gate de la
  // web resuelve adentro). Con la respuesta, se muestra el estado real.
  const conLicencia = Boolean(service.licenseKey);
  const sinLicencia = conLicencia && service.licencia !== undefined && !service.licencia.hasAccess;
  const binarioListo = conLicencia && service.licencia?.hasAccess && version;
  const yaGuardada = binarioListo && guardada === version;

  function seguirCursor(e: MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - rect.top}px`);
  }

  function accionPrincipal() {
    if (sinLicencia) {
      onVerPlanes?.();
      return;
    }
    if (disponible) onOpen(service);
  }

  return (
    <div
      data-sid={service.id}
      onMouseMove={seguirCursor}
      onClick={accionPrincipal}
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
          <span className="truncate font-[var(--font-montserrat)] text-[15px] font-light text-white">
            {service.name}
          </span>
          {/* Insignia de licencia: se prioriza sobre la estática del servicio. */}
          {conLicencia && service.licencia && (
            <span
              className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[8px] tracking-widest uppercase ${
                service.licencia.hasAccess
                  ? ""
                  : "border-white/15 bg-white/5 text-white/50"
              }`}
              style={
                service.licencia.hasAccess
                  ? {
                      color: `rgb(${service.accentRgb})`,
                      background: `rgba(${service.accentRgb}, 0.08)`,
                      borderColor: `rgba(${service.accentRgb}, 0.25)`,
                    }
                  : undefined
              }
            >
              {!service.licencia.hasAccess && <Lock size={8} />}
              {service.licencia.hasAccess
                ? "En tu plan"
                : `Plan ${service.licencia.requiredTier}`}
            </span>
          )}
          {service.badge && disponible && !conLicencia && (
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
        {error && (
          <span className="mt-0.5 block truncate text-[10px] font-light text-rose-400">
            {error}
          </span>
        )}
      </span>

      <span className="relative flex shrink-0 items-center gap-1">
        {/* Licencias: descargar / progreso / instalar, o el acceso a planes. */}
        {sinLicencia ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onVerPlanes?.();
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 font-mono text-[8px] tracking-widest uppercase text-white/60 transition-colors hover:border-white/30 hover:text-white"
          >
            <Lock size={8} />
            Ver planes
          </button>
        ) : (
          <>
            {binarioListo && bajando ? (
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[8px] tracking-widest uppercase text-white/60">
                {descarga?.percent ?? 0} %
              </span>
            ) : binarioListo && yaGuardada ? (
              <button
                type="button"
                aria-label={`Ejecutar el instalador de ${service.name}`}
                title="Ejecutar el instalador"
                onClick={(e) => {
                  e.stopPropagation();
                  onInstalar?.(service);
                }}
                className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[8px] tracking-widest uppercase transition-colors"
                style={{
                  color: `rgb(${service.accentRgb})`,
                  background: `rgba(${service.accentRgb}, 0.08)`,
                  borderColor: `rgba(${service.accentRgb}, 0.25)`,
                }}
              >
                <Play size={8} />
                Instalar
              </button>
            ) : binarioListo ? (
              <button
                type="button"
                aria-label={`Descargar ${service.name} a tu PC`}
                title="Descargar a tu PC"
                onClick={(e) => {
                  e.stopPropagation();
                  onDescargar?.(service);
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 font-mono text-[8px] tracking-widest uppercase text-white/60 transition-colors hover:border-white/30 hover:text-white"
              >
                <Download size={8} />
                Descargar
              </button>
            ) : null}

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
          </>
        )}
      </span>
    </div>
  );
}
