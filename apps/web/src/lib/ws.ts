import type { BusEvent, PtyServerEvent } from "@coord-ui/shared";

// The socket carries broadcast BusEvents plus per-connection PTY stream events
// (pty_data/pty_exit), so handlers may receive either.
type Handler = (event: BusEvent | PtyServerEvent) => void;

class BusSocket {
  private ws: WebSocket | null = null;
  private handlers = new Set<Handler>();
  private url: string;

  constructor(url: string) {
    this.url = url;
  }

  connect() {
    this.ws = new WebSocket(this.url);

    this.ws.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data as string) as BusEvent;
        for (const h of this.handlers) h(event);
      } catch {
        // malformed frame — ignore
      }
    };

    this.ws.onclose = () => {
      setTimeout(() => this.connect(), 2000); // auto-reconnect
    };
  }

  on(fn: Handler) {
    this.handlers.add(fn);
    return () => this.handlers.delete(fn);
  }

  send(payload: object) {
    this.ws?.send(JSON.stringify(payload));
  }
}

const WS_URL =
  (import.meta.env["VITE_WS_URL"] as string | undefined) ??
  `ws://localhost:3000`;
export const busSocket = new BusSocket(WS_URL);
