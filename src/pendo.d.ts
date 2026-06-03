interface Pendo {
  initialize(options: any): void;
  identify(options: any): void;
  pageLoad(url?: string): void;
  track(eventName: string, properties?: Record<string, string | number | boolean>): void;
  trackAgent(eventName: string, properties?: Record<string, string | number | boolean>): void;
}

declare global {
  interface Window {
    pendo?: Pendo;
  }
  var pendo: Pendo | undefined;
}

export {};
