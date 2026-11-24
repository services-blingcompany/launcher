import type { MouseEvent } from "react";
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
 * Tarjeta destacada: Contable por defecto, o la app de escritorio que la
 * persona tiene instalada y más usa (lib/destacado). Formato hero con las
 * mismas dos opciones que las filas (app de PC y navegador), más grandes.
 * El clic en la tarjeta hace lo mismo que el botón principal.
 */
export default function FeaturedCard({
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
  descarga?: { percent: number } | null;
  bajando?: boolean | null;
  guardada?: string | null;
  ejecutable?: boolean | null;
  /** Versión instalada de la app nativa (null si no se sabe). */
  instalada?: string | null;
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
      onClick={() => accionPrincipal(service, estado, acciones)}
      onMouseMove={seguirCursor}
      className={`group relative flex w-full flex-col gap-5 overflow-hidden rounded-2xl border bg-gradient-to-br from-zinc-950 via-zinc-950 to-zinc-900/60 px-7 py-7 text-left transition-all duration-300 outline-none ${
        disponible ? "cursor-pointer hover:-translate-y-0.5 hover:border-white/20" : "cursor-default opacity-60"
      } ${selected ? "border-white/15" : "border-white/10"}`}
    >
      {/* Halo del acento, corrido a la derecha */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-20 h-56 w-72 rounded-full blur-3xl opacity-25 transition-opacity duration-500 group-hover:opacity-45"
        style={{
          background: `radial-gradient(closest-side, rgba(${service.accentRgb}, 0.5), transparent)`,
        }}
      />
      {/* Icono fantasma: llena el aire de la derecha sin competir con el texto */}
      <Icon
        aria-hidden
        className="pointer-events-none absolute -right-5 top-1/2 h-44 w-44 -translate-y-1/2 opacity-[0.05]"
        strokeWidth={0.75}
      />
      {/* Luz especular que sigue al cursor */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background: `radial-gradient(360px circle at var(--mx, 50%) var(--my, 50%), rgba(${service.accentRgb}, 0.12), transparent 70%)`,
        }}
      />
      {/* Línea de acento superior */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[1px] opacity-70"
        style={{
          background: `linear-gradient(90deg, transparent, rgba(${service.accentRgb}, 0.7), transparent)`,
        }}
      />
      {/* Barra de selección por teclado (la misma señal que las filas) */}
      {selected && disponible && (
        <span
          aria-hidden
          className="absolute inset-y-4 left-0 w-[2px] rounded-full"
          style={{ background: "rgba(255, 255, 255, 0.6)" }}
        />
      )}

      <div className="relative flex items-center gap-6">
        <span
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 ${service.accent}`}
        >
          <Icon size={24} />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2.5">
            <span className="font-mono text-[9px] tracking-widest uppercase text-white/45">
              Destacado
            </span>
            {vigencia?.texto && (
              <span
                className={`rounded-full border px-2.5 py-0.5 font-mono text-[9px] tracking-widest uppercase ${
                  vigencia.urgente
                    ? "border-amber-400/40 bg-amber-400/10 text-amber-300"
                    : "border-white/15 bg-white/[0.04] text-white/60"
                }`}
              >
                {vigencia.texto}
              </span>
            )}
          </span>
          <span className="mt-1.5 block truncate font-[var(--font-montserrat)] text-3xl font-extralight leading-tight tracking-tight text-white">
            {service.name}
          </span>
          <span className="mt-1.5 block max-w-md text-[13px] font-light text-white/55">
            {service.tagline}
          </span>
          <LineaEstado
            estado={estado}
            texto={textoEstado(estado, { percent, version, instalada })}
          />
          {error && (
            <span className="mt-0.5 block truncate text-[11px] font-light text-rose-400">
              {error}
            </span>
          )}
        </span>
      </div>

      <div className="relative">
        <BotonesServicio
          service={service}
          estado={estado}
          percent={percent}
          grande
          acciones={acciones}
        />
      </div>
    </div>
  );
}
