import { useEffect, useState } from "react";
import keyart from "../../assets/keyart.svg";
import BlingWordmark from "./BlingWordmark";

/**
 * Rail izquierdo: la imagen vertical de marca (keyart) con el wordmark
 * encima y, abajo, el reloj en vivo de la fecha/hora local.
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
      <img
        src={keyart}
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover object-center opacity-90"
      />
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
