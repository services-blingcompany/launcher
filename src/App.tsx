import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, Globe, X, Settings as SettingsIcon } from "lucide-react";
import TitleBar from "./components/TitleBar";
import Rail from "./components/Rail";
import FeaturedCard from "./components/FeaturedCard";
import ServiceRow from "./components/ServiceRow";
import UpdateToast, { UpdateBadge } from "./components/UpdateToast";
import SettingsPanel from "./components/SettingsPanel";
import UserMenu from "./components/UserMenu";
import LoginDialog from "./components/LoginDialog";
import AccountPanel from "./components/AccountPanel";
import { datosDeUsuario, useSession } from "./hooks/useSession";
import { SERVICES } from "./data/services";
import { normalizar } from "./lib/normalizar";
import { nivelDeTeclaZoom } from "./lib/zoom";
import type { Service } from "./data/services";
import type {
  Settings,
  UpdateInfo,
  UpdateProgress,
  UpdateCheckResult,
} from "./bling";

const DEFAULT_SETTINGS: Settings = {
  abrirAlIniciar: false,
  minimizarBandeja: false,
  descargarActualizaciones: true,
  zoom: 0,
};

/**
 * Pantalla del launcher (layout horizontal): rail con campana + reloj a
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
  const [progress, setProgress] = useState<UpdateProgress | null>(null);
  const [descargado, setDescargado] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [ultimoResultado, setUltimoResultado] =
    useState<UpdateCheckResult | null>(null);

  // ── Ajustes ──
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ajustesAbiertos, setAjustesAbiertos] = useState(false);

  // ── Sesión de Bling (login nativo + jar compartido con los servicios) ──
  const { user, cargando, sinLeer, login, logout } = useSession();
  const [loginAbierto, setLoginAbierto] = useState(false);

  useEffect(() => {
    void window.bling.appVersion().then(setVersion);
    void window.bling.getRecents().then(setRecents);
    void window.bling.getSettings().then(setSettings);

    // La bandeja necesita el catálogo para su submenú de servicios.
    window.bling.setCatalog(
      SERVICES.map((s) => ({ id: s.id, name: s.name })),
    );

    // El main avisa cuando aparece una versión más nueva (a los 5 s y
    // luego cada 4 h). Si el usuario ya la descartó, no vuelve a saltar.
    const offAvailable = window.bling.onUpdateAvailable((nueva) => {
      setUpdate(nueva);
      setToastVisible(true);
    });
    const offProgress = window.bling.onUpdateProgress((p) => {
      setProgress(p);
      if (p) setDescargado(false);
    });
    const offDownloaded = window.bling.onUpdateDownloaded((nueva) => {
      setUpdate(nueva);
      setProgress(null);
      setDescargado(true);
      setToastVisible(true);
    });
    // La bandeja pide abrir un servicio concreto.
    const offTray = window.bling.onOpenService((id) => {
      const svc = SERVICES.find((s) => s.id === id);
      if (svc) abrir(svc);
    });
    // El main también cambia ajustes por su cuenta: Ctrl +/- es zoom.
    const offAjustes = window.bling.onSettingsChanged(setSettings);

    // Un servicio pedido antes de que existiera esta ventana (jump list o
    // --abrir=) se abre apenas se monta.
    void window.bling.takePendingService().then((id) => {
      const svc = SERVICES.find((s) => s.id === id);
      if (svc) abrir(svc);
    });

    return () => {
      offAvailable();
      offProgress();
      offDownloaded();
      offTray();
      offAjustes();
    };
  }, []);

  /**
   * Ctrl + / Ctrl − / Ctrl 0: tamaño de la interfaz. En el hub se atiende acá
   * (y no en el proceso principal) para que el zoom y lo que muestra el panel
   * de ajustes salgan siempre del mismo estado. Las ventanas de servicio, que
   * son páginas ajenas, sí lo resuelven en el main.
   */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!e.ctrlKey && !e.metaKey) return;
      const nivel = nivelDeTeclaZoom(e.key, settings.zoom);
      if (nivel === null) return;
      e.preventDefault();
      void window.bling.setSetting("zoom", nivel).then(setSettings);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [settings.zoom]);

  async function revisarActualizaciones() {
    if (buscando) return;
    setBuscando(true);
    try {
      const res = await window.bling.checkForUpdates();
      setUltimoResultado(res);
      if (res.status === "available" && res.update) {
        setUpdate(res.update);
        setDescargado(res.downloaded);
        setProgress(res.progress);
        // Aunque la haya descartado antes, un chequeo manual la muestra.
        setToastVisible(true);
      } else {
        // Nada nuevo: mensaje breve de "estás al día".
        setUpdate(null);
        setProgress(null);
        setDescargado(false);
        setToastVisible(false);
        flashAlDia();
      }
    } finally {
      setBuscando(false);
    }
  }

  /** Cambia un ajuste y guarda el estado que devuelve el proceso principal. */
  const setAjuste = useCallback(
    <K extends keyof Settings>(key: K, value: Settings[K]) => {
      void window.bling.setSetting(key, value).then(setSettings);
    },
    [],
  );

  const borrarRecientes = useCallback(() => {
    void window.bling.clearRecents().then(setRecents);
  }, []);

  const [alDia, setAlDia] = useState(false);
  function flashAlDia() {
    setAlDia(true);
    setTimeout(() => setAlDia(false), 2600);
  }

  function descartarAviso() {
    if (update) window.bling.dismissUpdate(update.version);
    setToastVisible(false);
  }

  /** Pide bajar la versión disponible; el progreso llega por push. */
  function descargarActualizacion() {
    void window.bling.downloadUpdate();
  }

  /** Cierra la app y lanza el instalador ya descargado. */
  function instalarActualizacion() {
    window.bling.installUpdate();
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

  // Presentación de la cabecera: si hay sesión, saluda por su nombre.
  const cuenta = user ? datosDeUsuario(user) : null;
  const saludo = cuenta
    ? `Buenas, ${cuenta.nombre.split(" ")[0]}`
    : "Servicios de Bling";
  const bajada = cuenta
    ? "Tu sesión está activa: cada servicio se abre con vos adentro."
    : "Entrás una vez y te conoce todo el ecosistema.";
  const totalDisponibles = SERVICES.filter(
    (s) => s.status === "available",
  ).length;

  return (
    <div className="flex h-full flex-col bg-[#09090b] text-white antialiased">
      <TitleBar />

      <div className="flex min-h-0 flex-1">
        <Rail />

        <main className="flex min-w-0 flex-1 flex-col">
          {/* ── Barra superior: identidad + accesos ── */}
          <div className="flex items-center gap-3 border-b border-white/5 px-7 py-3.5">
            <span className="font-mono text-[9px] tracking-widest uppercase text-white/30">
              Bling Launcher
            </span>
            <span aria-hidden className="h-3 w-px bg-white/10" />
            <span className="font-mono text-[9px] tracking-widest uppercase text-white/25">
              v{version || "…"}
            </span>

            <div className="ml-auto flex items-center gap-2">
              {update && !toastVisible && (
                <UpdateBadge update={update} onOpen={() => setToastVisible(true)} />
              )}

              <button
                type="button"
                onClick={() => setAjustesAbiertos(true)}
                aria-label="Ajustes"
                title="Ajustes"
                className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/5 p-2 text-white/60 transition-colors hover:border-white/25 hover:text-white"
              >
                <SettingsIcon size={13} />
              </button>

              <button
                type="button"
                onClick={() => void window.bling.openExternal("https://bling.uy")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-mono text-[9px] tracking-widest uppercase text-white/60 transition-colors hover:border-white/25 hover:text-white"
              >
                <Globe size={11} />
                bling.uy
              </button>

              <UserMenu
                user={user}
                cargando={cargando}
                sinLeer={sinLeer}
                onAbrirLogin={() => setLoginAbierto(true)}
                onCerrarSesion={() => void logout()}
              />
            </div>
          </div>

          {/* ── Contenido: columna principal + cuenta ── */}
          <div className="flex-1 overflow-y-auto px-7 py-7">
            <div className="mx-auto flex w-full max-w-2xl gap-9 xl:max-w-[1040px]">
              <div className="min-w-0 flex-1">
                {/* Encabezado: quién sos + qué podés abrir */}
                <p className="flex items-center gap-2 font-mono text-[9px] tracking-widest uppercase text-white/30">
                  <span
                    aria-hidden
                    className={`h-1.5 w-1.5 rounded-full ${
                      cargando
                        ? "animate-pulse bg-white/30"
                        : user
                          ? "bg-[#ffcc00]"
                          : "bg-white/20"
                    }`}
                  />
                  {cargando
                    ? "Buscando sesión"
                    : user
                      ? "Sesión activa"
                      : "Sin sesión"}
                </p>
                <h1 className="mt-2.5 font-[var(--font-montserrat)] text-3xl font-extralight leading-tight tracking-tight text-white">
                  {saludo}
                  <span className="text-[#ffcc00]">.</span>
                </h1>
                <p className="mt-1.5 text-xs font-light text-white/50">
                  {bajada}
                </p>

                {/* Buscador: el protagonista del launcher */}
                <div className="relative mt-6">
                  <Search
                    size={15}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/35"
                  />
                  <input
                    ref={inputRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="¿Qué querés abrir?"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-3.5 pl-11 pr-14 text-sm text-white outline-none transition-colors placeholder:text-white/35 hover:border-white/20 hover:bg-white/[0.05] focus:border-[#ffcc00]/40 focus:bg-white/[0.06]"
                  />
                  {query ? (
                    <button
                      type="button"
                      onClick={() => setQuery("")}
                      aria-label="Limpiar búsqueda"
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-white/40 transition-colors hover:text-white"
                    >
                      <X size={13} />
                    </button>
                  ) : (
                    <kbd className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[9px] text-white/40">
                      /
                    </kbd>
                  )}
                </div>
                <p className="mt-2 flex items-center justify-end gap-1.5 font-mono text-[9px] tracking-widest uppercase text-white/25">
                  <span>↑↓</span> recorrer
                  <span aria-hidden className="text-white/15">·</span>
                  <span>Enter</span> abrir
                </p>

                {/* Destacado */}
                {!query && (
                  <div className="mt-5">
                    <FeaturedCard
                      service={destacado}
                      selected={destacado.id === seleccion}
                      onOpen={abrir}
                    />
                  </div>
                )}

                {/* Recientes */}
                {!query && recientesVisibles.length > 0 && (
                  <section className="mt-8">
                    <SectionHeader label="Recientes" />
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
                  <section className="mt-8">
                    <SectionHeader label="Disponibles" />
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
                  <section className="mt-8">
                    <SectionHeader label="Próximamente" />
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
                  <div className="mt-8 rounded-xl border border-dashed border-white/10 px-5 py-8 text-center">
                    <p className="text-xs font-light text-white/45">
                      Ningún servicio coincide con «{query}».
                    </p>
                    <p className="mt-1.5 font-mono text-[9px] tracking-widest uppercase text-white/25">
                      Probá con otro nombre
                    </p>
                  </div>
                )}

                {/* ── Pie ── */}
                <div className="mt-9 flex items-center justify-between border-t border-white/10 pt-4">
                  <span className="font-mono text-[9px] tracking-widest uppercase text-white/35">
                    Bling Company · Uruguay
                  </span>
                  {/* Con el panel a la vista, la versión y su chequeo viven ahí. */}
                  <button
                    type="button"
                    onClick={() => void revisarActualizaciones()}
                    disabled={buscando}
                    title="Buscar actualizaciones"
                    className="font-mono text-[9px] tracking-widest uppercase text-white/35 transition-colors hover:text-white/70 disabled:opacity-60 xl:hidden"
                  >
                    {buscando
                      ? "Buscando…"
                      : alDia
                        ? "Estás al día ✦"
                        : `v${version || "…"}`}
                  </button>
                </div>
              </div>

              {/* Columna derecha: cuenta + estado (sólo con ancho de sobra) */}
              <AccountPanel
                user={user}
                cargando={cargando}
                sinLeer={sinLeer}
                version={version}
                disponibles={totalDisponibles}
                total={SERVICES.length}
                update={update}
                alDia={alDia}
                buscando={buscando}
                onAbrirLogin={() => setLoginAbierto(true)}
                onBuscarActualizaciones={() => void revisarActualizaciones()}
                onVerNovedades={() => setToastVisible(true)}
              />
            </div>
          </div>
        </main>
      </div>

      {/* ── Aviso de nueva versión ── */}
      {update && toastVisible && (
        <div className="pointer-events-none fixed bottom-5 right-5 z-50">
          <UpdateToast
            update={update}
            progress={progress}
            downloaded={descargado}
            onDismiss={descartarAviso}
            onDownload={descargarActualizacion}
            onInstall={instalarActualizacion}
          />
        </div>
      )}

      {/* ── Login nativo ── */}
      {loginAbierto && (
        <LoginDialog onCerrar={() => setLoginAbierto(false)} onLogin={login} />
      )}

      {/* ── Panel de ajustes ── */}
      {ajustesAbiertos && (
        <SettingsPanel
          settings={settings}
          onSet={setAjuste}
          version={version}
          buscando={buscando}
          onBuscarActualizaciones={() => void revisarActualizaciones()}
          onBorrarRecientes={borrarRecientes}
          onCerrar={() => setAjustesAbiertos(false)}
          ultimoResultado={ultimoResultado}
        />
      )}
    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-[9px] tracking-widest uppercase text-white/40">
        {label}
      </span>
      <span className="h-px flex-1 bg-white/10" />
    </div>
  );
}
