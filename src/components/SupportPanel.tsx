import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  Copy,
  Cpu,
  Pencil,
  ImagePlus,
  LifeBuoy,
  Loader2,
  Lock,
  Plus,
  RotateCcw,
  Send,
  Ticket,
  X,
} from "lucide-react";
import { acciones, adjuntosVisibles, estado, pedidoPendiente, puedeEditar, textoEditado, traePedido } from "@blingcompany/bling-ui/soporte";
import { MAX_CAPTURAS, useSoporte } from "../hooks/useSoporte";
import type { SoporteAdjunto } from "../bling";

/**
 * Pantalla de soporte del launcher: sidebar con la lista de tickets y el
 * chat del ticket elegido (o el compositor para abrir uno nuevo).
 *
 * Vive bajo la barra de título como vista propia del hub —mismo look
 * #09090b + amarillo Bling— y Escape la cierra. Todo habla con el proceso
 * principal por IPC (useSoporte); no hay red en el renderer.
 *
 * Ultra minimalista a propósito: un solo acento (#ffcc00), IDs en mono,
 * sin sombras ni gradientes, y la pregunta de datos del equipo sólo cuando
 * se abre un ticket (apagada por defecto).
 */

/** data URL de las capturas ya bajadas (mismo caché para todo el panel). */
const CACHE_IMAGENES = new Map<string, string>();

/** Punto de color del estado, en la paleta semántica de siempre. */
const PUNTOS: Record<string, string> = {
  open: "bg-[#4ade80]",
  in_progress: "bg-[#ffcc00]",
  resolved: "bg-[#38bdf8]",
  closed: "bg-white/25",
};

function puntoDe(valor: string): string {
  return PUNTOS[valor] ?? "bg-white/25";
}

/** Textos y acciones de cada estado: los mismos que el dashboard (bling-ui/soporte). */
function etiquetaDe(valor: string): string {
  return estado(valor).texto;
}

function horaDe(iso: string): string {
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime())
    ? ""
    : fecha.toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit" });
}

function fechaCorta(iso: string): string {
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime())
    ? ""
    : fecha.toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit" });
}

