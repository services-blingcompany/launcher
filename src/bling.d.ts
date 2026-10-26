/**
 * API que expone electron/preload.cjs vía contextBridge.
 * El renderer sólo puede hacer estas cosas.
 */
export type BlingServiceRequest = {
  id: string;
  url: string;
  title: string;
};

/** Versión nueva disponible, tal como la arma el proceso principal. */
export type UpdateInfo = {
  version: string;
  notes: string;
  url: string;
  page: string;
};

export type UpdateCheckResult = {
  status: "available" | "up-to-date";
  current: string;
  update: UpdateInfo | null;
  dismissed: boolean;
  progress: UpdateProgress | null;
  downloaded: boolean;
};

/** Progreso de descarga de la actualización. */
export type UpdateProgress = {
  percent: number;
  transferred: number;
  total: number;
  bytesPerSecond: number;
};

/** Ajustes persistidos por el proceso principal. */
export type Settings = {
  abrirAlIniciar: boolean;
  minimizarBandeja: boolean;
  descargarActualizaciones: boolean;
  /** Aviso nativo de Windows cuando llegan notificaciones nuevas. */
  avisosEscritorio: boolean;
  /** Atajo global que trae el launcher al frente desde cualquier aplicación. */
  atajoGlobal: boolean;
  /** Nivel de zoom del renderer (1.2^zoom; 0 = 100 %). */
  zoom: number;
};

/** Entrada mínima del catálogo que el renderer manda a la bandeja. */
export type CatalogEntry = { id: string; name: string };

/** Perfil de persona, tal como lo devuelve /api/auth/me. */
export type BlingPersona = {
  nombre: string;
  apellido?: string | null;
  alias?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
};

/** Perfil de empresa, tal como lo devuelve /api/auth/me. */
export type BlingEmpresa = {
  nombre_comercial: string;
  nombre_legal?: string;
  alias?: string | null;
  avatar_url?: string | null;
};

/** Sesión activa de Bling (la fuente es el backend, no el renderer). */
export type BlingUser = {
  id: number;
  number?: number;
  email: string;
  account_type: "PERSONA" | "EMPRESA" | "STAFF" | string;
  role: string;
  is_verified: boolean;
  is_active: boolean;
  /** Avatar del perfil (lo devuelve el login con Google/redes). */
  avatar_url?: string | null;
  persona?: BlingPersona | null;
  empresa?: BlingEmpresa | null;
};

/** Respuesta del login nativo: ok con perfil, o error mostrable. */
export type AuthLoginResult = {
  ok: boolean;
  user?: BlingUser | null;
  error?: string;
  necesitaVerificar?: boolean;
};

/** Contador de notificaciones sin leer. */
export type NotificationsCount = { count: number; autenticado: boolean };

/** App del catálogo remoto de licencias (GET /api/v1/licenses). */
export type LicenciaApp = {
  key: string;
  name: string;
  description: string;
  requiredTier: string;
  webUrl: string | null;
  hasAccess: boolean;
  /** Última versión activa por plataforma ({"win-x64": "1.2.0"}). */
  versions: Record<string, string>;
};

/** Respuesta del catálogo de licencias desde el proceso principal. */
export type LicenciasCatalogoResult = {
  ok: boolean;
  apps?: LicenciaApp[];
  plataforma?: string;
  /** Motivo cuando ok=false: sin-sesion | sin-conexion | servidor | ... */
  codigo?: string;
};

/** Resultado de pedir la descarga de una app. */
export type LicenciaDescargaResult = {
  ok: boolean;
  key?: string;
  version?: string;
  archivo?: string;
  /** sin-sesion | sin-licencia | sin-version | sin-descargas | servidor | red | integridad | en-curso */
  codigo?: string;
};

/** Progreso de descarga de una app (push del proceso principal). */
export type LicenciaProgreso = {
  key: string;
  transferidos: number;
  total: number;
  listo?: boolean;
};

/** App descargada en disco, lista para instalar. */
export type LicenciaInstalada = { version: string; archivo: string };

/** Resultado de abrir la app nativa con su ticket de licencia. */
export type LicenciaAbrirResult = {
  ok: boolean;
  /** no-instalada | sin-sesion | sin-licencia | sin-version | servidor | red */
  codigo?: string;
};

