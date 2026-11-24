import { useCallback, useEffect, useState } from "react";
import { Bell, CheckCheck, LoaderCircle, X } from "lucide-react";
import type { NotificacionBling } from "../bling";

/** "hace 5 min", "hace 3 h", "ayer", "12 nov" a partir de un ISO. */
export function haceCuanto(iso: string, ahora: Date = new Date()): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return "";
  const seg = Math.max(0, Math.round((ahora.getTime() - fecha.getTime()) / 1000));
  if (seg < 60) return "recién";
  const min = Math.round(seg / 60);
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const dias = Math.round(h / 24);
  if (dias === 1) return "ayer";
  if (dias < 7) return `hace ${dias} días`;
  return fecha.toLocaleDateString("es-UY", { day: "numeric", month: "short" });
}

type Estado =
  | { tipo: "cargando" }
  | { tipo: "error"; mensaje: string }
  | { tipo: "listo"; lista: NotificacionBling[] };

/**
 * Panel lateral con las notificaciones de la cuenta, dentro del launcher.
 * Reemplaza a la página www.bling.uy/bling/notifications (404) y a la
 * ventana aparte que se abría para mostrarla.
 */
export default function NotificationsPanel({
  onCerrar,
  onCambio,
}: {
  onCerrar: () => void;
  /** Algo se marcó como leído: el contador de la campana se relee. */
  onCambio: () => void;
}) {
  const [estado, setEstado] = useState<Estado>({ tipo: "cargando" });
  const [marcando, setMarcando] = useState(false);

  const cargar = useCallback(async () => {
    const r = await window.bling.authNotificationsList();
    if (r.ok) setEstado({ tipo: "listo", lista: r.notificaciones });
    else
      setEstado({
        tipo: "error",
        mensaje:
          r.codigo === "sin-sesion"
            ? "Iniciá sesión para ver tus notificaciones."
            : "No se pudieron cargar las notificaciones. Probá en un rato.",
      });
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  // Escape cierra, como los otros paneles.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCerrar();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCerrar]);

  async function marcar(id: number | null) {
    if (estado.tipo !== "listo") return;
    // Optimista: se ve leída al instante; si falla, se recarga la lista real.
    setEstado({
      tipo: "listo",
      lista: estado.lista.map((n) => (id === null || n.id === id ? { ...n, leida: true } : n)),
    });
    if (id === null) setMarcando(true);
    const ok = await window.bling.authNotificationsRead(id);
    setMarcando(false);
    if (!ok) void cargar();
    onCambio();
  }

  const sinLeer = estado.tipo === "listo" ? estado.lista.filter((n) => !n.leida).length : 0;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-label="Notificaciones">
      <button
        type="button"
        aria-label="Cerrar notificaciones"
        onClick={onCerrar}
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
      />
      <aside className="relative flex h-full w-full max-w-sm flex-col border-l border-white/10 bg-zinc-950 shadow-[0_0_60px_-10px_rgba(0,0,0,0.9)]">
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2">
            <Bell size={14} className="text-white/60" />
            <h2 className="font-mono text-[10px] tracking-widest uppercase text-white/80">
              Notificaciones
            </h2>
            {sinLeer > 0 && (
              <span className="rounded-full bg-[#ffcc00] px-1.5 font-mono text-[9px] font-medium text-black">
                {sinLeer}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {sinLeer > 0 && (
              <button
                type="button"
                onClick={() => void marcar(null)}
                disabled={marcando}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 font-mono text-[9px] tracking-wider uppercase text-white/55 transition-colors hover:border-white/25 hover:text-white disabled:opacity-60"
              >
                {marcando ? <LoaderCircle size={11} className="animate-spin" /> : <CheckCheck size={11} />}
                Marcar todas
              </button>
            )}
            <button
              type="button"
              onClick={onCerrar}
              aria-label="Cerrar"
              className="rounded-lg p-1.5 text-white/45 transition-colors hover:bg-white/5 hover:text-white"
            >
              <X size={14} />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {estado.tipo === "cargando" && (
            <div className="flex items-center justify-center gap-2 py-16 text-[11px] text-white/45">
              <LoaderCircle size={13} className="animate-spin" />
              Cargando…
            </div>
          )}
          {estado.tipo === "error" && (
            <p className="px-6 py-16 text-center text-[12px] font-light text-white/55">
              {estado.mensaje}
            </p>
          )}
          {estado.tipo === "listo" && estado.lista.length === 0 && (
            <div className="px-6 py-16 text-center">
              <Bell size={18} className="mx-auto text-white/20" />
              <p className="mt-3 text-[12px] font-light text-white/55">No tenés notificaciones.</p>
            </div>
          )}
          {estado.tipo === "listo" && estado.lista.length > 0 && (
            <ul className="divide-y divide-white/[0.06]">
              {estado.lista.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => !n.leida && void marcar(n.id)}
                    className={`flex w-full gap-3 px-5 py-3.5 text-left transition-colors hover:bg-white/[0.03] ${
                      n.leida ? "cursor-default" : ""
                    }`}
                    title={n.leida ? undefined : "Marcar como leída"}
                  >
                    <span
                      aria-hidden
                      className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                        n.leida ? "bg-transparent" : "bg-[#ffcc00]"
                      }`}
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block text-[13px] leading-snug ${
                          n.leida ? "font-light text-white/60" : "text-white"
                        }`}
                      >
                        {n.titulo}
                      </span>
                      {n.cuerpo && (
                        <span className="mt-0.5 line-clamp-2 block text-[11.5px] font-light text-white/45">
                          {n.cuerpo}
                        </span>
                      )}
                      <span className="mt-1 block font-mono text-[9px] tracking-wider uppercase text-white/30">
                        {haceCuanto(n.fecha)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}
