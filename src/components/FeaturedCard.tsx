import type { MouseEvent } from "react";
import { ArrowUpRight, Newspaper } from "lucide-react";
import type { Service } from "../data/services";

const ICONS = {
  newspaper: Newspaper,
} as const;

/**
 * Tarjeta destacada: el servicio más importante, en formato ancho con el
 * nombre grande y un mini "estado en vivo". Comparte el efecto de luz
 * especular con las filas.
 */
export default function FeaturedCard({ service }: { service: Service }) {
  const Icon = ICONS[service.icon as "newspaper"];
  const disponible = service.status === "available";

  function seguirCursor(e: MouseEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - rect.top}px`);
  }

  function abrir() {
    if (!disponible || !service.url) return;
    void window.bling.openService({
      id: service.id,
      url: service.url,
      title: service.name,
    });
  }

  return (
    <button
      type="button"
      onClick={abrir}
      onMouseMove={seguirCursor}
      disabled={!disponible}
      className="group relative flex w-full items-center gap-6 overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-r from-zinc-950 to-zinc-900/60 px-7 py-6 text-left transition-all duration-300 outline-none hover:-translate-y-0.5 hover:border-white/30 hover:shadow-[0_20px_50px_-24px_rgba(255,204,0,0.35)]"
    >
      {/* Halo superior del acento */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/3 h-48 w-96 -translate-x-1/2 rounded-full blur-3xl opacity-25 transition-opacity duration-500 group-hover:opacity-45"
        style={{
          background: `radial-gradient(closest-side, rgba(${service.accentRgb}, 0.5), transparent)`,
        }}
      />
      {/* Luz especular que sigue al cursor */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background: `radial-gradient(320px circle at var(--mx, 50%) var(--my, 50%), rgba(${service.accentRgb}, 0.12), transparent 70%)`,
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
        <span className="mt-1.5 block font-[var(--font-barlow)] text-2xl font-extralight leading-tight tracking-tight text-white">
          {service.name}
        </span>
        <span className="mt-1 block text-xs font-light text-white/60">
          {service.tagline}
        </span>
      </span>

      <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/60 transition-all duration-300 group-hover:border-transparent group-hover:bg-[#ffcc00] group-hover:text-black">
        <ArrowUpRight size={18} />
      </span>
    </button>
  );
}
