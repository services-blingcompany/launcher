import { useCallback, useEffect, useRef, useState } from "react";
import type {
  SoporteAdjunto,
  SoporteMensaje,
  SoporteTicket,
} from "../bling";

/**
 * Chat de soporte del launcher.
 *
 * Habla con el proceso principal por IPC (que a su vez usa la ventana puente
 * de bling.uy): el renderer nunca toca la red. Todo lo que cambia acá es
 * estado puro — la lógica de formato vive en electron/soporteLogica.cjs.
 *
 * El flujo es el del backend: `nuevo()` crea el ticket con el primer mensaje
 * (el título lo deriva allá), `responder()` escribe en la conversación del
 * ticket abierto, y `cerrar()`/`reabrir()` giran el estado, que se deriva
 * del chat.
 */

/** Tope de capturas por mensaje (contrato del soporte; lo valida el backend). */
export const MAX_CAPTURAS = 4;

/** Capturas más pesadas que esto se recomprimen en cliente antes de subir. */
const MAX_CAPTURA_BYTES = 900 * 1024;
const MAX_LADO_CAPTURA = 1600;

/** Cada cuánto se refresca la conversación (la respuesta del agente no empuja). */
const INTERVALO_MENSAJES_MS = 10_000;

/** Mensajes para cada código que puede devolver el proceso principal. */
const MENSAJES: Record<string, string> = {
  "sin-sesion": "Iniciá sesión para escribir al equipo de soporte.",
  "sin-licencia": "Tu cuenta no tiene acceso al soporte.",
  tope: "Ya tenés 5 tickets abiertos. Cerrá alguno para abrir otro.",
  "sin-conexion": "No se pudo conectar con Bling. Probá en un rato.",
  servidor: "Bling está tardando en responder. Probá en un rato.",
  capturas: "Las capturas no se pudieron subir. Probá de nuevo.",
  error: "No se pudo completar la operación.",
};

/**
 * Texto mostrable para un fallo: los problemas de sesión se explican con
 * nuestras palabras; el resto muestra el detalle del backend (llega en
 * español rioplatense, ej. el tope de tickets abiertos).
 */
export function mensajeDeError(codigo: string, detalle?: string | null): string {
  if (codigo === "sin-sesion" || codigo === "sin-licencia") return MENSAJES[codigo];
  if (detalle) return String(detalle);
  return MENSAJES[codigo] ?? MENSAJES.error;
}

/** Bytes → base64 por lotes (evita estallar el stack con archivos grandes). */
function aBase64(bytes: Uint8Array): string {
  let binario = "";
  const LOTE = 0x8000;
  for (let i = 0; i < bytes.length; i += LOTE) {
    binario += String.fromCharCode(...bytes.subarray(i, i + LOTE));
  }
  return btoa(binario);
}

/**
 * Prepara UNA captura para subir: las imágenes pesadas (o muy grandes) se
 * recomprimen a JPEG 1600 px / 0.85 con canvas — el backend después las
 * pasa a AVIF igual. Las chicas van tal cual vinieron.
 */
