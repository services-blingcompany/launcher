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

export type UpdateCheckResult =
  | { status: "up-to-date"; current: string }
  | {
      status: "available";
      current: string;
      update: UpdateInfo;
      dismissed: boolean;
    };

interface BlingApi {
  openService(service: BlingServiceRequest): Promise<boolean>;
  openExternal(url: string): Promise<void>;
  minimize(): void;
  close(): void;

  appVersion(): Promise<string>;
  checkForUpdates(): Promise<UpdateCheckResult>;
  dismissUpdate(version: string): void;
  openUpdateLink(url: string): Promise<void>;
  onUpdateAvailable(
    callback: (update: UpdateInfo) => void,
  ): () => void;
}

declare global {
  interface Window {
    bling: BlingApi;
  }
}

export {};
