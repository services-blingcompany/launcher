import type { CSSProperties } from "react";
import { Minus, X } from "lucide-react";

/**
 * Titlebar propio (la ventana es frame:false). La zona superior es
 * arrastrable; los botones min/cerrar piden al proceso principal.
 */
export default function TitleBar() {
  return (
    <header
      className="relative flex h-9 shrink-0 items-center justify-between border-b border-white/5 bg-[#09090b] pl-4 pr-0 select-none"
      style={{ WebkitAppRegion: "drag" } as CSSProperties}
    >
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] tracking-widest uppercase text-white/40">
          Bling Launcher
        </span>
      </div>
      <div
        className="flex h-full"
        style={{ WebkitAppRegion: "no-drag" } as CSSProperties}
      >
        <button
          type="button"
          aria-label="Minimizar"
          onClick={() => window.bling.minimize()}
          className="flex h-full w-11 items-center justify-center text-white/50 transition-colors hover:bg-white/10 hover:text-white"
        >
          <Minus size={14} />
        </button>
        <button
          type="button"
          aria-label="Cerrar"
          onClick={() => window.bling.close()}
          className="flex h-full w-11 items-center justify-center text-white/50 transition-colors hover:bg-red-500/90 hover:text-white"
        >
          <X size={14} />
        </button>
      </div>
    </header>
  );
}
