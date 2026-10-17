import { ArrowDownToLine, Check, X } from "lucide-react";
import Sparkle, { ShineSweep } from "./Sparkle";
import type { UpdateInfo, UpdateProgress } from "../bling";

/**
 * Aviso de nueva versión. Entra deslizándose desde abajo, con un destello
 * que barre el panel y la chispa de la marca pulsando.
 *
 * Tres estados: disponible (botón para descargar), descargando (barra de
 * progreso) y descargado (listo para instalar). "Novedades" siempre lleva
 * a la página del release en GitHub.
 */
export default function UpdateToast({
  update,
  progress,
  downloaded,
  onDismiss,
  onDownload,
  onInstall,
}: {
  update: UpdateInfo;
  /** null si no hay descarga en curso. */
  progress: UpdateProgress | null;
  /** true cuando ya bajó y sólo falta instalar. */
  downloaded: boolean;
  onDismiss: () => void;
  onDownload: () => void;
  onInstall: () => void;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="update-toast pointer-events-auto relative w-[380px] overflow-hidden rounded-2xl border border-[#ffcc00]/25 bg-gradient-to-br from-zinc-900 to-zinc-950 shadow-[0_24px_60px_-16px_rgba(255,204,0,0.35)]"
    >
      <ShineSweep />

      {/* Chispa de la marca, esquina superior izquierda */}
      <span className="update-sparkle pointer-events-none absolute -left-6 -top-6 h-24 w-24 text-[#ffcc00]/15">
        <Sparkle className="h-full w-full" />
      </span>

      {/* Línea de acento superior */}
      <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-[#ffcc00] via-[#ffcc00]/40 to-transparent" />

      <div className="relative p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkle className="h-3.5 w-3.5 text-[#ffcc00]" />
            <span className="font-mono text-[9px] tracking-widest uppercase text-[#ffcc00]">
              {downloaded ? "Lista para instalar" : "Nueva versión disponible"}
            </span>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Descartar aviso"
            className="-mr-1 -mt-1 rounded-lg p-1.5 text-white/40 transition-colors hover:bg-white/5 hover:text-white"
          >
            <X size={13} />
          </button>
        </div>

        <div className="mt-3 flex items-baseline gap-3">
          <h3 className="font-[var(--font-barlow)] text-3xl font-extralight leading-none tracking-tight text-white">
            v{update.version}
          </h3>
          <span className="h-px flex-1 border-b border-dotted border-white/20" />
          <span className="font-mono text-[9px] tracking-widest uppercase text-white/40">
            Bling Launcher
          </span>
        </div>

        {update.notes && (
          <p className="mt-3 line-clamp-2 text-xs font-light leading-relaxed text-white/65">
            {update.notes}
          </p>
        )}

        {/* ── Progreso de descarga ── */}
        {progress ? (
          <div className="mt-4">
            <div className="flex items-center justify-between font-mono text-[9px] tracking-widest uppercase text-white/45">
              <span>Descargando…</span>
              <span>{progress.percent}%</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#ffcc00] to-[#ffd633] transition-[width] duration-300"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={downloaded ? onInstall : onDownload}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#ffcc00] px-4 py-2.5 font-mono text-[10px] tracking-widest uppercase text-black transition-colors hover:bg-[#ffd633]"
            >
              {downloaded ? <Check size={13} /> : <ArrowDownToLine size={13} />}
              {downloaded ? "Instalar ahora" : "Descargar e instalar"}
            </button>
            <button
              type="button"
              onClick={() => void window.bling.openUpdateLink(update.page)}
              className="rounded-xl border border-white/15 px-4 py-2.5 font-mono text-[10px] tracking-widest uppercase text-white/60 transition-colors hover:border-white/30 hover:text-white"
            >
              Novedades
            </button>
          </div>
        )}

        {downloaded && (
          <p className="mt-2.5 text-center text-[10px] font-light text-white/35">
            Se instala al salir, o ahora si preferís.
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Badge chiquito que queda después de descartar el toast: la chispa de la
 * marca con la versión, para volver a abrir el aviso cuando se quiera.
 */
export function UpdateBadge({
  update,
  onOpen,
}: {
  update: UpdateInfo;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      title={`Nueva versión v${update.version}`}
      className="group relative flex items-center gap-1.5 overflow-hidden rounded-lg border border-[#ffcc00]/25 bg-[#ffcc00]/10 px-2.5 py-1.5 transition-colors hover:bg-[#ffcc00]/20"
    >
      <Sparkle className="update-sparkle h-3 w-3 text-[#ffcc00]" />
      <span className="font-mono text-[9px] tracking-widest uppercase text-[#ffcc00]">
        v{update.version}
      </span>
    </button>
  );
}
