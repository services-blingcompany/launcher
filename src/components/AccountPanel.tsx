import { useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowUpRight,
  Bell,
  Check,
  Copy,
  LogIn,
  Settings,
  User as UserIcon,
  Wallet,
} from "lucide-react";
import { datosDeUsuario } from "../hooks/useSession";
import { PAGINAS, abrirCuenta } from "../lib/cuenta";
import type { BlingUser, UpdateInfo } from "../bling";

/**
 * Columna derecha del launcher: quién está logueado (con los accesos a las
 * páginas de cuenta) y el estado del launcher (servicios y versión).
 *
 * Sólo aparece cuando la ventana da el ancho: en ventanas angostas esa
 * información vive en el menú de usuario y en el pie.
 */
export default function AccountPanel({
  user,
  cargando,
  sinLeer,
  version,
  disponibles,
  total,
  update,
  alDia,
  buscando,
  onAbrirLogin,
  onBuscarActualizaciones,
  onVerNovedades,
}: {
  user: BlingUser | null;
  cargando: boolean;
  sinLeer: number;
  version: string;
  disponibles: number;
  total: number;
  update: UpdateInfo | null;
  alDia: boolean;
  buscando: boolean;
  onAbrirLogin: () => void;
  onBuscarActualizaciones: () => void;
  onVerNovedades: () => void;
}) {
  return (
    <aside className="hidden w-[288px] shrink-0 xl:block">
      <div className="sticky top-0 space-y-4">
        <Tarjeta>
          <Rotulo>Tu cuenta</Rotulo>

          {cargando ? (
            <div className="mt-3.5 space-y-2.5">
              <div className="h-10 w-10 animate-pulse rounded-full bg-white/5" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-white/5" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-white/5" />
            </div>
          ) : user ? (
            <CuentaLogueada user={user} sinLeer={sinLeer} />
          ) : (
            <Invitacion onAbrirLogin={onAbrirLogin} />
          )}
        </Tarjeta>

        <Tarjeta>
          <Rotulo>Estado</Rotulo>

          <dl className="mt-3.5 space-y-2.5">
            <FilaDato etiqueta="Servicios">
              {disponibles} de {total} disponibles
            </FilaDato>
            <FilaDato etiqueta="Versión">v{version || "…"}</FilaDato>
          </dl>

          {update ? (
            <button
              type="button"
              onClick={onVerNovedades}
              className="mt-3.5 flex w-full items-center gap-2 rounded-lg border border-[#ffcc00]/30 bg-[#ffcc00]/10 px-3 py-2 text-left transition-colors hover:border-[#ffcc00]/50 hover:bg-[#ffcc00]/20"
            >
              <span className="flex-1 font-mono text-[9px] tracking-widest uppercase text-[#ffcc00]">
                Versión {update.version}
              </span>
              <span className="text-[10px] font-light text-[#ffcc00]/80">
                Ver novedades
              </span>
              <ArrowUpRight size={12} className="text-[#ffcc00]" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onBuscarActualizaciones}
              disabled={buscando}
              className="mt-3.5 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-[9px] tracking-widest uppercase text-white/40 transition-colors hover:border-white/20 hover:text-white/70 disabled:opacity-60"
            >
              {buscando ? "Buscando…" : alDia ? "Estás al día ✦" : "Buscar actualizaciones"}
            </button>
          )}
        </Tarjeta>
      </div>
    </aside>
  );
}

