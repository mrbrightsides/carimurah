interface Pendo {
  track(eventName: string, properties?: Record<string, string | number | boolean>): void;
}

declare global {
  interface Window {
    pendo?: Pendo;
  }
  var pendo: Pendo | undefined;
}

export {};
