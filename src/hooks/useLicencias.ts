import { useCallback, useEffect, useState } from "react";
import type {
  BlingUser,
  LicenciaApp,
  LicenciaInstalada,
  LicenciaProgreso,
} from "../bling";

/** Progreso visible de una descarga en curso. */
export type EstadoDescarga = { percent: number; transferidos: number; total: number };

/** Mensajes para cada código de error que puede devolver el proceso principal. */
const MENSAJES: Record<string, string> = {
  "sin-sesion": "Iniciá sesión para descargar o abrir.",
  "sin-licencia": "Tu plan no incluye esta app.",
  "sin-version": "Todavía no hay versión para tu sistema.",
  "sin-descargas": "Las descargas no están disponibles todavía.",
  servidor: "Bling está tardando en responder. Probá en un rato.",
  red: "No se pudo descargar. Revisá tu conexión.",
  integridad: "El archivo no pasó la verificación y se descartó.",
  "en-curso": "Ya se está descargando.",
  "no-instalada": "La app todavía no está instalada en tu PC.",
};

export function mensajeDeError(codigo: string): string {
  return MENSAJES[codigo] ?? "No se pudo descargar la app.";
}

/**
 * Licencias de apps del launcher: catálogo remoto (qué apps existen y si el
 * usuario de la sesión tiene licencia), descarga de binarios con progreso y
 * apps ya guardadas en disco.
 *
 * El catálogo se refresca cuando cambia la sesión: quien entra ve sus
 * apps desbloqueadas; quien sale, vuelve al catálogo sin licencias.
 */
export function useLicencias(user: BlingUser | null) {
  const [apps, setApps] = useState<Record<string, LicenciaApp>>({});
  const [plataforma, setPlataforma] = useState("win-x64");
  const [descargas, setDescargas] = useState<Record<string, EstadoDescarga>>({});
  const [bajando, setBajando] = useState<Record<string, boolean>>({});
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [guardadas, setGuardadas] = useState<Record<string, LicenciaInstalada>>({});
  const [ejecutables, setEjecutables] = useState<Record<string, boolean>>({});

  const userId = user?.id ?? null;

  // ── Catálogo: al entrar y con cada cambio de sesión ──
  useEffect(() => {
    let vivo = true;
    if (userId === null) {
      setApps({});
      setGuardadas({});
      setEjecutables({});
      return;
    }
    void window.bling.licenciasCatalogo().then((r) => {
      if (!vivo) return;
      if (!r.ok) {
        setApps({});
        return;
      }
      const porKey: Record<string, LicenciaApp> = {};
      for (const app of r.apps ?? []) porKey[app.key] = app;
      setApps(porKey);
      setPlataforma(r.plataforma ?? "win-x64");
    });
    return () => {
      vivo = false;
    };
  }, [userId]);

  // ── Qué hay ya descargado en disco (por cada app con binarios) ──
  useEffect(() => {
    let vivo = true;
    const claves = Object.values(apps)
      .filter((a) => a.hasAccess && a.versions && Object.keys(a.versions).length > 0)
      .map((a) => a.key);
    for (const key of claves) {
      void window.bling.licenciasInstalado(key).then((i) => {
        if (!vivo) return;
        setGuardadas((prev) => {
          if (!i) {
            if (!(key in prev)) return prev;
            const { [key]: _sacada, ...resto } = prev;
            return resto;
          }
          return { ...prev, [key]: i };
        });
      });
    }
  }, [apps]);

  // ── Apps con ejecutable nativo ya instalado en la PC ──
  useEffect(() => {
    let vivo = true;
    const claves = Object.values(apps)
      .filter((a) => a.hasAccess)
      .map((a) => a.key);
    for (const key of claves) {
      void window.bling.licenciasEjecutable(key).then((presente) => {
        if (!vivo || !presente) return;
        setEjecutables((prev) => ({ ...prev, [key]: true }));
      });
    }
    return () => {
      vivo = false;
    };
  }, [apps]);

  // ── El main avisa cuando el exe aparece (tras instalar) ──
  useEffect(() => {
    const off = window.bling.onLicenciaEjecutable((aviso) => {
      if (!aviso) return;
      setEjecutables((prev) =>
        aviso.presente ? { ...prev, [aviso.key]: true } : prev,
      );
    });
    return off;
  }, []);

  // ── Progreso que empuja el proceso principal ──
  useEffect(() => {
    const off = window.bling.onLicenciaProgreso((p: LicenciaProgreso | null) => {
      if (!p) return;
      if (p.listo) {
        setDescargas((prev) => {
          const { [p.key]: _sacada, ...resto } = prev;
          return resto;
        });
        setBajando((prev) => ({ ...prev, [p.key]: false }));
        return;
      }
      const percent =
        p.total > 0 ? Math.min(100, Math.round((p.transferidos / p.total) * 100)) : 0;
      setDescargas((prev) => ({
        ...prev,
        [p.key]: { percent, transferidos: p.transferidos, total: p.total },
      }));
    });
    return off;
  }, []);

  /** Pide la descarga del binario de una app (URL firmada + sha256). */
  const descargar = useCallback(async (key: string) => {
    setBajando((prev) => ({ ...prev, [key]: true }));
    setErrores((prev) => ({ ...prev, [key]: "" }));
    const r = await window.bling.licenciasDescargar(key);
    setBajando((prev) => ({ ...prev, [key]: false }));
    if (!r.ok) {
      setErrores((prev) => ({ ...prev, [key]: mensajeDeError(r.codigo ?? "red") }));
      return r;
    }
    // Ya quedó en disco: el botón pasa a "Instalar".
    const instalada = await window.bling.licenciasInstalado(key);
    if (instalada) setGuardadas((prev) => ({ ...prev, [key]: instalada }));
    return r;
  }, []);

  /** Ejecuta el instalador ya descargado. */
  const instalar = useCallback(async (key: string) => {
    await window.bling.licenciasInstalar(key);
  }, []);

  /**
   * Abre la app nativa instalada en la PC con su ticket de licencia (el
   * main pide el ticket, monta el canal local y la spawnea).
   */
  const abrir = useCallback(async (key: string) => {
    setErrores((prev) => ({ ...prev, [key]: "" }));
    const r = await window.bling.licenciasAbrir(key);
    if (!r.ok) {
      setErrores((prev) => ({ ...prev, [key]: mensajeDeError(r.codigo ?? "red") }));
    }
    return r;
  }, []);

  return {
    apps,
    plataforma,
    descargas,
    bajando,
    errores,
    guardadas,
    ejecutables,
    descargar,
    instalar,
    abrir,
  };
}