export default function SupportPanel({
  userId,
  onCerrar,
}: {
  userId: number | null;
  onCerrar: () => void;
}) {
  const {
    tickets,
    mensajes,
    seleccionado,
    cargando,
    enviando,
    error,
    datosEquipo,
    abrir,
    nuevo,
    responder,
    cerrar,
    reabrir,
    enviarDiagnostico,
    editar,
    limpiarError,
  } = useSoporte();
  /** Mensaje propio en edición (texto en curso). */
  const [editando, setEditando] = useState<{ id: number; texto: string } | null>(null);
  const [copiado, setCopiado] = useState<number | null>(null);

  /** true = se está armando un ticket nuevo (en vez de ver uno). */
  const [componiendo, setComponiendo] = useState(false);
  const [borrador, setBorrador] = useState("");
  const [borradorNuevo, setBorradorNuevo] = useState("");
  const [compartirDatos, setCompartirDatos] = useState(false);
  /** Capturas elegidas y todavía no subidas (se suben al enviar). */
  const [pendientes, setPendientes] = useState<{ file: File; preview: string }[]>([]);
  const archivoRef = useRef<HTMLInputElement>(null);
  const finRef = useRef<HTMLDivElement>(null);
  const pendientesRef = useRef(pendientes);
  pendientesRef.current = pendientes;

  const ticket = tickets.find((t) => t.id === seleccionado) ?? null;

  // Suelta los objectURL al desmontar el panel.
  useEffect(
    () => () => {
      for (const p of pendientesRef.current) URL.revokeObjectURL(p.preview);
    },
    [],
  );

  // Escape: primero cierra el compositor nuevo, después la pantalla entera.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      if (componiendo) {
        setComponiendo(false);
        return;
      }
      onCerrar();
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [componiendo, onCerrar]);

  // Siempre a la vista el final de la conversación.
  useEffect(() => {
    finRef.current?.scrollIntoView({ block: "end" });
  }, [mensajes.length, seleccionado, componiendo]);

  const agregarCapturas = useCallback((archivos: File[]) => {
    const validas = archivos.filter((f) => f.type.startsWith("image/"));
    if (!validas.length) return;
    setPendientes((prev) => {
      const cupo = Math.max(0, MAX_CAPTURAS - prev.length);
      return [
        ...prev,
        ...validas.slice(0, cupo).map((file) => ({
          file,
          preview: URL.createObjectURL(file),
        })),
      ];
    });
  }, []);

  const quitarCaptura = useCallback((indice: number) => {
    setPendientes((prev) => {
      URL.revokeObjectURL(prev[indice].preview);
      return prev.filter((_, i) => i !== indice);
    });
  }, []);

  const limpiarPendientes = useCallback(() => {
    setPendientes((prev) => {
      for (const p of prev) URL.revokeObjectURL(p.preview);
      return [];
    });
  }, []);

  /** Abre el compositor de ticket nuevo desde el sidebar. */
  const empezarNuevo = useCallback(() => {
    limpiarError();
    setComponiendo(true);
  }, [limpiarError]);

  const enviarNuevo = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const texto = borradorNuevo.trim();
      if (enviando || texto.length < 10) return;
      const creado = await nuevo(
        texto,
        pendientes.map((p) => p.file),
        compartirDatos,
      );
      if (creado) {
        setBorradorNuevo("");
        setCompartirDatos(false);
        limpiarPendientes();
        setComponiendo(false);
      }
    },
    [borradorNuevo, enviando, nuevo, pendientes, compartirDatos, limpiarPendientes],
  );

  const enviarRespuesta = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!ticket?.chat_id) return;
      const texto = borrador.trim();
      if (enviando || !texto) return;
      const ok = await responder(
        ticket.chat_id,
        texto,
        pendientes.map((p) => p.file),
      );
      if (ok) {
        setBorrador("");
        limpiarPendientes();
      }
    },
    [ticket, borrador, enviando, responder, pendientes, limpiarPendientes],
  );

  const onPegar = useCallback(
    (e: React.ClipboardEvent) => {
      const archivos = Array.from(e.clipboardData.files);
      if (!archivos.length) return;
      e.preventDefault();
      agregarCapturas(archivos);
    },
    [agregarCapturas],
  );

  return (
    <div
      className="fixed inset-x-0 bottom-0 top-9 z-40 flex bg-[#09090b]"
      role="dialog"
      aria-modal="true"
      aria-label="Soporte"
    >
      {/* ── Sidebar: tickets ── */}
      <aside className="flex w-72 shrink-0 flex-col border-r border-white/5">
        <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
          <LifeBuoy size={14} className="text-[#ffcc00]" />
          <span className="font-mono text-[10px] tracking-widest uppercase text-white/60">
            Soporte
          </span>
          <span aria-hidden className="h-3 w-px bg-white/10" />
          <span className="font-mono text-[9px] tracking-widest text-white/30">
            {tickets.length}
          </span>
          <button
            type="button"
            onClick={empezarNuevo}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 font-mono text-[9px] tracking-widest uppercase text-white/70 transition-colors hover:border-[#ffcc00]/40 hover:text-white"
          >
            <Plus size={11} />
            Nuevo
          </button>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar soporte"
            className="rounded-lg p-1.5 text-white/40 transition-colors hover:bg-white/5 hover:text-white"
          >
            <X size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2.5">
          {cargando && (
            <div className="space-y-2.5 px-1 py-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-lg bg-white/[0.04]" />
              ))}
            </div>
          )}

          {!cargando && tickets.length === 0 && !componiendo && (
            <div className="px-3 py-8 text-center">
              <p className="text-xs font-light text-white/45">Sin tickets todavía.</p>
              <p className="mt-1.5 font-mono text-[9px] tracking-widest uppercase text-white/25">
                Abrí uno con el botón Nuevo
              </p>
            </div>
          )}

          <ul className="space-y-1.5">
            {tickets.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => {
                    setComponiendo(false);
                    void abrir(t);
                  }}
                  className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${
                    seleccionado === t.id && !componiendo
                      ? "border-[#ffcc00]/40 bg-[#ffcc00]/10"
                      : "border-transparent hover:border-white/10 hover:bg-white/[0.03]"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${puntoDe(t.status)}`}
                    />
                    <span className="font-mono text-[10px] font-bold tracking-widest text-[#ffcc00]">
                      {t.ticket_number}
                    </span>
                    <span className="ml-auto font-mono text-[9px] text-white/25">
                      {fechaCorta(t.created_at)}
                    </span>
                  </span>
                  <span className="mt-1 block truncate text-xs font-light text-white/70">
                    {t.title}
                  </span>
                  <span className="mt-0.5 block font-mono text-[9px] tracking-widest uppercase text-white/30">
                    {etiquetaDe(t.status)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="border-t border-white/5 px-4 py-3">
          <span className="font-mono text-[9px] tracking-widest uppercase text-white/25">
            El equipo responde acá mismo
          </span>
        </div>
      </aside>

      {/* ── Panel derecho: compositor o chat ── */}
      <section className="flex min-w-0 flex-1 flex-col">
        {error && (
          <div className="flex items-center gap-2 border-b border-red-400/15 bg-red-500/[0.07] px-5 py-2.5">
            <p className="min-w-0 flex-1 text-xs font-light text-red-300/90">{error}</p>
            <button
              type="button"
              onClick={limpiarError}
              aria-label="Descartar aviso"
              className="rounded p-1 text-red-300/60 transition-colors hover:text-red-200"
            >
              <X size={12} />
            </button>
          </div>
        )}

        {componiendo ? (
          /* ── Ticket nuevo: primer mensaje y nada más ── */
          <form onSubmit={enviarNuevo} className="flex min-h-0 flex-1 flex-col">
            <header className="flex items-center gap-3 border-b border-white/5 px-6 py-3.5">
              <Ticket size={14} className="text-[#ffcc00]" />
              <span className="font-mono text-[10px] tracking-widest uppercase text-white/60">
                Nuevo ticket
              </span>
              <span className="ml-auto font-mono text-[9px] tracking-widest uppercase text-white/25">
                Se abre con tu primer mensaje
              </span>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <textarea
                autoFocus
                value={borradorNuevo}
                onChange={(e) => setBorradorNuevo(e.target.value)}
                onPaste={onPegar}
                maxLength={5000}
                rows={7}
                placeholder="Contanos qué pasó. Cuantos detalles mejor: qué hacías, qué esperabas y qué pasó."
                className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-sm leading-relaxed text-white outline-none transition-colors placeholder:text-white/30 hover:border-white/20 focus:border-[#ffcc00]/40"
              />

              <CapturasPendientes
                pendientes={pendientes}
                onQuitar={quitarCaptura}
                archivoRef={archivoRef}
              />

              {/* Pregunta de datos del equipo: apagada por defecto */}
              <label className="mt-4 flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 transition-colors hover:border-white/20">
                <span className="min-w-0">
                  <span className="block text-xs font-light text-white/85">
                    ¿Querés ofrecer más datos de tu equipo?
                  </span>
                  <span className="mt-0.5 block text-[10px] font-light leading-relaxed text-white/40">
                    {compartirDatos && datosEquipo
                      ? datosEquipo
                      : "Sistema operativo, versión del launcher, idioma y zona horaria. Nos ayuda a entender el problema."}
                  </span>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={compartirDatos}
                  aria-label="Compartir datos de mi equipo"
                  onClick={() => setCompartirDatos((v) => !v)}
                  className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full border transition-colors ${
                    compartirDatos
                      ? "border-[#ffcc00]/50 bg-[#ffcc00]/25"
                      : "border-white/15 bg-white/5"
                  }`}
                >
                  <span
                    className={`absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full transition-all ${
                      compartirDatos ? "left-[18px] bg-[#ffcc00]" : "left-[3px] bg-white/40"
                    }`}
                  />
                </button>
              </label>
            </div>

            <div className="border-t border-white/5 px-6 py-4">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setComponiendo(false)}
                  className="font-mono text-[9px] tracking-widest uppercase text-white/35 transition-colors hover:text-white/70"
                >
                  Volver
                </button>
                <button
                  type="submit"
                  disabled={enviando || borradorNuevo.trim().length < 10}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#ffcc00] px-4 py-2 font-mono text-[10px] font-bold tracking-widest uppercase text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {enviando ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                  {enviando ? "Enviando…" : "Abrir ticket"}
                </button>
              </div>
              <p className="mt-2 text-right font-mono text-[9px] tracking-widest uppercase text-white/25">
                Enter abre · hasta {MAX_CAPTURAS} capturas
              </p>
            </div>
          </form>
        ) : ticket ? (
          /* ── Chat del ticket ── */
          <>
            <header className="flex items-center gap-3 border-b border-white/5 px-6 py-3.5">
              <span
                aria-hidden
                className={`h-1.5 w-1.5 rounded-full ${puntoDe(ticket.status)}`}
              />
              <span className="font-mono text-sm font-bold tracking-widest text-[#ffcc00]">
                {ticket.ticket_number}
              </span>
              <span aria-hidden className="h-3 w-px bg-white/10" />
              <span className="min-w-0 truncate text-xs font-light text-white/55">
                {ticket.title}
              </span>
              <span className="ml-auto shrink-0 font-mono text-[9px] tracking-widest uppercase text-white/35">
                {etiquetaDe(ticket.status)}
              </span>
              {ticket.chat_id &&
                (acciones(ticket.status).reabrir ? (
                  <button
                    type="button"
                    onClick={() => void reabrir(ticket.chat_id!)}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 font-mono text-[9px] tracking-widest uppercase text-white/60 transition-colors hover:border-white/25 hover:text-white"
                  >
                    <RotateCcw size={10} />
                    Reabrir
                  </button>
                ) : acciones(ticket.status).cerrar && (
                  <button
                    type="button"
                    onClick={() => void cerrar(ticket.chat_id!)}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 font-mono text-[9px] tracking-widest uppercase text-white/60 transition-colors hover:border-white/25 hover:text-white"
                  >
                    <Lock size={10} />
                    Cerrar
                  </button>
                ))}
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              {mensajes.length === 0 && (
                <div className="flex h-full items-center justify-center">
                  <Loader2 size={16} className="animate-spin text-white/25" />
                </div>
              )}
              <div className="space-y-3">
                {mensajes.map((m) => {
                  const mio = userId !== null && m.sender_id === userId;
                  const editable = puedeEditar(m, userId, ticket.status);
                  const enEdicion = editando?.id === m.id;
                  const marca = textoEditado(m);
                  return (
                    <div key={m.id} className={`group flex flex-col ${mio ? "items-end" : "items-start"}`}>
                      <div
                        className={`max-w-[76%] rounded-xl border px-3.5 py-2.5 ${
                          mio
                            ? "border-[#ffcc00]/30 bg-[#ffcc00]/10"
                            : "border-white/10 bg-white/[0.04]"
                        }`}
                      >
                        {!mio && (
                          <p className="mb-1 font-mono text-[9px] tracking-widest uppercase text-white/40">
                            {m.sender_name || "Equipo Bling"}
                          </p>
                        )}
                        {traePedido(m) && (
                          <p className="mb-1 inline-flex items-center gap-1 font-mono text-[9px] tracking-widest uppercase text-[#ffcc00]">
                            <Cpu size={10} /> Pedido de información del sistema
                          </p>
                        )}
                        {m.is_deleted ? (
                          <p className="text-xs font-light italic text-white/35">
                            Mensaje eliminado
                          </p>
                        ) : enEdicion ? (
                          <div className="w-[min(28rem,60vw)] space-y-2">
                            <textarea
                              value={editando.texto}
                              onChange={(e) => setEditando({ id: m.id, texto: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === "Escape") setEditando(null);
                                if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && editando.texto.trim()) {
                                  void editar(m.id, editando.texto.trim(), ticket.chat_id!).then((ok) => ok && setEditando(null));
                                }
                              }}
                              rows={3}
                              maxLength={5000}
                              autoFocus
                              aria-label="Editar mensaje"
                              className="w-full resize-none rounded-lg border border-white/10 bg-black/30 px-2.5 py-2 text-xs leading-relaxed text-white outline-none focus:border-[#ffcc00]/40"
                            />
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] text-white/35">Va a quedar marcado como editado</span>
                              <span className="flex gap-1.5">
                                <button type="button" onClick={() => setEditando(null)} className="rounded-md border border-white/10 px-2.5 py-1 text-[11px] text-white/60 hover:text-white">
                                  Cancelar
                                </button>
                                <button
                                  type="button"
                                  disabled={enviando || !editando.texto.trim() || editando.texto.trim() === m.content}
                                  onClick={() => void editar(m.id, editando.texto.trim(), ticket.chat_id!).then((ok) => ok && setEditando(null))}
                                  className="rounded-md bg-[#ffcc00] px-2.5 py-1 text-[11px] font-medium text-black hover:opacity-90 disabled:opacity-40"
                                >
                                  Guardar
                                </button>
                              </span>
                            </div>
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-white/85">
                            {m.content}
                          </p>
                        )}
                        {adjuntosVisibles(m).length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {adjuntosVisibles(m).map((a) => (
                              <Captura key={a.url} adjunto={a} />
                            ))}
                          </div>
                        )}
                        <p className="mt-1 text-right font-mono text-[9px] text-white/30">
                          {horaDe(m.created_at)}
                          {marca && (
                            <span title={m.edited_at ? `Editado el ${new Date(m.edited_at).toLocaleString("es-UY")}` : undefined}> · {marca}</span>
                          )}
                        </p>
                      </div>
                      {!enEdicion && !m.is_deleted && m.content && (
                        <div className="mt-1 flex gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={() => {
                              void navigator.clipboard.writeText(m.content).then(() => {
                                setCopiado(m.id);
                                setTimeout(() => setCopiado((c) => (c === m.id ? null : c)), 1500);
                              });
                            }}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-white/45 hover:bg-white/5 hover:text-white"
                          >
                            {copiado === m.id ? <Check size={12} /> : <Copy size={12} />}
                            {copiado === m.id ? "Copiado" : "Copiar"}
                          </button>
                          {editable && (
                            <button
                              type="button"
                              onClick={() => setEditando({ id: m.id, texto: m.content })}
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-white/45 hover:bg-white/5 hover:text-white"
                            >
                              <Pencil size={12} /> Editar
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div ref={finRef} />
            </div>

            {ticket.chat_id && pedidoPendiente(mensajes, userId) && (
              <div className="mx-6 mb-3 flex items-center gap-3 rounded-xl border border-[#ffcc00]/30 bg-[#ffcc00]/[0.06] px-4 py-3">
                <Cpu size={16} className="shrink-0 text-[#ffcc00]" />
                <p className="flex-1 text-xs font-light leading-relaxed text-white/75">
                  El equipo de Bling te pidió la información del sistema: versión del launcher,
                  sistema operativo, idioma y zona horaria. No incluye datos personales.
                </p>
                <button
                  type="button"
                  disabled={enviando}
                  onClick={() => void enviarDiagnostico(ticket.id, ticket.chat_id!)}
                  className="shrink-0 rounded-lg bg-[#ffcc00] px-3 py-1.5 font-mono text-[9px] tracking-widest uppercase text-black transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  Enviar
                </button>
              </div>
            )}

            {!acciones(ticket.status).responder ? (
              <p className="border-t border-white/5 px-6 py-4 text-xs font-light text-white/40">
                {acciones(ticket.status).reabrir
                  ? "Este ticket está resuelto. Si necesitás seguir, reabrilo."
                  : "Este ticket está cerrado. Si necesitás algo más, abrí uno nuevo."}
              </p>
            ) : (
            <form onSubmit={enviarRespuesta} className="border-t border-white/5 px-6 py-4">
              <CapturasPendientes
                pendientes={pendientes}
                onQuitar={quitarCaptura}
                archivoRef={archivoRef}
              />
              <div className="flex items-end gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-2 transition-colors focus-within:border-[#ffcc00]/40">
                <button
                  type="button"
                  onClick={() => archivoRef.current?.click()}
                  disabled={pendientes.length >= MAX_CAPTURAS}
                  aria-label="Agregar capturas"
                  title={`Hasta ${MAX_CAPTURAS} capturas`}
                  className="rounded-lg p-1.5 text-white/45 transition-colors hover:text-white disabled:opacity-30"
                >
                  <ImagePlus size={15} />
                </button>
                <textarea
                  value={borrador}
                  onChange={(e) => setBorrador(e.target.value)}
                  onPaste={onPegar}
                  maxLength={5000}
                  rows={2}
                  placeholder="Escribí tu respuesta…"
                  className="max-h-32 min-h-[2.25rem] flex-1 resize-none bg-transparent py-1 text-sm leading-relaxed text-white outline-none placeholder:text-white/30"
                />
                <button
                  type="submit"
                  disabled={enviando || !borrador.trim()}
                  aria-label="Enviar"
                  className="rounded-lg bg-[#ffcc00] p-2 text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {enviando ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Send size={14} />
                  )}
                </button>
              </div>
              <p className="mt-2 text-right font-mono text-[9px] tracking-widest uppercase text-white/25">
                Enter envía · Shift+Enter salto
              </p>
              <input
                ref={archivoRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  agregarCapturas(Array.from(e.target.files ?? []));
                  e.target.value = "";
                }}
              />
            </form>
            )}
          </>
        ) : (
          /* ── Sin ticket seleccionado ── */
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-8 text-center">
            <LifeBuoy size={28} className="text-white/15" />
            <p className="mt-4 text-sm font-light text-white/60">
              ¿Algo no anda? Escribinos.
            </p>
            <p className="mt-1.5 max-w-sm text-xs font-light leading-relaxed text-white/35">
              Abrí un ticket con tu primer mensaje: te queda el ID a la vista y
              el equipo te contesta acá mismo.
            </p>
            <button
              type="button"
              onClick={empezarNuevo}
              className="mt-5 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 font-mono text-[10px] tracking-widest uppercase text-white/70 transition-colors hover:border-[#ffcc00]/40 hover:text-white"
            >
              <Plus size={12} />
              Nuevo ticket
            </button>
            <p className="mt-6 font-mono text-[9px] tracking-widest uppercase text-white/20">
              Escape para volver
            </p>
          </div>
        )}
      </section>

      {/* File input único del panel (para el chat y el compositor nuevo). */}
      <input
        ref={archivoRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          agregarCapturas(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
    </div>
  );
}

