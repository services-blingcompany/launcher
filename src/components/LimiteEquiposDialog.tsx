import { useEffect, useState } from "react";
import { Laptop, Globe, Loader2, X } from "lucide-react";
import Sparkle from "./Sparkle";
import type { EquipoCuenta } from "../bling";

/**
 * La cuenta ya usa todos los equipos que permite su plan. Se ofrece cerrar
 * uno para abrir la app en esta PC: el otro equipo queda afuera al toque
 * (sus apps se cierran en la próxima renovación del ticket).
 */
export default function LimiteEquiposDialog({
  limite,
  equipos,
  onReemplazar,
  onCerrar,
}: {
  limite: number;
  equipos: EquipoCuenta[];
  onReemplazar: (equipoId: number) => Promise<unknown>;
  onCerrar: () => void;
}) {
  const [cerrando, setCerrando] = useState<number | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCerrar();
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onCerrar]);

  const reemplazar = async (id: number) => {
    setCerrando(id);
    try {
      await onReemplazar(id);
    } finally {
      setCerrando(null);
    }
  };

  const fecha = (iso: string) =>
    new Date(iso).toLocaleDateString("es-UY", { day: "2-digit", month: "short" });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm"
      onClick={onCerrar}
      role="dialog"
      aria-modal="true"
      aria-label="Límite de equipos"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="update-toast relative w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900 to-zinc-950 shadow-[0_24px_60px_-16px_rgba(0,0,0,0.8)]"
      >
        <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-[#ffcc00] via-[#ffcc00]/40 to-transparent" />
        <div className="relative p-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Sparkle className="h-3.5 w-3.5 text-[#ffcc00]" />
                <h2 className="font-[var(--font-montserrat)] text-lg font-light tracking-tight text-white">
                  Tu cuenta ya está en uso
                </h2>
              </div>
              <p className="mt-1 text-xs font-light text-white/60">
                Tu plan permite usar Bling en {limite} {limite === 1 ? "equipo" : "equipos"} a la vez. Cerrá
                uno para usarlo en esta PC.
              </p>
            </div>
            <button
              type="button"
              onClick={onCerrar}
              aria-label="Cerrar"
              className="-mr-1 -mt-1 rounded-lg p-1.5 text-white/40 transition-colors hover:bg-white/5 hover:text-white"
            >
              <X size={15} />
            </button>
          </div>

          <ul className="mt-5 space-y-2">
            {equipos.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  {e.tipo === "web" ? (
                    <Globe size={15} className="shrink-0 text-white/50" />
                  ) : (
                    <Laptop size={15} className="shrink-0 text-white/50" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm text-white">{e.nombre}</p>
                    <p className="text-[11px] text-white/40">Último uso: {fecha(e.ultimoUso)}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => reemplazar(e.id)}
                  disabled={cerrando !== null}
                  className="shrink-0 rounded-lg border border-white/15 px-2.5 py-1.5 text-xs text-white/80 transition-colors hover:border-[#ffcc00]/60 hover:text-white disabled:opacity-50"
                >
                  {cerrando === e.id ? <Loader2 size={13} className="animate-spin" /> : "Cerrar y usar acá"}
                </button>
              </li>
            ))}
          </ul>

          <p className="mt-4 text-[11px] font-light text-white/40">
            ¿Necesitás más equipos? Los planes de equipo dan lugar a cada integrante.
          </p>
        </div>
      </div>
    </div>
  );
}
