import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Globe, X } from "lucide-react";
import TitleBar from "./components/TitleBar";
import Rail from "./components/Rail";
import FeaturedCard from "./components/FeaturedCard";
import ServiceRow from "./components/ServiceRow";
import UpdateToast, { UpdateBadge } from "./components/UpdateToast";
import { SERVICES } from "./data/services";
import type { UpdateInfo } from "./bling";

/**
 * Pantalla del launcher (layout horizontal): rail con keyart + reloj a
 * la izquierda; a la derecha, buscador, servicio destacado y filas.
 * El catálogo vive en src/data/services.ts.
 */
export default function App() {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Actualizaciones ──
  const [version, setVersion] = useState("");
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    void window.bling.appVersion().then(setVersion);
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

  // Atajo "/" enfoca el buscador (como en la mayoría de los launchers).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "/" && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape" && document.activeElement === inputRef.current) {
        inputRef.current?.blur();
        setQuery("");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const destacado = SERVICES.find((s) => s.featured) ?? SERVICES[0];
  const resto = SERVICES.filter((s) => s.id !== destacado.id);

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return resto;
    return resto.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.tagline.toLowerCase().includes(q),
    );
  }, [query, resto]);

  const disponibles = filtrados.filter((s) => s.status === "available");
  const proximos = filtrados.filter((s) => s.status === "soon");

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
                Cada servicio se abre en su propia ventana, con su sesión
                aparte.
              </p>

              {/* Destacado */}
              {!query && (
                <div className="mt-6">
                  <FeaturedCard service={destacado} />
                </div>
              )}

              {/* Servicios */}
              {disponibles.length > 0 && (
                <section className="mt-7">
                  <SectionHeader label="Disponibles" count={disponibles.length} />
                  <div className="mt-3 space-y-2.5">
                    {disponibles.map((s) => (
                      <ServiceRow key={s.id} service={s} />
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
                      <ServiceRow key={s.id} service={s} />
                    ))}
                  </div>
                </section>
              )}

              {/* Sin resultados */}
              {query && filtrados.length === 0 && (
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