/** Chips de las capturas elegidas (todavía sin subir) + botón de agregar. */
function CapturasPendientes({
  pendientes,
  onQuitar,
  archivoRef,
}: {
  pendientes: { file: File; preview: string }[];
  onQuitar: (indice: number) => void;
  archivoRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <>
      {pendientes.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {pendientes.map((p, i) => (
            <div
              key={p.preview}
              className="group relative h-20 w-20 overflow-hidden rounded-lg border border-white/10"
            >
              <img
                src={p.preview}
                alt={p.file.name}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => onQuitar(i)}
                aria-label={`Quitar ${p.file.name}`}
                className="absolute right-1 top-1 rounded-md bg-black/70 p-1 text-white/70 opacity-0 transition-opacity group-hover:opacity-100 hover:text-white"
              >
                <X size={11} />
              </button>
            </div>
          ))}
          {pendientes.length < MAX_CAPTURAS && (
            <button
              type="button"
              onClick={() => archivoRef.current?.click()}
              className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-white/15 text-white/40 transition-colors hover:border-[#ffcc00]/40 hover:text-white/70"
            >
              <ImagePlus size={16} />
              <span className="font-mono text-[8px] tracking-widest uppercase">
                Agregar
              </span>
            </button>
          )}
        </div>
      )}
    </>
  );
}

