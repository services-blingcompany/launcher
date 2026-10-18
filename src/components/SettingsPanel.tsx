import { useEffect, useState } from "react";
import { MessageSquare, Minus, Newspaper, Plus, X, Trash2, RefreshCw } from "lucide-react";
import Sparkle from "./Sparkle";
import ReportDialog from "./ReportDialog";
import { PASO_ZOOM, ZOOM_MAX, ZOOM_MIN, acotarZoom, porcentajeDeZoom } from "../lib/zoom";
import { etiquetaDeAtajo } from "../lib/normalizar";
import type { Settings, UpdateCheckResult } from "../bling";

/** Página de novedades: la misma que usa el aviso de actualización. */
const NOVEDADES = "https://github.com/services-blingcompany/launcher/releases";

/**
 * Panel de ajustes. Se superpone al hub con fondo difuso; Escape o la X
 * lo cierran. Los cambios se aplican en caliente en el proceso principal
 * (bandeja, auto-launch, descarga de updates) por lo que el switch sólo
 * refleja el estado que devuelve el main.
 */
export default function SettingsPanel({
  settings,
  onSet,
  version,
  buscando,
  onBuscarActualizaciones,
  onBorrarRecientes,
  onCerrar,
  ultimoResultado,
}: {
  settings: Settings;
  onSet: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  version: string;
  buscando: boolean;
  onBuscarActualizaciones: () => void;
  onBorrarRecientes: () => void;
  onCerrar: () => void;
  ultimoResultado?: UpdateCheckResult | null;
}) {
  const [reporteAbierto, setReporteAbierto] = useState(false);
  const [atajoRegistrado, setAtajoRegistrado] = useState<string | null>(null);

  // El atajo lo registra el proceso principal: se le pregunta cuál quedó activo.
  // Puede no haber ninguno si otra aplicación ya usa esas combinaciones, así que
  // el panel no puede prometer una combinación que no funciona.
  useEffect(() => {
    let vigente = true;
    window.bling
      .atajoGlobal()
      .then((atajo) => {
        if (vigente) setAtajoRegistrado(atajo);
      })
      .catch(() => {});
    return () => {
      vigente = false;
    };
  }, [settings.atajoGlobal]);

  const descripcionAtajo = !settings.atajoGlobal
    ? "Trae el launcher al frente desde cualquier aplicación con Ctrl + Shift + B."
    : atajoRegistrado
      ? `${etiquetaDeAtajo(atajoRegistrado)} trae el launcher al frente desde cualquier aplicación.`
      : "No se pudo registrar: otra aplicación ya usa esas combinaciones.";

  // Escape cierra, como en cualquier modal que se respeta.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      // Si el reporte está abierto, ese Escape es de él: este panel está
      // escuchando primero, así que se hace a un lado.
      if (reporteAbierto) return;
      onCerrar();
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onCerrar, reporteAbierto]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm"
      onClick={onCerrar}
      role="dialog"
      aria-modal="true"
      aria-label="Ajustes"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="update-toast relative w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900 to-zinc-950 shadow-[0_24px_60px_-16px_rgba(0,0,0,0.8)]"
      >
        {/* Línea de acento superior */}
        <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-[#ffcc00] via-[#ffcc00]/40 to-transparent" />

        <div className="relative max-h-[85vh] overflow-y-auto p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Sparkle className="h-3.5 w-3.5 text-[#ffcc00]" />
              <h2 className="font-[var(--font-montserrat)] text-xl font-extralight tracking-tight text-white">
                Ajustes
              </h2>
            </div>
            <button
              type="button"
              onClick={onCerrar}
              aria-label="Cerrar ajustes"
              className="-mr-1 -mt-1 rounded-lg p-1.5 text-white/40 transition-colors hover:bg-white/5 hover:text-white"
            >
              <X size={15} />
            </button>
          </div>

          {/* ── General ── */}
          <Section label="General" />
          <Toggle
            label="Abrir al iniciar Windows"
            description="El launcher arranca solo cuando entrás a la sesión."
            checked={settings.abrirAlIniciar}
            onChange={(v) => onSet("abrirAlIniciar", v)}
          />
          <Toggle
            label="Minimizar a la bandeja al cerrar"
            description="Cerrar la ventana la esconde; para salir de verdad usá Salir en la bandeja."
            checked={settings.minimizarBandeja}
            onChange={(v) => onSet("minimizarBandeja", v)}
          />
          <Toggle
            label="Atajo global"
            description={descripcionAtajo}
            checked={settings.atajoGlobal}
            onChange={(v) => onSet("atajoGlobal", v)}
          />
          <div className="mt-2.5 flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <div className="min-w-0">
              <div className="text-xs font-light text-white/85">
                Tamaño de la interfaz
              </div>
              <div className="mt-0.5 text-[10px] font-light leading-relaxed text-white/40">
                Ctrl +, Ctrl − y Ctrl 0, desde cualquier ventana.
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => onSet("zoom", acotarZoom(settings.zoom - PASO_ZOOM))}
                disabled={settings.zoom <= ZOOM_MIN}
                aria-label="Reducir el tamaño de la interfaz"
                className="rounded-lg border border-white/15 p-1.5 text-white/60 transition-colors hover:border-white/30 hover:text-white disabled:opacity-40"
              >
                <Minus size={11} />
              </button>
              <button
                type="button"
                onClick={() => onSet("zoom", 0)}
                title="Volver al 100 %"
                className="w-11 rounded-lg py-1 text-center font-mono text-[10px] text-white/60 transition-colors hover:text-white"
              >
                {porcentajeDeZoom(settings.zoom)}
              </button>
              <button
                type="button"
                onClick={() => onSet("zoom", acotarZoom(settings.zoom + PASO_ZOOM))}
                disabled={settings.zoom >= ZOOM_MAX}
                aria-label="Agrandar el tamaño de la interfaz"
                className="rounded-lg border border-white/15 p-1.5 text-white/60 transition-colors hover:border-white/30 hover:text-white disabled:opacity-40"
              >
                <Plus size={11} />
              </button>
            </div>
          </div>

          {/* ── Notificaciones ── */}
          <Section label="Notificaciones" />
          <Toggle
            label="Avisos de escritorio"
            description="Aviso de Windows cuando llegan notificaciones nuevas, con el icono marcado en la barra de tareas."
            checked={settings.avisosEscritorio}
            onChange={(v) => onSet("avisosEscritorio", v)}
          />

          {/* ── Actualizaciones ── */}
          <Section label="Actualizaciones" />
          <Toggle
            label="Descargar automáticamente"
            description="Baja las versiones nuevas en segundo plano y las instala al salir."
            checked={settings.descargarActualizaciones}
            onChange={(v) => onSet("descargarActualizaciones", v)}
          />
          <div className="mt-3 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <div>
              <div className="text-xs font-light text-white/80">
                Versión instalada
              </div>
              <div className="font-mono text-[9px] tracking-widest uppercase text-white/35">
                {ultimoResultado?.update
                  ? `Hay una v${ultimoResultado.update.version} más nueva`
                  : "Estás al día"}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] tracking-widest text-white/70">
                v{version || "…"}
              </span>
              <button
                type="button"
                onClick={onBuscarActualizaciones}
                disabled={buscando}
                title="Buscar actualizaciones ahora"
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-1.5 font-mono text-[9px] tracking-widest uppercase text-white/60 transition-colors hover:border-white/30 hover:text-white disabled:opacity-50"
              >
                <RefreshCw size={10} className={buscando ? "animate-spin" : ""} />
                {buscando ? "Buscando…" : "Buscar"}
              </button>
            </div>
          </div>

          {/* ── Datos ── */}
          <Section label="Datos" />
          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <div>
              <div className="text-xs font-light text-white/80">
                Servicios recientes
              </div>
              <div className="font-mono text-[9px] tracking-widest uppercase text-white/35">
                Se guardan sólo en tu equipo.
              </div>
            </div>
            <button
              type="button"
              onClick={onBorrarRecientes}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-1.5 font-mono text-[9px] tracking-widest uppercase text-white/60 transition-colors hover:border-red-500/40 hover:text-red-400"
            >
              <Trash2 size={10} />
              Borrar
            </button>
          </div>

          {/* ── Acerca de ── */}
          <Section label="Acerca de" />
          <div className="mt-2.5 flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <div className="min-w-0">
              <div className="text-xs font-light text-white/85">
                Bling Launcher
              </div>
              <div className="font-mono text-[9px] tracking-widest uppercase text-white/35">
                Versión {version || "…"}
              </div>
            </div>
            <button
              type="button"
              onClick={() => void window.bling.openUpdateLink(NOVEDADES)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-1.5 font-mono text-[9px] tracking-widest uppercase text-white/60 transition-colors hover:border-white/30 hover:text-white"
            >
              <Newspaper size={10} />
              Novedades
            </button>
          </div>

          <div className="mt-2.5 flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <div className="min-w-0">
              <div className="text-xs font-light text-white/85">
                ¿Algo no anda?
              </div>
              <div className="mt-0.5 text-[10px] font-light leading-relaxed text-white/40">
                Copiá el diagnóstico y pegalo donde nos escribas.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setReporteAbierto(true)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-1.5 font-mono text-[9px] tracking-widest uppercase text-white/60 transition-colors hover:border-[#ffcc00]/40 hover:text-white"
            >
              <MessageSquare size={10} />
              Reportar
            </button>
          </div>
        </div>
      </div>

      {reporteAbierto && (
        <ReportDialog onCerrar={() => setReporteAbierto(false)} />
      )}
    </div>
  );
}

function Section({ label }: { label: string }) {
  return (
    <div className="mt-6 mb-3 flex items-center gap-3 first:mt-0">
      <span className="font-mono text-[9px] tracking-widest uppercase text-white/40">
        {label}
      </span>
      <span className="h-px flex-1 bg-white/10" />
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="mt-2.5 flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 transition-colors hover:border-white/20">
      <span className="min-w-0">
        <span className="block text-xs font-light text-white/85">{label}</span>
        <span className="mt-0.5 block text-[10px] font-light leading-relaxed text-white/40">
          {description}
        </span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full border transition-colors ${
          checked
            ? "border-[#ffcc00]/50 bg-[#ffcc00]/25"
            : "border-white/15 bg-white/5"
        }`}
      >
        <span
          className={`absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full transition-all ${
            checked
              ? "left-[18px] bg-[#ffcc00]"
              : "left-[3px] bg-white/40"
          }`}
        />
      </button>
    </label>
  );
}
