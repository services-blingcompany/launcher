import { useEffect, useState } from "react";

/**
 * Chispa de la marca (sparkle de 4 puntas). Se usa en el toast de
 * actualización y en el badge persistente.
 */
export default function Sparkle({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className={className}
    >
      <path d="M12 0c.6 6.2 5.2 10.8 12 12-6.8 1.2-11.4 5.8-12 12-.6-6.2-5.2-10.8-12-12C6.8 10.8 11.4 6.2 12 0Z" />
    </svg>
  );
}

/**
 * Destello que barre el panel: un reflejo diagonal que cruza el borde
 * cada pocos segundos, como la luz sobre el rombo de la marca.
 */
export function ShineSweep() {
  const [paso, setPaso] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setPaso((p) => p + 1), 4200);
    return () => clearInterval(id);
  }, []);

  return (
    <span
      aria-hidden
      key={paso}
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl"
    >
      <span className="update-shine absolute -inset-y-8 left-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/[0.09] to-transparent" />
    </span>
  );
}
