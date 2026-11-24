import type { MouseEvent } from "react";
import { Lock } from "lucide-react";
import type { Service } from "../data/services";
import { estadoEscritorio, textoEstado } from "../lib/escritorio";
import { vigenciaDe } from "../lib/vigencia";
import {
  type AccionesServicio,
  BotonesServicio,
  ICONOS_SERVICIO,
  LineaEstado,
  accionPrincipal,
} from "./ServiceActions";

/**
 * Fila de servicio: icono, nombre con la vigencia del plan, tagline y, si el
 * servicio tiene app de escritorio, una línea que dice si está en esta PC.
 * A la derecha, las dos opciones con icono y texto: app de PC y navegador
 * (ver ServiceActions). El clic en la fila hace lo mismo que el botón
 * principal. Si está "soon" queda bloqueada.
 *
 * `selected` la marca cuando el usuario la recorre con ↑↓.
 */
export default function ServiceRow({
  service,
  selected = false,
  descarga = null,
  bajando = null,
  guardada = null,
  ejecutable = null,
  instalada = null,
  version = null,
  error = null,
  ...acciones
}: {
  service: Service;
  selected?: boolean;
  /** Progreso de descarga del binario (null si no hay). */
  descarga?: { percent: number } | null;
  bajando?: boolean | null;
  /** Versión del binario ya guardada en disco (null si no hay). */
  guardada?: string | null;
  /** ¿La app nativa está instalada en la PC (exe presente)? */
  ejecutable?: boolean | null;
  /** Versión instalada de la app nativa (null si no se sabe). */
  instalada?: string | null;
  /** Versión del binario disponible para la plataforma actual (null si no hay). */
  version?: string | null;
  error?: string | null;
} & AccionesServicio) {
  const Icon = ICONOS_SERVICIO[service.icon];
  const disponible = service.status === "available";
  const estado = estadoEscritorio(service, { version, guardada, ejecutable, instalada, bajando });
  const percent = descarga?.percent ?? 0;
  const vigencia =
    service.licenseKey && service.licencia ? vigenciaDe(service.licencia) : null;

  function seguirCursor(e: MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - rect.top}px`);
  }

  return (
    <div
      data-sid={service.id}
      onMouseMove={seguirCursor}
      onClick={() => accionPrincipal(service, estado, acciones)}
      className={`group relative flex w-full items-center gap-4 overflow-hidden rounded-xl border bg-zinc-950/80 pr-3 pl-4 text-left transition-all duration-300 outline-none ${
        selected && disponible ? "border-white/25 bg-zinc-900/70" : "border-white/10"
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
          style={{ background: "rgba(255, 255, 255, 0.6)" }}
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
          {/* Insignia de licencia: lo que le queda al plan o a la prueba. */}
          {service.licencia && vigencia?.texto && (
            <span
              className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[8px] tracking-widest uppercase ${
                !service.licencia.hasAccess
                  ? "border-white/15 bg-white/5 text-white/50"
                  : vigencia.urgente
                    ? "border-amber-400/40 bg-amber-400/10 text-amber-300"
                    : "border-white/15 bg-white/[0.04] text-white/60"
              }`}
            >
              {!service.licencia.hasAccess && <Lock size={8} />}
              {vigencia.texto}
            </span>
          )}
          {service.badge && disponible && !service.licenseKey && (
            <span
              className="shrink-0 rounded-full border border-white/15 bg-white/[0.04] px-2 py-0.5 font-mono text-[8px] tracking-widest uppercase text-white/60"
            >
              {service.badge}
            </span>
          )}
        </span>
        <span className="mt-0.5 block truncate text-[11px] font-light text-white/55">
          {service.tagline}
        </span>
        <LineaEstado
          estado={estado}
          texto={textoEstado(estado, { percent, version, instalada })}
        />
        {error && (
          <span className="mt-0.5 block truncate text-[10px] font-light text-rose-400">
            {error}
          </span>
        )}
      </span>

      <span className="relative shrink-0">
        <BotonesServicio
          service={service}
          estado={estado}
          percent={percent}
          acciones={acciones}
        />
      </span>
    </div>
  );
}
