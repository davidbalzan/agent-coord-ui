import type { BusEvent, PtyServerEvent } from "@coord-ui/shared";
import { getToken, notifyUnauthorized } from "./auth.js";

// Must match WS_AUTH_PROTOCOL on the server (apps/api/src/auth.ts). The JWT is
// passed as a subprotocol so it never lands in the URL (which would leak into
// access logs).
const WS_AUTH_PROTOCOL = "coord-auth";

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
    // Idempotent: if a socket is already connecting or open, do nothing. This
    // dedups the module-load connect() and the post-login connect() (which would
    // otherwise reconnect-flicker). A closed socket — including after a 1008 auth
    // rejection — falls through and reconnects (e.g. re-login after expiry).
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.CONNECTING ||
        this.ws.readyState === WebSocket.OPEN)
    ) {
      return;
    }
    // Detach the old (closing/closed) socket's handlers so its onclose can't
    // trigger a duplicate reconnect or unauthorized notification.
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onmessage = null;
    }

    const token = getToken();
    this.ws = token
      ? new WebSocket(this.url, [WS_AUTH_PROTOCOL, token])
      : new WebSocket(this.url);

    this.ws.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data as string) as BusEvent;
        for (const h of this.handlers) h(event);
      } catch {
        // malformed frame — ignore
      }
    };

    this.ws.onclose = (e) => {
      // 1008 = policy violation: the server rejected our auth. Don't reconnect
      // in a loop — surface it so the UI can re-prompt for login.
      if (e.code === 1008) {
        notifyUnauthorized();
        return;
      }
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
