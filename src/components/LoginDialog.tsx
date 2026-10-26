import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Eye, EyeOff, Loader2, X } from "lucide-react";
import Sparkle from "./Sparkle";
import type { AuthLoginResult } from "../bling";

/**
 * Login nativo del launcher. Las credenciales viajan por IPC al proceso
 * principal, que es el que habla con bling.uy (el renderer vive en file:// y
 * no puede pegarle a la API). Al entrar, la cookie httpOnly queda en el jar
 * compartido: los servicios te conocen sin volver a pedir nada.
 */
export default function LoginDialog({
  onCerrar,
  onLogin,
}: {
  onCerrar: () => void;
  onLogin: (
    email: string,
    password: string,
    recordarme: boolean,
  ) => Promise<AuthLoginResult>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verPassword, setVerPassword] = useState(false);
  const [recordarme, setRecordarme] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [necesitaVerificar, setNecesitaVerificar] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  // Escape cierra (captura, como el panel de ajustes) y el foco arranca
  // donde tiene que arrancar.
  useEffect(() => {
    emailRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCerrar();
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onCerrar]);

  async function enviar(e: FormEvent) {    e.preventDefault();
    if (enviando) return;

    setError(null);
    setNecesitaVerificar(false);
    setEnviando(true);

    try {
      const resultado = await onLogin(email.trim(), password, recordarme);
      if (resultado.ok) {
        onCerrar();
        return;
      }
      setError(resultado.error ?? "No pudimos iniciar sesiÃ³n.");
      setNecesitaVerificar(!!resultado.necesitaVerificar);
    } catch {
      setError("No pudimos conectar con Bling. RevisÃ¡ tu conexiÃ³n.");
    } finally {
      setEnviando(false);
    }
  }

  /**
   * Crear cuenta, recuperar la contraseÃ±a o verificar el correo: son pÃ¡ginas
   * del auth con Turnstile, asÃ­ que se abren en una ventana del launcher
   * (misma sesiÃ³n, misma barra) en vez del navegador del sistema.
   */
  async function entrarConGoogle() {
    if (enviando) return;
    setError(null);
    setNecesitaVerificar(false);
    setEnviando(true);
    try {
      const resultado = await window.bling.authGoogleSistema();
      if (resultado.ok) {
        onCerrar();
        return;
      }
      setError(resultado.error ?? "No pudimos iniciar sesiÃ³n con Google.");
    } catch {
      setError("No pudimos conectar con Google. RevisÃ¡ tu conexiÃ³n.");
    } finally {
      setEnviando(false);
    }
  }

  function abrirPaginaDeAuth(id: string, url: string, title: string) {
    void window.bling.openService({ id, url, title });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm"
      onClick={onCerrar}
      role="dialog"
      aria-modal="true"
      aria-label="Iniciar sesiÃ³n"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="update-toast relative w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900 to-zinc-950 shadow-[0_24px_60px_-16px_rgba(0,0,0,0.8)]"
      >
        <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-[#ffcc00] via-[#ffcc00]/40 to-transparent" />

        <div className="relative p-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Sparkle className="h-3.5 w-3.5 text-[#ffcc00]" />
                <h2 className="font-[var(--font-montserrat)] text-xl font-extralight tracking-tight text-white">
                  EntrÃ¡ a Bling
                </h2>
              </div>
              <p className="mt-1 text-[11px] font-light text-white/50">
                Una sesiÃ³n para todo el ecosistema.
              </p>
            </div>
            <button
              type="button"
              onClick={onCerrar}
              aria-label="Cerrar"
              className="-mr-1 -mt-1 rounded-lg p-1.5 text-white/40 transition-colors hover:bg-white/5 hover:text-white"
            >
              <X size={15} />
            </button>
          </div>

          {/* Google no se reimplementa acÃ¡: el flujo con token vive en el
              sitio, asÃ­ que se abre su ventana de login (misma sesiÃ³n) y al
              volver el launcher ya te ve adentro. Con el logo oficial, que es
              lo que Google pide para sus botones. */}
          <button
            type="button"
            onClick={entrarConGoogle}
            disabled={enviando}
            className="mt-5 flex w-full items-center justify-center gap-2.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-xs font-medium text-white transition-colors hover:border-white/20 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continuar con Google
          </button>

          <div className="mt-4 flex items-center gap-3" aria-hidden="true">
            <span className="h-px flex-1 bg-white/10" />
            <span className="font-mono text-[9px] uppercase tracking-widest text-white/30">o</span>
            <span className="h-px flex-1 bg-white/10" />
          </div>

          <form onSubmit={enviar} className="mt-4 space-y-3.5">
            <label className="block">
              <span className="font-mono text-[9px] tracking-widest uppercase text-white/40">
                Correo electrÃ³nico
              </span>
              <input
                ref={emailRef}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="correo@ejemplo.com"
                autoComplete="username"
                disabled={enviando}
                className="mt-1.5 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-white/30 outline-none transition-colors focus:border-[#ffcc00]/40 focus:bg-white/[0.07] disabled:opacity-60"
              />
            </label>

            <label className="block">
              <span className="font-mono text-[9px] tracking-widest uppercase text-white/40">
                ContraseÃ±a
              </span>
              <span className="relative mt-1.5 block">
                <input
                  type={verPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                  autoComplete="current-password"
                  disabled={enviando}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 pr-9 text-xs text-white placeholder:text-white/30 outline-none transition-colors focus:border-[#ffcc00]/40 focus:bg-white/[0.07] disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => setVerPassword((v) => !v)}
                  aria-label={verPassword ? "Ocultar contraseÃ±a" : "Mostrar contraseÃ±a"}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-white/40 transition-colors hover:text-white"
                >
                  {verPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </span>
            </label>

            <label className="flex cursor-pointer items-center gap-2 py-0.5">
              <input
                type="checkbox"
                checked={recordarme}
                onChange={(e) => setRecordarme(e.target.checked)}
                disabled={enviando}
                className="h-3.5 w-3.5 accent-[#ffcc00]"
              />
              <span className="text-[11px] font-light text-white/60">
                Recordarme en este equipo
              </span>
            </label>

            {error && (
              <div className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2">
                <p className="text-[11px] font-light text-red-300/90">{error}</p>
                {necesitaVerificar && (
                  <button
                    type="button"
                    onClick={() =>
                      abrirPaginaDeAuth(
                        "auth-verify",
                        "https://bling.uy/auth/verify",
                        "Verificar mi cuenta",
                      )
                    }
                    className="mt-1 text-[10px] font-medium text-[#ffcc00] transition-opacity hover:opacity-80"
                  >
                    Verificar mi cuenta â†’
                  </button>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={enviando || !email || !password}
              className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#ffcc00] px-3 py-2.5 text-xs font-medium text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {enviando && <Loader2 size={13} className="animate-spin" />}
              {enviando ? "Entrandoâ€¦" : "Ingresar"}
            </button>

          </form>

          <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3.5">
            <button
              type="button"
              onClick={() =>
                abrirPaginaDeAuth(
                  "auth-register",
                  "https://bling.uy/auth/register",
                  "Crear una cuenta",
                )
              }
              className="text-[10px] font-light text-white/50 transition-colors hover:text-white"
            >
              Crear una cuenta
            </button>
            <button
              type="button"
              onClick={() =>
                abrirPaginaDeAuth(
                  "auth-recovery",
                  "https://bling.uy/auth/recovery/forgot",
                  "Recuperar la contraseÃ±a",
                )
              }
              className="text-[10px] font-light text-white/50 transition-colors hover:text-white"
            >
              OlvidÃ© mi contraseÃ±a
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
