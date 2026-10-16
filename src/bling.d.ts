/**
 * API que expone electron/preload.cjs vía contextBridge.
 * El renderer sólo puede hacer estas cuatro cosas.
 */
export type BlingServiceRequest = {
  id: string;
  url: string;
  title: string;
};

interface BlingApi {
  openService(service: BlingServiceRequest): Promise<boolean>;
  openExternal(url: string): Promise<void>;
  minimize(): void;
  close(): void;
}

declare global {
  interface Window {
    bling: BlingApi;
  }
}

export {};
