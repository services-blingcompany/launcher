import { useEffect, useState } from "react";
import { History, Loader2, X } from "lucide-react";
import Sparkle from "./Sparkle";
import type { LicenciaVersion } from "../bling";

/**
 * Otras versiones de una app de PC: si la nueva le da problemas, la persona
 * vuelve a una anterior. La versión elegida queda fijada (el launcher no le
 * ofrece actualizar) hasta que vuelva a la última desde acá mismo.
 */
export default function VersionesDialog({
  appKey,
  nombre,
  instalada,
  fijada,
  onInstalar,
  onCerrar,
}: {
  appKey: string;
  nombre: string;
  instalada: string | null;
  fijada: string | null;
  /** Baja e instala esa versión (ultima: suelta la versión fijada). */
  onInstalar: (version: string, ultima: boolean) => Promise<{ ok: boolean }>;
  onCerrar: () => void;
}) {
  const [versiones, setVersiones] = useState<LicenciaVersion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [instalando, setInstalando] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    void window.bling.licenciasVersiones(appKey).then((r) => {
      if (!vivo) return;
      if (r.ok) setVersiones(r.versiones ?? []);
      else setError("No pudimos traer las versiones. Probá en un rato.");
    });
    return () => {
      vivo = false;
    };
  }, [appKey]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !instalando) {
        e.stopPropagation();
        onCerrar();
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onCerrar, instalando]);

  const instalar = async (v: LicenciaVersion) => {
    setInstalando(v.version);
    setError(null);
    try {
      const r = await onInstalar(v.version, v.ultima);
      if (r.ok) onCerrar();
      else setError("No se pudo bajar esa versión. Probá de nuevo.");
    } finally {
      setInstalando(null);
    }
  };

  const fecha = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString("es-UY", { day: "2-digit", month: "short", year: "numeric" }) : "";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm"
      onClick={() => !instalando && onCerrar()}
      role="dialog"
      aria-modal="true"
      aria-label={`Versiones de ${nombre}`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="update-toast relative flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900 to-zinc-950 shadow-[0_24px_60px_-16px_rgba(0,0,0,0.8)]"
      >
        <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-[#ffcc00] via-[#ffcc00]/40 to-transparent" />
        <div className="relative flex min-h-0 flex-col p-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Sparkle className="h-3.5 w-3.5 text-[#ffcc00]" />
                <h2 className="font-[var(--font-montserrat)] text-lg font-light tracking-tight text-white">
                  Versiones de {nombre}
                </h2>
              </div>
              <p className="mt-1 text-xs font-light text-white/60">
                ¿La versión nueva te da problemas? Instalá una anterior: queda elegida y no se actualiza
                sola hasta que vuelvas a la última. Tus datos quedan en la PC.
              </p>
            </div>
            <button
              type="button"
              onClick={onCerrar}
              disabled={instalando !== null}
              aria-label="Cerrar"
              className="-mr-1 -mt-1 rounded-lg p-1.5 text-white/40 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-40"
            >
              <X size={15} />
            </button>
          </div>

          {versiones === null && !error && (
            <p className="mt-5 flex items-center gap-2 text-xs text-white/50">
              <Loader2 size={13} className="animate-spin" /> Buscando versiones…
            </p>
          )}

          {versiones && versiones.length === 0 && (
            <p className="mt-5 text-xs text-white/50">No hay otras versiones publicadas.</p>
          )}

          {versiones && versiones.length > 0 && (
            <ul className="mt-5 min-h-0 space-y-2 overflow-y-auto pr-1">
              {versiones.map((v) => {
                const esLaInstalada = instalada === v.version;
                return (
                  <li
                    key={v.version}
                    className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-white">
                        v{v.version}
                        {v.ultima && <span className="ml-2 text-[10px] uppercase tracking-wider text-[#ffcc00]/80">última</span>}
                        {esLaInstalada && (
                          <span className="ml-2 text-[10px] uppercase tracking-wider text-emerald-300/80">
                            {fijada === v.version ? "instalada · elegida" : "instalada"}
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-white/40">{fecha(v.publicada)}</p>
                      {v.notas && (
                        <p className="mt-1 line-clamp-2 text-[11px] font-light text-white/55">{v.notas}</p>
                      )}
                    </div>
                    {!esLaInstalada || (v.ultima && fijada) ? (
                      <button
                        type="button"
                        onClick={() => void instalar(v)}
                        disabled={instalando !== null}
                        className="shrink-0 rounded-lg border border-white/15 px-2.5 py-1.5 text-xs text-white/80 transition-colors hover:border-[#ffcc00]/60 hover:text-white disabled:opacity-50"
                      >
                        {instalando === v.version ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : v.ultima ? (
                          "Volver a la última"
                        ) : (
                          "Instalar esta"
                        )}
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}

          {error && <p className="mt-4 text-xs text-rose-400">{error}</p>}

          <p className="mt-4 flex items-start gap-1.5 text-[11px] font-light text-white/40">
            <History size={12} className="mt-0.5 shrink-0" />
            Si el instalador avisa que hay una versión más nueva, elegí desinstalarla primero. No marques
            «borrar los datos de la app».
          </p>
        </div>
      </div>
    </div>
  );
}
