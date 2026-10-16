import type { MouseEvent } from "react";
import {
  ArrowUpRight,
  Newspaper,
  TrendingUp,
  ShoppingBag,
  Users,
  Rocket,
  Lock,
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
 * Tarjeta de servicio. Si está "available" abre la ventana embebida del
 * servicio (vía IPC al main); si está "soon" queda bloqueada. La luz
 * especular sigue al cursor con --mx/--my, igual que la landing.
 */
export default function ServiceCard({ service }: { service: Service }) {
  const Icon = ICONS[service.icon];
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
      aria-disabled={!disponible}
      className={`group relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/80 p-6 text-left transition-all duration-300 outline-none ${
        disponible
          ? "cursor-pointer hover:-translate-y-1 hover:border-white/25 hover:shadow-[0_18px_40px_-16px_rgba(255,255,255,0.12)]"
          : "cursor-not-allowed opacity-70"
      }`}
    >
      {/* Halo superior del color de acento */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 left-1/2 h-28 w-48 -translate-x-1/2 rounded-full blur-3xl opacity-15 transition-opacity duration-500 group-hover:opacity-30"
        style={{
          background: `radial-gradient(closest-side, rgba(${service.accentRgb}, 0.5), transparent)`,
        }}
      />
      {/* Luz especular que sigue al cursor */}
      {disponible && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          style={{
            background: `radial-gradient(260px circle at var(--mx, 50%) var(--my, 0px), rgba(${service.accentRgb}, 0.10), transparent 70%)`,
          }}
        />
      )}

      <div className="relative flex items-start justify-between gap-3">
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 ${service.accent}`}
        >
          <Icon size={18} />
        </span>
        {service.badge && disponible && (
          <span
            className="font-mono text-[9px] tracking-widest uppercase rounded-full border px-2.5 py-1"
            style={{
              color: `rgb(${service.accentRgb})`,
              background: `rgba(${service.accentRgb}, 0.08)`,
              borderColor: `rgba(${service.accentRgb}, 0.25)`,
            }}
          >
            {service.badge}
          </span>
        )}
        {!disponible && (
          <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[9px] tracking-widest uppercase text-white/45">
            <Lock size={9} />
            Próximamente
          </span>
        )}
      </div>

      <div className="relative mt-5 flex items-end justify-between gap-2">
        <h3 className="font-[var(--font-barlow)] text-lg font-light leading-tight text-white">
          {service.name}
        </h3>
        {disponible && (
          <ArrowUpRight
            size={16}
            className="shrink-0 text-white/30 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white"
          />
        )}
      </div>
      <p className="relative mt-1.5 text-xs font-light leading-relaxed text-white/60">
        {service.tagline}
      </p>
    </button>
  );
}
