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

/** Credenciales del formulario nativo. */
export type AuthCredentials = {
  email: string;
  password: string;
  rememberMe?: boolean;
};

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
  /** Servicio pedido desde afuera (jump list, --abrir=) y todavía sin abrir. */
  takePendingService(): Promise<string | null>;
  onOpenService(callback: (id: string) => void): () => void;

  // ── Sesión ──
  /** Perfil de la sesión activa, o null si no hay nadie logueado. */
  authStatus(): Promise<BlingUser | null>;
  /** Login nativo contra bling.uy; las cookies quedan en el jar compartido. */
  authLogin(credenciales: AuthCredentials): Promise<AuthLoginResult>;
  /** Cierra sesión en el backend y borra las cookies locales. */
  authLogout(): Promise<boolean>;
  /** Notificaciones sin leer del usuario logueado. */
  authNotifications(): Promise<NotificationsCount>;
  /** Informa al main el contador: avisos nativos y globito de la barra. */
  reportNotifications(conteo: number): void;
  /** Aviso push del main cuando la sesión cambia. */
  onAuthChanged(callback: (user: BlingUser | null) => void): () => void;

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