/**
 * Miniatura de una captura ya enviada. El archivo vive en /uploads detrás
 * del reto de Cloudflare, así que se baja por el puente como data URL (con
 * caché) — directo con <img src="/uploads/…"> no llegarían las cookies.
 */
function Captura({ adjunto }: { adjunto: SoporteAdjunto }) {
  const [src, setSrc] = useState<string | null>(
    () => CACHE_IMAGENES.get(adjunto.url) ?? null,
  );
  const [falla, setFalla] = useState(false);

  useEffect(() => {
    if (src) return;
    let vivo = true;
    void window.bling.soporteImagen(adjunto.url).then((r) => {
      if (!vivo) return;
      if (r.ok) {
        CACHE_IMAGENES.set(adjunto.url, r.dataUrl);
        setSrc(r.dataUrl);
      } else {
        setFalla(true);
      }
    });
    return () => {
      vivo = false;
    };
  }, [adjunto.url, src]);

  if (src) {
    return (
      <img
        src={src}
        alt={adjunto.filename}
        title={adjunto.filename}
        className="h-20 w-20 rounded-lg border border-white/10 object-cover"
      />
    );
  }
  if (falla) {
    return (
      <button
        type="button"
        onClick={() => void window.bling.openExternal(`https://www.bling.uy${adjunto.url}`)}
        title={adjunto.filename}
        className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-1.5 text-center text-white/45 transition-colors hover:border-white/25 hover:text-white/70"
      >
        <ImagePlus size={14} />
        <span className="w-full truncate font-mono text-[8px]">{adjunto.filename}</span>
      </button>
    );
  }
  return (
    <div className="h-20 w-20 animate-pulse rounded-lg border border-white/10 bg-white/[0.04]" />
  );
}
