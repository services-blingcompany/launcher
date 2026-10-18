import { useEffect, useState } from "react";
import { Check, Copy, Download, FolderOpen, Loader2, X } from "lucide-react";
import Sparkle from "./Sparkle";

/**
 * "Reportar un problema": muestra el diagnóstico que arma el proceso
 * principal (versiones, ajustes y las últimas líneas del registro) para
 * copiarlo o guardarlo, junto con lo que cuente el usuario.
 *
 * El reporte no lleva datos de la cuenta: ni correo, ni alias, ni tokens,
 * ni cookies. Por eso se puede pegar tal cual donde haga falta.
 */
export default function ReportDialog({ onCerrar }: { onCerrar: () => void }) {
  /** null mientras el main lo arma (lee el registro del disco). */
  const [reporte, setReporte] = useState<string | null>(null);
  const [relato, setRelato] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState<string | null>(null);
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    let vivo = true;
    window.bling
      .getDiagnostics()
      .then((texto) => {
        if (vivo) setReporte(texto);
      })
      .catch(() => {
        if (!vivo) return;
        setReporte("");
        setFallo(true);
      });
    return () => {
      vivo = false;
    };
  }, []);

  // Escape cierra (captura, como el resto de los modales).
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

  /** El relato del usuario arriba; el diagnóstico abajo. */
  function textoCompleto() {
    const limpio = relato.trim();
    if (!limpio) return reporte ?? "";
    return `Qué pasó:\n${limpio}\n\n${reporte ?? ""}`;
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(textoCompleto());
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      setFallo(true);
    }
  }

  async function guardar() {
    setGuardando(true);
    try {
      const ruta = await window.bling.saveDiagnostics(textoCompleto());
      if (ruta) setGuardado(ruta);
    } catch {
      setFallo(true);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm"
      // El panel de ajustes está detrás: este clic no lo puede cerrar de paso.
      onClick={(e) => {
        e.stopPropagation();
        onCerrar();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Reportar un problema"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="update-toast relative w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900 to-zinc-950 shadow-[0_24px_60px_-16px_rgba(0,0,0,0.8)]"
      >
        <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-[#ffcc00] via-[#ffcc00]/40 to-transparent" />

        <div className="relative p-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Sparkle className="h-3.5 w-3.5 text-[#ffcc00]" />
                <h2 className="font-[var(--font-montserrat)] text-xl font-extralight tracking-tight text-white">
                  Reportar un problema
                </h2>
              </div>
              <p className="mt-1 text-[11px] font-light text-white/50">
                Copiá el diagnóstico y pegalo donde nos escribas. Va sin
                correo, sin alias, sin tokens ni cookies.
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

          <label className="mt-5 block">
            <span className="font-mono text-[9px] tracking-widest uppercase text-white/40">
              ¿Qué pasó? (opcional)
            </span>
            <textarea
              value={relato}
              onChange={(e) => setRelato(e.target.value)}
              rows={2}
              placeholder="Ej.: al abrir Bling Social me pide iniciar sesión de nuevo."
              className="mt-1.5 w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-white/30 outline-none transition-colors focus:border-[#ffcc00]/40 focus:bg-white/[0.07]"
            />
          </label>

          <div className="mt-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[9px] tracking-widest uppercase text-white/40">
                Diagnóstico
              </span>
              <button
                type="button"
                onClick={() => void window.bling.openLogsFolder()}
                className="inline-flex items-center gap-1.5 font-mono text-[9px] tracking-widest uppercase text-white/40 transition-colors hover:text-white"
              >
                <FolderOpen size={10} />
                Abrir carpeta
              </button>
            </div>
            <pre className="mt-1.5 max-h-40 overflow-auto rounded-lg border border-white/10 bg-black/40 p-3 font-mono text-[10px] leading-relaxed whitespace-pre-wrap text-white/50">
              {reporte === null ? "Armando el diagnóstico…" : reporte}
            </pre>
          </div>

          {fallo && (
            <p className="mt-2 text-[10px] font-light text-red-300/90">
              No pudimos armar el diagnóstico. Igual nos sirve que nos cuentes
              qué te pasó.
            </p>
          )}
          {guardado && (
            <p className="mt-2 truncate font-mono text-[9px] text-white/35">
              Guardado en {guardado}
            </p>
          )}

          <div className="mt-4 flex items-center gap-2 border-t border-white/10 pt-4">
            <button
              type="button"
              onClick={() => void copiar()}
              disabled={reporte === null}
              className="inline-flex items-center gap-2 rounded-lg bg-[#ffcc00] px-3 py-2 text-xs font-medium text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {copiado ? <Check size={13} /> : <Copy size={13} />}
              {copiado ? "Copiado" : "Copiar diagnóstico"}
            </button>
            <button
              type="button"
              onClick={() => void guardar()}
              disabled={reporte === null || guardando}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-2 font-mono text-[9px] tracking-widest uppercase text-white/60 transition-colors hover:border-white/30 hover:text-white disabled:opacity-50"
            >
              {guardando ? (
                <Loader2 size={10} className="animate-spin" />
              ) : (
                <Download size={10} />
              )}
              Guardar .txt
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
