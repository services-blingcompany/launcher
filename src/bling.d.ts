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
};

/** Entrada mínima del catálogo que el renderer manda a la bandeja. */
export type CatalogEntry = { id: string; name: string };

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
  onOpenService(callback: (id: string) => void): () => void;

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