/** Credenciales del formulario nativo. */
export type AuthCredentials = {
  email: string;
  password: string;
  rememberMe?: boolean;
};

// ── Soporte (chat de tickets) ──

/** Ticket de soporte (GET/POST /api/v1/tickets). */
export type SoporteTicket = {
  id: number;
  /** El ID visible, ej. "BLING-0007". */
  ticket_number: string;
  /** "support" es el chat directo; los tipos viejos son del FeedbackModal. */
  type: "report" | "suggestion" | "bug" | "other" | "support" | string;
  title: string;
  description: string;
  status: "open" | "in_progress" | "resolved" | "closed" | string;
  /** Chat asociado: de ahí salen los mensajes; su estado manda sobre el ticket. */
  chat_id: number | null;
  created_at: string;
  updated_at: string;
};

/** Adjunto de un mensaje (el endpoint de upload ya devuelve AVIF). */
export type SoporteAdjunto = {
  url: string;
  filename: string;
  type: string;
  size: number;
};

/** Mensaje de la conversación de un ticket. */
export type SoporteMensaje = {
  id: number;
  chat_id: number;
  sender_id: number | null;
  content: string;
  attachments: SoporteAdjunto[] | null;
  is_deleted: boolean;
  created_at: string;
  sender_name?: string | null;
  sender_avatar?: string | null;
};

/** Fallo común de cualquier acción de soporte (el detalle suele venir del backend). */
export type SoporteFallo = {
  ok: false;
  /** sin-sesion | sin-licencia | tope | sin-conexion | servidor | capturas | error */
  codigo: string;
  detalle: string | null;
};

export type SoporteListaResult = { ok: true; tickets: SoporteTicket[] } | SoporteFallo;
export type SoporteMensajesResult =
  | { ok: true; mensajes: SoporteMensaje[] }
  | SoporteFallo;
export type SoporteNuevoResult = { ok: true; ticket: SoporteTicket } | SoporteFallo;
export type SoporteResponderResult =
  | { ok: true; mensaje: SoporteMensaje }
  | SoporteFallo;
export type SoporteSubirResult =
  | { ok: true; adjunto: SoporteAdjunto }
  | SoporteFallo;
export type SoporteImagenResult =
  | { ok: true; dataUrl: string }
  | SoporteFallo;
export type SoporteAccionResult = { ok: true } | SoporteFallo;

interface BlingApi {
  openService(service: BlingServiceRequest): Promise<boolean>;
  openExternal(url: string): Promise<void>;
  minimize(): void;
  close(): void;

  /** Ids de servicios usados por última vez, más reciente primero. */
  getRecents(): Promise<string[]>;
  addRecent(id: string): Promise<string[]>;
  clearRecents(): Promise<string[]>;

  /** Ajustes actuales. */
  getSettings(): Promise<Settings>;
  setSetting<K extends keyof Settings>(
    key: K,
    value: Settings[K],
  ): Promise<Settings>;
  setCatalog(servicios: CatalogEntry[]): void;
  /** El main avisa cuando cambia un ajuste por su cuenta (zoom con Ctrl +/-). */
  onSettingsChanged(callback: (settings: Settings) => void): () => void;
  /**
   * Combinación del atajo global que quedó registrada, o null si está apagado
   * o si otra aplicación ya usaba las combinaciones probadas.
   */
  atajoGlobal(): Promise<string | null>;
  /** Servicio pedido desde afuera (jump list, --abrir=) y todavía sin abrir. */
  takePendingService(): Promise<string | null>;
  onOpenService(callback: (id: string) => void): () => void;

  // ── Sesión ──
  /** Perfil de la sesión activa, o null si no hay nadie logueado. */
  authStatus(): Promise<BlingUser | null>;
  /** Login nativo contra bling.uy; las cookies quedan en el jar compartido. */
  authLogin(credenciales: AuthCredentials): Promise<AuthLoginResult>;
  /** Login con Google en el navegador del sistema (usa la cuenta ya abierta). */
  authGoogleSistema(): Promise<AuthLoginResult>;
  /** Cierra sesión en el backend y borra las cookies locales. */
  authLogout(): Promise<boolean>;
  /** Notificaciones sin leer del usuario logueado. */
  authNotifications(): Promise<NotificationsCount>;
  /** Informa al main el contador: avisos nativos y globito de la barra. */
  reportNotifications(conteo: number): void;
  /** Aviso push del main cuando la sesión cambia. */
  onAuthChanged(callback: (user: BlingUser | null) => void): () => void;

