import type { MouseEvent } from "react";
import { ArrowUpRight, Calculator, Newspaper } from "lucide-react";
import type { Service } from "../data/services";

const ICONS = {
  newspaper: Newspaper,
  calculator: Calculator,
} as const;

/**
 * Tarjeta destacada: el servicio más importante, en formato hero. El icono
 * fantasma de la derecha llena el aire que deja el texto y la llamada a la
 * acción ("Abrir") reemplaza a la flechita suelta. Comparte la luz
 * especular y la barra de selección con las filas.
 */
export default function FeaturedCard({
  service,
  selected = false,
  onOpen,
}: {
  service: Service;
  selected?: boolean;
  onOpen: (service: Service) => void;
}) {
  const Icon = ICONS[service.icon as "newspaper"];
  const disponible = service.status === "available";

  function seguirCursor(e: MouseEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - rect.top}px`);
  }

  function abrir() {
    if (!disponible || !service.url) return;
    onOpen(service);
  }

  return (
    <button
      type="button"
      data-sid={service.id}
      onClick={abrir}
      onMouseMove={seguirCursor}
      disabled={!disponible}
      className={`group relative flex w-full items-center gap-6 overflow-hidden rounded-2xl border bg-gradient-to-br from-zinc-950 via-zinc-950 to-zinc-900/60 px-7 py-7 text-left transition-all duration-300 outline-none ${
        disponible
          ? "hover:-translate-y-0.5 hover:border-white/20 hover:shadow-[0_28px_60px_-30px_rgba(255,204,0,0.45)]"
          : "cursor-default opacity-60"
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

      {/* Barra de selección por teclado: la misma señal que usan las filas,
          así la destacada no necesita un borde claro para marcarse. */}
      {selected && disponible && (
        <span
          aria-hidden
          className="absolute inset-y-4 left-0 w-[2px] rounded-full"
          style={{ background: `rgb(${service.accentRgb})` }}
        />
      )}

      <span
        className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 ${service.accent}`}
      >
        <Icon size={24} />
      </span>

      <span className="relative min-w-0 flex-1">
        <span className="flex items-center gap-2.5">
          <span className="font-mono text-[9px] tracking-widest uppercase text-white/45">
            Destacado
          </span>
          {service.badge && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[9px] tracking-widest uppercase"
              style={{
                color: `rgb(${service.accentRgb})`,
                background: `rgba(${service.accentRgb}, 0.08)`,
                borderColor: `rgba(${service.accentRgb}, 0.25)`,
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full animate-pulse"
                style={{ background: `rgb(${service.accentRgb})` }}
              />
              {service.badge}
            </span>
          )}
        </span>
        <span className="mt-1.5 block truncate font-[var(--font-montserrat)] text-3xl font-extralight leading-tight tracking-tight text-white">
          {service.name}
        </span>
        <span className="mt-1.5 block max-w-md text-[13px] font-light text-white/55">
          {service.tagline}
        </span>
      </span>

      {/* La tarjeta entera es el botón: la llamada es visual, no un <button>
          anidado (HTML no lo permite). */}
      <span className="relative ml-4 hidden shrink-0 items-center gap-2 rounded-xl border border-[#ffcc00]/30 bg-[#ffcc00]/10 px-4 py-2.5 font-mono text-[9px] tracking-widest uppercase text-[#ffcc00] transition-colors group-hover:border-[#ffcc00]/60 group-hover:bg-[#ffcc00]/20 sm:inline-flex">
        Abrir
        <ArrowUpRight
          size={12}
          className="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
        />
      </span>
    </button>
  );
}
