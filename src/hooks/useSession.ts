import { useCallback, useEffect, useState } from "react";
import type { AuthLoginResult, BlingUser } from "../bling";

/**
 * Sesión de Bling del launcher: quién está logueado, cuántas notificaciones
 * sin leer hay y las acciones de login/logout.
 *
 * La sesión real vive en el proceso principal (cookie httpOnly, compartida
 * con las ventanas de los servicios). Acá sólo se refleja, y el main avisa
 * cuando cambia (login, expiración, cierre).
 */
export function useSession() {
  const [user, setUser] = useState<BlingUser | null>(null);
  const [cargando, setCargando] = useState(true);
  const [sinLeer, setSinLeer] = useState(0);

  // Estado inicial + avisos que empuja el main.
  useEffect(() => {
    let vivo = true;

    void window.bling.authStatus().then((u) => {
      if (!vivo) return;
      setUser(u);
      setCargando(false);
    });

    const off = window.bling.onAuthChanged((u) => {
      setUser(u);
      setCargando(false);
    });

    return () => {
      vivo = false;
      off();
    };
  }, []);

  // Contador de no leídas: al entrar, y cada minuto mientras haya sesión.
  useEffect(() => {
    if (!user) {
      setSinLeer(0);
      return;
    }

    let vivo = true;
    const refrescar = () => {
      void window.bling
        .authNotifications()
        .then((r) => {
          if (vivo) setSinLeer(r.count);
        })
        .catch(() => {});
    };

    refrescar();
    const t = setInterval(refrescar, 60 * 1000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, [user]);

  const login = useCallback(
    async (email: string, password: string, rememberMe: boolean) => {
      const resultado: AuthLoginResult = await window.bling.authLogin({
        email,
        password,
        rememberMe,
      });
      if (resultado.ok) setUser(resultado.user ?? null);
      return resultado;
    },
    [],
  );

  const logout = useCallback(async () => {
    await window.bling.authLogout();
    setUser(null);
    setSinLeer(0);
  }, []);

  return { user, cargando, sinLeer, login, logout };
}

/** Datos de presentación del perfil, sin importar si es persona o empresa. */
export function datosDeUsuario(user: BlingUser) {
  const persona = user.persona;
  const empresa = user.empresa;

  const nombre =
    [persona?.nombre, persona?.apellido].filter(Boolean).join(" ") ||
    empresa?.nombre_comercial ||
    user.email.split("@")[0];

  const iniciales = nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  return {
    nombre,
    alias: persona?.alias || empresa?.alias || null,
    avatar: persona?.avatar_url || empresa?.avatar_url || null,
    iniciales: iniciales || "?",
    esEmpresa: user.account_type === "EMPRESA",
  };
}
