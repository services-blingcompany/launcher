import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Bell,
  Check,
  ChevronDown,
  Copy,
  LogIn,
  LogOut,
  Settings,
  User as UserIcon,
  Wallet,
} from "lucide-react";
import { datosDeUsuario } from "../hooks/useSession";
import type { BlingUser } from "../bling";

/** Ventana embebida de una página de cuenta (comparte la sesión). */
function abrirCuenta(id: string, url: string, title: string) {
  void window.bling.openService({ id, url, title });
}

/**
 * Botón de usuario de la barra superior.
 *
 * Sin sesión: llamada a "Iniciar sesión". Con sesión: avatar + nombre y un
 * menú con las páginas de cuenta (perfil, ajustes, notificaciones, BlingPay),
 * todas abiertas en ventanas embebidas que comparten la sesión de Bling.
 */
export default function UserMenu({
  user,
  cargando,
  sinLeer,
  onAbrirLogin,
  onCerrarSesion,
}: {
  user: BlingUser | null;
  cargando: boolean;
  sinLeer: number;
  onAbrirLogin: () => void;
  onCerrarSesion: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);

  // Cerrar al hacer clic afuera o con Escape, como cualquier menú.
  useEffect(() => {
    if (!abierto) return;
    function onDown(e: MouseEvent) {
      if (!contenedor.current?.contains(e.target as Node)) setAbierto(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setAbierto(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [abierto]);

  // Mientras se consulta la sesión no se muestra nada: evita el parpadeo
  // de "Iniciar sesión" en cada arranque.
  if (cargando) {
    return <span className="h-8 w-24 animate-pulse rounded-lg bg-white/5" />;
  }

  if (!user) {
    return (
      <button
        type="button"
        onClick={onAbrirLogin}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[#ffcc00]/30 bg-[#ffcc00]/10 px-3 py-2 font-mono text-[9px] tracking-widest uppercase text-[#ffcc00] transition-colors hover:border-[#ffcc00]/50 hover:bg-[#ffcc00]/20"
      >
        <LogIn size={11} />
        Iniciar sesión
      </button>
    );
  }

  const { nombre, alias, avatar, iniciales, esEmpresa } = datosDeUsuario(user);
  const primerNombre = nombre.split(" ")[0];

  async function copiarAlias() {
    if (!alias) return;
    try {
      await navigator.clipboard.writeText(alias);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      // sin portapapeles disponible: no rompemos nada
    }
  }

  return (
    <div ref={contenedor} className="relative flex items-center gap-2">
      {/* Campanita: sólo con sesión, con el contador de no leídas */}
      <button
        type="button"
        onClick={() =>
          abrirCuenta("notificaciones", "https://bling.uy/bling/notifications", "Notificaciones")
        }
        aria-label={sinLeer > 0 ? `Notificaciones (${sinLeer} sin leer)` : "Notificaciones"}
        title="Notificaciones"
        className="relative inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/5 p-2 text-white/60 transition-colors hover:border-white/25 hover:text-white"
      >
        <Bell size={13} />
        {sinLeer > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-[#ffcc00] px-1 font-mono text-[9px] font-medium text-black">
            {sinLeer > 99 ? "99+" : sinLeer}
          </span>
        )}
      </button>

      {/* Usuario */}
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={abierto}
        className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 py-1.5 pl-1.5 pr-2.5 transition-colors hover:border-white/25"
      >
        {avatar ? (
          <img
            src={avatar}
            alt=""
            className="h-5 w-5 rounded-full object-cover ring-1 ring-white/15"
          />
        ) : (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#ffcc00]/20 font-mono text-[9px] font-medium text-[#ffcc00]">
            {iniciales}
          </span>
        )}
        <span className="max-w-[110px] truncate font-mono text-[9px] tracking-widest uppercase text-white/70">
          {primerNombre}
        </span>
        <ChevronDown size={11} className="text-white/40" />
      </button>

      {abierto && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-white/10 bg-zinc-950/95 shadow-[0_24px_60px_-16px_rgba(0,0,0,0.9)] backdrop-blur"
        >
          {/* Encabezado: quién sos */}
          <div className="border-b border-white/10 px-3.5 py-3">
            <p className="truncate font-[var(--font-barlow)] text-sm font-light text-white">
              {nombre}
            </p>
            <p className="mt-0.5 truncate text-[11px] font-light text-white/45">
              {user.email}
            </p>
            <p className="mt-1 font-mono text-[9px] tracking-widest uppercase text-white/30">
              {esEmpresa ? "Empresa" : "Persona"}
              {user.is_verified ? "" : " · sin verificar"}
            </p>
          </div>

          <div className="p-1.5">
            <Item
              icon={<UserIcon size={13} />}
              label="Mi perfil"
              onClick={() => {
                setAbierto(false);
                abrirCuenta("perfil", "https://bling.uy/bling/profile", "Mi perfil");
              }}
            />
            <Item
              icon={<Settings size={13} />}
              label="Ajustes de cuenta"
              onClick={() => {
                setAbierto(false);
                abrirCuenta("cuenta-ajustes", "https://bling.uy/bling/settings", "Ajustes de cuenta");
              }}
            />
            <Item
              icon={<Bell size={13} />}
              label="Notificaciones"
              extra={
                sinLeer > 0 ? (
                  <span className="font-mono text-[9px] text-[#ffcc00]">{sinLeer}</span>
                ) : null
              }
              onClick={() => {
                setAbierto(false);
                abrirCuenta(
                  "notificaciones",
                  "https://bling.uy/bling/notifications",
                  "Notificaciones",
                );
              }}
            />
            {/* Sin endpoint de saldo todavía: acá se muestra el alias de
                BlingPay, que es lo único que expone el perfil hoy. */}
            <Item
              icon={<Wallet size={13} />}
              label="BlingPay"
              extra={
                alias ? (
                  <span className="inline-flex items-center gap-1 font-mono text-[9px] text-white/45">
                    @{alias}
                    {copiado ? (
                      <Check size={10} className="text-[#ffcc00]" />
                    ) : (
                      <Copy size={10} className="opacity-60" />
                    )}
                  </span>
                ) : (
                  <span className="font-mono text-[9px] text-white/25">sin alias</span>
                )
              }
              title={alias ? "Copiar alias de BlingPay" : undefined}
              onClick={() => void copiarAlias()}
            />
          </div>

          <div className="border-t border-white/10 p-1.5">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setAbierto(false);
                onCerrarSesion();
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[11px] font-light text-white/70 transition-colors hover:bg-red-500/10 hover:text-red-300"
            >
              <LogOut size={13} />
              Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Item({
  icon,
  label,
  extra,
  title,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  extra?: ReactNode;
  title?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      title={title}
      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[11px] font-light text-white/70 transition-colors hover:bg-white/5 hover:text-white"
    >
      <span className="text-white/40">{icon}</span>
      <span className="flex-1">{label}</span>
      {extra}
    </button>
  );
}