/** Cuerpo de la tarjeta de cuenta cuando hay sesión. */
function CuentaLogueada({
  user,
  sinLeer,
}: {
  user: BlingUser;
  sinLeer: number;
}) {
  const { nombre, alias, avatar, iniciales, esEmpresa } = datosDeUsuario(user);
  const [copiado, setCopiado] = useState(false);

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
    <>
      <div className="mt-3.5 flex items-center gap-3">
        {avatar ? (
          <img
            src={avatar}
            alt=""
            className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-white/15"
          />
        ) : (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ffcc00]/20 font-mono text-xs font-medium text-[#ffcc00]">
            {iniciales}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate font-[var(--font-montserrat)] text-sm font-light text-white">
            {nombre}
          </p>
          <p className="mt-0.5 truncate text-[11px] font-light text-white/45">
            {user.email}
          </p>
        </div>
      </div>

      <p className="mt-2.5 font-mono text-[9px] tracking-widest uppercase text-white/30">
        {esEmpresa ? "Empresa" : "Persona"}
        {user.is_verified ? "" : " · sin verificar"}
      </p>

      {/* BlingPay expone sólo el alias, no el saldo (todavía no hay endpoint). */}
      <button
        type="button"
        onClick={() => void copiarAlias()}
        title={alias ? "Copiar alias de BlingPay" : undefined}
        className="mt-3 flex w-full items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 transition-colors hover:border-white/20"
      >
        <Wallet size={12} className="shrink-0 text-[#ffcc00]/70" />
        <span className="flex-1 text-left font-mono text-[9px] tracking-widest uppercase text-white/45">
          BlingPay
        </span>
        {alias ? (
          <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-white/70">
            @{alias}
            {copiado ? (
              <Check size={10} className="text-[#ffcc00]" />
            ) : (
              <Copy size={10} className="opacity-50" />
            )}
          </span>
        ) : (
          <span className="font-mono text-[9px] text-white/25">sin alias</span>
        )}
      </button>

      <div className="mt-3 border-t border-white/10 pt-1.5">
        <Acceso
          icon={<UserIcon size={13} />}
          label="Mi perfil"
          onClick={() => abrirCuenta(PAGINAS.perfil)}
        />
        <Acceso
          icon={<Settings size={13} />}
          label="Ajustes de cuenta"
          onClick={() => abrirCuenta(PAGINAS.ajustes)}
        />
        <Acceso
          icon={<Bell size={13} />}
          label="Notificaciones"
          extra={
            sinLeer > 0 ? (
              <span className="font-mono text-[9px] text-[#ffcc00]">{sinLeer}</span>
            ) : null
          }
          onClick={() => abrirCuenta(PAGINAS.notificaciones)}
        />
      </div>
    </>
  );
}

/** Invitación a entrar cuando todavía no hay sesión. */
function Invitacion({ onAbrirLogin }: { onAbrirLogin: () => void }) {
  return (
    <>
      <p className="mt-3.5 text-[13px] font-light leading-snug text-white/70">
        Entrá a Bling y cada servicio se abre con vos adentro: sin volver a
        escribir la contraseña.
      </p>
      <button
        type="button"
        onClick={onAbrirLogin}
        className="mt-3.5 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#ffcc00]/30 bg-[#ffcc00]/10 px-3 py-2.5 font-mono text-[9px] tracking-widest uppercase text-[#ffcc00] transition-colors hover:border-[#ffcc00]/50 hover:bg-[#ffcc00]/20"
      >
        <LogIn size={11} />
        Iniciar sesión
      </button>
    </>
  );
}

function Tarjeta({ children }: { children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      {children}
    </section>
  );
}

function Rotulo({ children }: { children: ReactNode }) {
  return (
    <p className="font-mono text-[9px] tracking-widest uppercase text-white/35">
      {children}
    </p>
  );
}

function FilaDato({
  etiqueta,
  children,
}: {
  etiqueta: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[11px] font-light text-white/45">{etiqueta}</dt>
      <dd className="font-mono text-[10px] tracking-wide text-white/70">
        {children}
      </dd>
    </div>
  );
}

function Acceso({
  icon,
  label,
  extra,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  extra?: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[11px] font-light text-white/60 transition-colors hover:bg-white/5 hover:text-white"
    >
      <span className="text-white/35 transition-colors group-hover:text-white/60">
        {icon}
      </span>
      <span className="flex-1">{label}</span>
      {extra}
      <ArrowUpRight
        size={12}
        className="text-white/20 transition-colors group-hover:text-white/50"
      />
    </button>
  );
}
