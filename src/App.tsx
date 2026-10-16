import { Globe } from "lucide-react";
import BlingWordmark from "./components/BlingWordmark";
import TitleBar from "./components/TitleBar";
import ServiceCard from "./components/ServiceCard";
import { SERVICES } from "./data/services";

/**
 * Pantalla del launcher: cabecera + grilla de servicios + accesos.
 * El catálogo vive en src/data/services.ts.
 */
export default function App() {
  const abrirWeb = () => void window.bling.openExternal("https://bling.uy");

  return (
    <div className="flex h-full flex-col bg-[#09090b] text-white antialiased">
      <TitleBar />

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-8 py-10">
          {/* ── Cabecera ── */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <BlingWordmark className="h-9 w-auto" />
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-[9px] tracking-widest uppercase text-white/50">
                Launcher
              </span>
            </div>
            <button
              type="button"
              onClick={abrirWeb}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 font-mono text-[10px] tracking-widest uppercase text-white/60 transition-colors hover:border-white/25 hover:text-white"
            >
              <Globe size={11} />
              bling.uy
            </button>
          </div>

          <h1 className="mt-8 font-[var(--font-barlow)] text-3xl sm:text-4xl font-extralight leading-[1.15] tracking-tight">
            Todos los servicios de Bling,
            <br />
            <span className="text-[#ffcc00]">en un solo lugar.</span>
          </h1>
          <p className="mt-3 max-w-md text-xs sm:text-sm font-light leading-relaxed text-white/60">
            Abrí cada servicio en su propia ventana desde acá. Tus cuentas y
            temas se guardan por servicio, como en el navegador.
          </p>

          {/* ── Grilla de servicios ── */}
          <div className="mt-9 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {SERVICES.map((s) => (
              <ServiceCard key={s.id} service={s} />
            ))}
          </div>

          {/* ── Pie ── */}
          <div className="mt-10 flex items-center justify-between border-t border-white/10 pt-5">
            <span className="font-mono text-[9px] tracking-widest uppercase text-white/35">
              Bling Company · Uruguay
            </span>
            <span className="font-mono text-[9px] tracking-widest uppercase text-white/35">
              v1.0.0
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}
