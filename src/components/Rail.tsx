import { useEffect, useState } from "react";
import bellUrl from "../../assets/BlingBellNoBg.png?url";
import BlingWordmark from "./BlingWordmark";

/**
 * Rail izquierdo: la campana de Bling con el pulso de ondas que expanden en
 * loop desde su centro y, abajo, el reloj en vivo de la fecha/hora local.
 */
export default function Rail() {
  const [ahora, setAhora] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setAhora(new Date()), 1000 * 30);
    return () => clearInterval(t);
  }, []);

  const hora = ahora.toLocaleTimeString("es-UY", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const fecha = ahora.toLocaleDateString("es-UY", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <aside className="relative w-[248px] shrink-0 overflow-hidden border-r border-white/5">
      {/* Campana con pulso: halo + anillos que salen en loop */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[38%]"
      >
        <div
          className="absolute left-1/2 top-1/2 h-[460px] w-[460px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(255,204,0,0.15), rgba(255,204,0,0.04) 45%, transparent 70%)",
          }}
        />
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="pulso-campana absolute left-1/2 top-1/2 h-[150px] w-[150px] rounded-full border-[1.5px]"
            style={{
              borderColor: "rgba(255,204,0,0.85)",
              animationDelay: `${i * 1.25}s`,
            }}
          />
        ))}
        <img
          src={bellUrl}
          alt=""
          className="absolute left-1/2 top-1/2 h-[150px] w-[150px] max-w-none -translate-x-1/2 -translate-y-1/2 [filter:drop-shadow(0_0_26px_rgba(255,204,0,0.22))]"
        />
      </div>
      {/* Velo inferior para que el texto se lea siempre */}
      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-[#09090b] via-[#09090b]/85 to-transparent" />
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#09090b]/70 to-transparent" />

      <div className="relative flex h-full flex-col justify-between p-6">
        <BlingWordmark className="h-7 w-auto" />

        <div>
          <p className="font-[var(--font-barlow)] text-5xl font-extralight leading-none tracking-tight text-white">
            {hora}
          </p>
          <p className="mt-2 font-mono text-[10px] tracking-widest uppercase text-white/50 first-letter:uppercase">
            {fecha}
          </p>
          <div className="mt-5 flex items-center gap-2 border-t border-white/10 pt-4">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span className="font-mono text-[9px] tracking-widest uppercase text-white/50">
              Servicios en línea
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