  // ── Licencias de apps ──
  /** Catálogo remoto con los flags de licencia del usuario de la sesión. */
  licenciasCatalogo(): Promise<LicenciasCatalogoResult>;
  /** Baja el binario de una app (URL firmada + verificación sha256). */
  licenciasDescargar(key: string): Promise<LicenciaDescargaResult>;
  /** Versión descargada en disco de una app, o null. */
  licenciasInstalado(key: string): Promise<LicenciaInstalada | null>;
  /** Ejecuta el instalador ya descargado. */
  licenciasInstalar(key: string): Promise<boolean>;
  /** Abre la app nativa instalada con su ticket de licencia. */
  licenciasAbrir(key: string): Promise<LicenciaAbrirResult>;
  /** ¿Está el ejecutable nativo de la app instalado en la PC? */
  licenciasEjecutable(key: string): Promise<boolean>;
  /** Progreso de descarga de apps (push del proceso principal). */
  onLicenciaProgreso(
    callback: (progreso: LicenciaProgreso | null) => void,
  ): () => void;
  /** Push del main: el exe nativo de la app apareció en la PC. */
  onLicenciaEjecutable(
    callback: (aviso: { key: string; presente: boolean } | null) => void,
  ): () => void;

  // ── Soporte (chat de tickets) ──
  /** Tickets de soporte del usuario. */
  soporteLista(): Promise<SoporteListaResult>;
  /** Conversación de un ticket, más nuevo primero (la UI la da vuelta). */
  soporteMensajes(chatId: number): Promise<SoporteMensajesResult>;
  /** Abre un ticket con el primer mensaje; el título lo deriva el backend. */
  soporteNuevo(payload: {
    mensaje: string;
    /** Bloque de datos del equipo si el usuario ofreció compartirlos. */
    datosEquipo?: string | null;
    /** Hasta 4 capturas ya subidas con soporteSubir. */
    capturas?: SoporteAdjunto[];
  }): Promise<SoporteNuevoResult>;
  /** Responde en la conversación de un ticket. */
  soporteResponder(payload: {
    chatId: number;
    contenido: string;
    capturas?: SoporteAdjunto[];
  }): Promise<SoporteResponderResult>;
  /** Cierra el ticket (el estado se deriva del chat). */
  soporteCerrar(chatId: number): Promise<SoporteAccionResult>;
  /** Reabre un ticket cerrado. */
  soporteReabrir(chatId: number): Promise<SoporteAccionResult>;
  /** Sube UNA captura (bytes comprimidos en base64) y devuelve su adjunto. */
  soporteSubir(archivo: {
    nombre: string;
    tipo: string;
    base64: string;
  }): Promise<SoporteSubirResult>;
  /** Baja una captura de /uploads como data URL (para poder mostrarla). */
  soporteImagen(url: string): Promise<SoporteImagenResult>;
  /** Set esencial de datos del equipo, ya armado por el proceso principal. */
  soporteDatosEquipo(): Promise<string>;

  // ── Diagnóstico ──
  /** Reporte de entorno y últimas líneas del registro, sin datos de la cuenta. */
  getDiagnostics(): Promise<string>;
  /** Guarda el reporte como .txt. Devuelve la ruta elegida, o null. */
  saveDiagnostics(texto: string): Promise<string | null>;
  /** Abre la carpeta del registro en el explorador. */
  openLogsFolder(): Promise<string | null>;

  appVersion(): Promise<string>;
  checkForUpdates(): Promise<UpdateCheckResult>;
  dismissUpdate(version: string): void;
  openUpdateLink(url: string): Promise<void>;
  downloadUpdate(): Promise<UpdateCheckResult>;
  installUpdate(): void;
  onUpdateAvailable(
    callback: (update: UpdateInfo) => void,
  ): () => void;
  onUpdateProgress(
    callback: (progress: UpdateProgress | null) => void,
  ): () => void;
  onUpdateDownloaded(
    callback: (update: UpdateInfo) => void,
  ): () => void;
}

declare global {
  interface Window {
    bling: BlingApi;
  }
}

export {};