export async function prepararCaptura(
  archivo: File,
): Promise<{ nombre: string; tipo: string; base64: string }> {
  const esImagen = archivo.type.startsWith("image/");
  if (esImagen) {
    try {
      const bitmap = await createImageBitmap(archivo);
      const lado = Math.max(bitmap.width, bitmap.height);
      if (archivo.size > MAX_CAPTURA_BYTES || lado > MAX_LADO_CAPTURA) {
        const escala = Math.min(1, MAX_LADO_CAPTURA / lado);
        const ancho = Math.max(1, Math.round(bitmap.width * escala));
        const alto = Math.max(1, Math.round(bitmap.height * escala));
        const lienzo = document.createElement("canvas");
        lienzo.width = ancho;
        lienzo.height = alto;
        const ctx = lienzo.getContext("2d");
        if (ctx) {
          ctx.drawImage(bitmap, 0, 0, ancho, alto);
          const blob = await new Promise<Blob | null>((resolver) =>
            lienzo.toBlob(resolver, "image/jpeg", 0.85),
          );
          if (blob) {
            const bytes = new Uint8Array(await blob.arrayBuffer());
            const nombre =
              archivo.name.replace(/\.[^.]+$/, "") || "captura";
            bitmap.close();
            return { nombre: `${nombre}.jpg`, tipo: "image/jpeg", base64: aBase64(bytes) };
          }
        }
      }
      bitmap.close();
    } catch {
      // Si canvas no puede decodificarla, se manda el original tal cual.
    }
  }
  const bytes = new Uint8Array(await archivo.arrayBuffer());
  return {
    nombre: archivo.name || "captura.png",
    tipo: archivo.type || "image/png",
    base64: aBase64(bytes),
  };
}

/**
 * Estado del chat de soporte. Se monta con la pantalla (al abrirla) y se
 * desmonta al cerrarla: el polling vive con el componente.
 */
