import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, Globe, X } from "lucide-react";
import TitleBar from "./components/TitleBar";
import Rail from "./components/Rail";
import FeaturedCard from "./components/FeaturedCard";
import ServiceRow from "./components/ServiceRow";
import UpdateToast, { UpdateBadge } from "./components/UpdateToast";
import { SERVICES } from "./data/services";
import { normalizar } from "./lib/normalizar";
import type { Service } from "./data/services";
import type { UpdateInfo } from "./bling";

/**
 * Pantalla del launcher (layout horizontal): rail con keyart + reloj a
 * la izquierda; a la derecha, buscador, servicio destacado y filas.
 * El catálogo vive en src/data/services.ts.
 *
 * Teclado: "/" enfoca el buscador, ↑↓ recorre los servicios y Enter
 * abre el seleccionado.
 */
export default function App() {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Servicios usados por última vez ──
  const [recents, setRecents] = useState<string[]>([]);

  // ── Actualizaciones ──
  const [version, setVersion] = useState("");
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    void window.bling.appVersion().then(setVersion);
    void window.bling.getRecents().then(setRecents);
    // El main avisa cuando aparece una versión más nueva (a los 5 s y
    // luego cada 4 h). Si el usuario ya la descartó, no vuelve a saltar.
    return window.bling.onUpdateAvailable((nueva) => {
      setUpdate(nueva);
      setToastVisible(true);
    });
  }, []);

  async function revisarActualizaciones() {
    if (buscando) return;
    setBuscando(true);
    try {
      const res = await window.bling.checkForUpdates();
      if (res.status === "available") {
        setUpdate(res.update);
        // Aunque la haya descartado antes, un chequeo manual la muestra.
        setToastVisible(true);
      } else {
        // Nada nuevo: mensaje breve de "estás al día".
        setUpdate(null);
        setToastVisible(false);
        flashAlDia();
      }
    } finally {
      setBuscando(false);
    }
  }

  const [alDia, setAlDia] = useState(false);
  function flashAlDia() {
    setAlDia(true);
    setTimeout(() => setAlDia(false), 2600);
  }

  function descartarAviso() {
    if (update) window.bling.dismissUpdate(update.version);
    setToastVisible(false);
  }

  /** Abre un servicio y lo registra como reciente. */
  const abrir = useCallback((service: Service) => {
    if (service.status !== "available" || !service.url) return;
    void window.bling
      .openService({
        id: service.id,
        url: service.url,
        title: service.name,
      })
      .then(() => window.bling.addRecent(service.id))
      .then(setRecents)
      .catch(() => {});
  }, []);

  /** Abre el servicio en el navegador del sistema (no embebido). */
  const abrirEnNavegador = useCallback((service: Service) => {
    if (!service.url) return;
    void window.bling.openExternal(service.url);
  }, []);

  const destacado = useMemo(
    () => SERVICES.find((s) => s.featured) ?? SERVICES[0],
    [],
  );

  const { recientesVisibles, disponibles, proximos, navegables } =
    useMemo(() => {
      const q = normalizar(query);
      const coincidencias = SERVICES.filter(
        (s) =>
          s.id !== destacado.id &&
          (!q ||
            normalizar(s.name).includes(q) ||
            normalizar(s.tagline).includes(q)),
      );

      // Los recientes sólo se muestran sin búsqueda activa, y nunca el
      // destacado (ya está arriba, no tiene sentido repetirlo).
      const idsRecientes = q ? [] : recents.filter((id) => id !== destacado.id);
      const enRecientes = new Set(idsRecientes);

      const recientesVisibles = idsRecientes
        .map((id) => coincidencias.find((s) => s.id === id))
        .filter(
          (s): s is Service => !!s && s.status === "available",
        );

      const disponibles = coincidencias.filter(
        (s) => s.status === "available" && !enRecientes.has(s.id),
      );
      const proximos = coincidencias.filter((s) => s.status === "soon");

      // Orden visual exacto, para que ↑↓ siga lo que se ve en pantalla.
      const navegables = [
        ...(!q && destacado.status === "available" ? [destacado] : []),
        ...recientesVisibles,
        ...disponibles,
      ];

      return { recientesVisibles, disponibles, proximos, navegables };
    }, [query, recents, destacado]);

  // ── Selección con teclado ──
  const [seleccion, setSeleccion] = useState<string | null>(null);

  // Re-seleccionar el primero sólo si la selección actual ya no existe
  // (p. ej. al buscar, o si un servicio pasó a "recientes" y cambió de
  // sección): así Enter no salta a otro sitio tras abrir algo.
  useEffect(() => {
    setSeleccion((prev) =>
      prev && navegables.some((s) => s.id === prev) ? prev : (navegables[0]?.id ?? null),
    );
  }, [navegables]);

  // Mantener a la vista el seleccionado al moverlo con ↑↓.
  useEffect(() => {
    if (!seleccion) return;
    document
      .querySelector(`[data-sid="${CSS.escape(seleccion)}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [seleccion]);

  // Atajos de teclado de todo el launcher.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const enBuscador = document.activeElement === inputRef.current;

      if (e.key === "/" && !enBuscador) {
        e.preventDefault();
        inputRef.current?.focus();
        return;
      }
      if (e.key === "Escape" && enBuscador) {
        inputRef.current?.blur();
        setQuery("");
        return;
      }

      // ↑↓ recorren los resultados aunque el foco esté en el buscador
      // (como en Spotlight o Raycast).
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        const total = navegables.length;
        if (!total) return;
        e.preventDefault();
        const i = navegables.findIndex((s) => s.id === seleccion);
        const siguiente =
          e.key === "ArrowDown"
            ? (i + 1) % total
            : i <= 0
              ? total - 1
              : i - 1;
        setSeleccion(navegables[siguiente].id);
        return;
      }

      if (e.key === "Enter") {
        const sel = navegables.find((s) => s.id === seleccion);
        if (sel) {
          e.preventDefault();
          abrir(sel);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navegables, seleccion, abrir]);

  return (
    <div className="flex h-full flex-col bg-[#09090b] text-white antialiased">
      <TitleBar />

      <div className="flex min-h-0 flex-1">
        <Rail />

        <main className="flex min-w-0 flex-1 flex-col">
          {/* ── Barra superior: buscador + web ── */}
          <div className="flex items-center gap-3 border-b border-white/5 px-7 py-4">
            <div className="relative flex-1 max-w-md">
              <Search
                size={14}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/35"
              />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar servicio…"
                className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-9 pr-16 text-xs text-white placeholder:text-white/35 outline-none transition-colors focus:border-white/25 focus:bg-white/[0.07]"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Limpiar búsqueda"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-white/40 transition-colors hover:text-white"
                >
                  <X size={12} />
                </button>
              ) : (
                <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[9px] text-white/40">
                  /
                </kbd>
              )}
            </div>

            <span className="ml-auto font-mono text-[9px] tracking-widest uppercase text-white/35">
              {SERVICES.filter((s) => s.status === "available").length} de{" "}
              {SERVICES.length} disponibles
            </span>

            {update && !toastVisible && (
              <UpdateBadge update={update} onOpen={() => setToastVisible(true)} />
            )}

            <button
              type="button"
              onClick={() => void window.bling.openExternal("https://bling.uy")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-mono text-[9px] tracking-widest uppercase text-white/60 transition-colors hover:border-white/25 hover:text-white"
            >
              <Globe size={11} />
              bling.uy
            </button>
          </div>

          {/* ── Contenido ── */}
          <div className="flex-1 overflow-y-auto px-7 py-6">
            <div className="mx-auto max-w-2xl">
              <h1 className="font-[var(--font-barlow)] text-2xl font-extralight leading-tight tracking-tight text-white">
                Servicios de Bling
                <span className="text-[#ffcc00]">.</span>
              </h1>
              <p className="mt-1.5 text-xs font-light text-white/55">
                Cada servicio se abre en su propia ventana, con tu sesión de
                Bling ya activa: entrás una vez y te conoce todo el ecosistema.
              </p>
              <p className="mt-2 font-mono text-[9px] tracking-widest uppercase text-white/30">
                <kbd className="rounded border border-white/10 bg-white/5 px-1 py-0.5">/</kbd> buscar
                <span className="mx-1.5 text-white/20">·</span>
                <kbd className="rounded border border-white/10 bg-white/5 px-1 py-0.5">↑↓</kbd> recorrer
                <span className="mx-1.5 text-white/20">·</span>
                <kbd className="rounded border border-white/10 bg-white/5 px-1 py-0.5">Enter</kbd> abrir
              </p>

              {/* Destacado */}
              {!query && (
                <div className="mt-6">
                  <FeaturedCard
                    service={destacado}
                    selected={destacado.id === seleccion}
                    onOpen={abrir}
                  />
                </div>
              )}

              {/* Recientes */}
              {!query && recientesVisibles.length > 0 && (
                <section className="mt-7">
                  <SectionHeader
                    label="Recientes"
                    count={recientesVisibles.length}
                  />
                  <div className="mt-3 space-y-2.5">
                    {recientesVisibles.map((s) => (
                      <ServiceRow
                        key={s.id}
                        service={s}
                        selected={s.id === seleccion}
                        onOpen={abrir}
                        onOpenExternal={abrirEnNavegador}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Servicios */}
              {disponibles.length > 0 && (
                <section className="mt-7">
                  <SectionHeader label="Disponibles" count={disponibles.length} />
                  <div className="mt-3 space-y-2.5">
                    {disponibles.map((s) => (
                      <ServiceRow
                        key={s.id}
                        service={s}
                        selected={s.id === seleccion}
                        onOpen={abrir}
                        onOpenExternal={abrirEnNavegador}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Próximamente */}
              {proximos.length > 0 && (
                <section className="mt-7">
                  <SectionHeader
                    label="Próximamente"
                    count={proximos.length}
                  />
                  <div className="mt-3 space-y-2.5">
                    {proximos.map((s) => (
                      <ServiceRow
                        key={s.id}
                        service={s}
                        selected={false}
                        onOpen={abrir}
                        onOpenExternal={abrirEnNavegador}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Sin resultados */}
              {query && navegables.length === 0 && (
                <p className="mt-10 text-center text-xs font-light text-white/40">
                  Ningún servicio coincide con «{query}».
                </p>
              )}

              {/* ── Pie ── */}
              <div className="mt-9 flex items-center justify-between border-t border-white/10 pt-4">
                <span className="font-mono text-[9px] tracking-widest uppercase text-white/35">
                  Bling Company · Uruguay
                </span>
                <button
                  type="button"
                  onClick={() => void revisarActualizaciones()}
                  disabled={buscando}
                  title="Buscar actualizaciones"
                  className="font-mono text-[9px] tracking-widest uppercase text-white/35 transition-colors hover:text-white/70 disabled:opacity-60"
                >
                  {buscando
                    ? "Buscando…"
                    : alDia
                      ? "Estás al día ✦"
                      : `v${version || "…"}`}
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* ── Aviso de nueva versión ── */}
      {update && toastVisible && (
        <div className="pointer-events-none fixed bottom-5 right-5 z-50">
          <UpdateToast update={update} onDismiss={descartarAviso} />
        </div>
      )}
    </div>
  );
}

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-[9px] tracking-widest uppercase text-white/40">
        {label}
      </span>
      <span className="h-px flex-1 bg-white/10" />
      <span className="font-mono text-[9px] tracking-widest text-white/30">
        {String(count).padStart(2, "0")}
      </span>
    </div>
  );
}
