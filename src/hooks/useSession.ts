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
/** Clave del cach� local del �ltimo usuario conocido (s�lo para pintar r�pido). */
const CACHE_SESION = "bling-launcher-sesion";

function leerCacheSesion(): BlingUser | null {
  try {
    return JSON.parse(localStorage.getItem(CACHE_SESION) || "null");
  } catch {
    return null;
  }
}

function guardarCacheSesion(u: BlingUser | null) {
  try {
    if (u) localStorage.setItem(CACHE_SESION, JSON.stringify(u));
    else localStorage.removeItem(CACHE_SESION);
  } catch {
    // sin storage disponible no pasa nada: se vuelve al estado por defecto
  }
}

export function useSession() {
  // La sesión vive en el main (la validaci�n depende del reto de Cloudflare y
  // puede tardar). Se cachea el �ltimo usuario conocido para que el bot�n de
  // login / el avatar se pinten al instante en cada arranque, sin esperar la
  // consulta; cuando el main responde, se reconcilia y se actualiza el cach�.
  const [user, setUser] = useState<BlingUser | null>(() => leerCacheSesion());
  const [cargando, setCargando] = useState(false);
  const [sinLeer, setSinLeer] = useState(0);

  // Estado inicial + avisos que empuja el main.
  useEffect(() => {
    let vivo = true;

    void window.bling.authStatus().then((u) => {
      if (!vivo) return;
      setUser(u);
      setCargando(false);
      guardarCacheSesion(u);
    });

    const off = window.bling.onAuthChanged((u) => {
      setUser(u);
      setCargando(false);
      guardarCacheSesion(u);
    });

    return () => {
      vivo = false;
      off();
    };
  }, []);

  // Contador de no leídas: al entrar, y cada minuto mientras haya sesión.
  // Además se le informa al main, que es quien muestra el aviso nativo y
  // marca el icono de la barra de tareas.
  useEffect(() => {
    if (!user) {
      setSinLeer(0);
      window.bling.reportNotifications(0);
      return;
    }

    let vivo = true;
    const refrescar = () => {
      void window.bling
        .authNotifications()
        .then((r) => {
          if (!vivo) return;
          setSinLeer(r.count);
          window.bling.reportNotifications(r.count);
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
      if (resultado.ok) {
        setUser(resultado.user ?? null);
        guardarCacheSesion(resultado.user ?? null);
      }
      return resultado;
    },
    [],
  );

  const logout = useCallback(async () => {
    await window.bling.authLogout();
    setUser(null);
    guardarCacheSesion(null);
    setSinLeer(0);
    window.bling.reportNotifications(0);
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