export function useSoporte() {
  const [tickets, setTickets] = useState<SoporteTicket[]>([]);
  const [mensajes, setMensajes] = useState<SoporteMensaje[]>([]);
  const [seleccionado, setSeleccionado] = useState<number | null>(null);
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Set esencial de datos del equipo, pedido una sola vez al main. */
  const [datosEquipo, setDatosEquipo] = useState("");

  // Refs para que el polling no cierre una acción en vuelo.
  const seleccionRef = useRef<number | null>(null);
  seleccionRef.current = seleccionado;

  const fallo = useCallback(
    (codigo: string, detalle?: string | null): { ok: false; codigo: string } => {
      setError(mensajeDeError(codigo, detalle));
      return { ok: false, codigo };
    },
    [],
  );

  /** Trae (o re-trae) la lista de tickets. */
  const cargarLista = useCallback(async () => {
    const r = await window.bling.soporteLista();
    if (!r.ok) return r;
    setTickets(r.tickets);
    return r;
  }, []);

  // ── Lista al abrir la pantalla + datos del equipo para el toggle ──
  useEffect(() => {
    let vivo = true;
    void (async () => {
      const r = await window.bling.soporteLista();
      if (!vivo) return;
      if (r.ok) setTickets(r.tickets);
      else setError(mensajeDeError(r.codigo, r.detalle));
      setCargando(false);
    })();
    void window.bling.soporteDatosEquipo().then((datos) => {
      if (vivo) setDatosEquipo(datos);
    });
    return () => {
      vivo = false;
    };
  }, []);

  /** Carga (o recarga) la conversación de un ticket, en orden cronológico. */
  const cargarMensajes = useCallback(async (chatId: number) => {
    const r = await window.bling.soporteMensajes(chatId);
    if (!r.ok) return r;
    // El backend devuelve más nuevo primero: la damos vuelta para renderizar.
    setMensajes([...r.mensajes].reverse());
    return r;
  }, []);

  /** Selecciona un ticket y arranca a mirar su conversación. */
  const abrir = useCallback(
    async (ticket: SoporteTicket) => {
      setError(null);
      setSeleccionado(ticket.id);
      setMensajes([]);
      if (ticket.chat_id) await cargarMensajes(ticket.chat_id);
    },
    [cargarMensajes],
  );

  /** Vuelve a la lista sin conversación cargada. */
  const volver = useCallback(() => {
    setSeleccionado(null);
    setMensajes([]);
    setError(null);
  }, []);

  // ── Polling: mientras hay un ticket abierto se refresca todo ──
  useEffect(() => {
    if (seleccionado === null) return;
    const ticket = tickets.find((t) => t.id === seleccionado);
    const chatId = ticket?.chat_id ?? null;
    if (!chatId) return;
    const timer = window.setInterval(() => {
      void cargarMensajes(chatId);
      void cargarLista();
    }, INTERVALO_MENSAJES_MS);
    return () => window.clearInterval(timer);
  }, [seleccionado, tickets, cargarMensajes, cargarLista]);

  /**
   * Sube las capturas seleccionadas (una por una) y devuelve los adjuntos.
   * Si alguna falla, corta y deja el error en el estado.
   */
  const subirCapturas = useCallback(
    async (archivos: File[]): Promise<SoporteAdjunto[] | null> => {
      const elegidas = archivos.slice(0, MAX_CAPTURAS);
      const adjuntos: SoporteAdjunto[] = [];
      for (const archivo of elegidas) {
        const preparada = await prepararCaptura(archivo);
        const r = await window.bling.soporteSubir(preparada);
        if (!r.ok) {
          fallo(r.codigo, r.detalle);
          return null;
        }
        adjuntos.push(r.adjunto);
      }
      return adjuntos;
    },
    [fallo],
  );

  /**
   * Abre un ticket nuevo desde el chat: sube capturas, arma el primer
   * mensaje (con el bloque de datos del equipo si el usuario lo ofreció) y
   * deja el ticket seleccionado con su conversación cargada.
   */
  const nuevo = useCallback(
    async (
      mensaje: string,
      archivos: File[],
      compartirDatos: boolean,
    ): Promise<SoporteTicket | null> => {
      setEnviando(true);
      setError(null);
      try {
        const capturas = await subirCapturas(archivos);
        if (!capturas) return null;
        const r = await window.bling.soporteNuevo({
          mensaje,
          datosEquipo: compartirDatos && datosEquipo ? datosEquipo : null,
          capturas,
        });
        if (!r.ok) {
          fallo(r.codigo, r.detalle);
          return null;
        }
        setTickets((prev) => [r.ticket, ...prev.filter((t) => t.id !== r.ticket.id)]);
        setSeleccionado(r.ticket.id);
        setMensajes([]);
        if (r.ticket.chat_id) await cargarMensajes(r.ticket.chat_id);
        return r.ticket;
      } finally {
        setEnviando(false);
      }
    },
    [datosEquipo, subirCapturas, fallo, cargarMensajes],
  );

  /** Responde en la conversación abierta (con capturas opcionales). */
  const responder = useCallback(
    async (chatId: number, contenido: string, archivos: File[]): Promise<boolean> => {
      setEnviando(true);
      setError(null);
      try {
        const capturas = await subirCapturas(archivos);
        if (!capturas) return false;
        const r = await window.bling.soporteResponder({ chatId, contenido, capturas });
        if (!r.ok) {
          fallo(r.codigo, r.detalle);
          return false;
        }
        await cargarMensajes(chatId);
        void cargarLista();
        return true;
      } finally {
        setEnviando(false);
      }
    },
    [subirCapturas, fallo, cargarMensajes, cargarLista],
  );

  /** Cierra el ticket (el estado se deriva del chat). */
  const cerrar = useCallback(
    async (chatId: number) => {
      setError(null);
      const r = await window.bling.soporteCerrar(chatId);
      if (!r.ok) {
        fallo(r.codigo, r.detalle);
        return false;
      }
      await cargarLista();
      return true;
    },
    [fallo, cargarLista],
  );

  /** Reabre un ticket cerrado. */
  const reabrir = useCallback(
    async (chatId: number) => {
      setError(null);
      const r = await window.bling.soporteReabrir(chatId);
      if (!r.ok) {
        fallo(r.codigo, r.detalle);
        return false;
      }
      await cargarLista();
      return true;
    },
    [fallo, cargarLista],
  );

  return {
    tickets,
    mensajes,
    seleccionado,
    cargando,
    enviando,
    error,
    datosEquipo,
    abrir,
    volver,
    nuevo,
    responder,
    cerrar,
    reabrir,
    limpiarError: () => setError(null),
  };
}
