import { useEffect, useRef } from "react";
import type { Terminal } from "@xterm/xterm";
import type { FitAddon } from "@xterm/addon-fit";
import { busSocket } from "../../lib/ws.js";
import { FONT_MONO } from "../../theme/tokens.js";
import "@xterm/xterm/css/xterm.css";

export type PtyState = "connecting" | "active" | "closed";

interface Props {
  paneId: string;
  /** Reports lifecycle so the parent can fall back to the ANSI snapshot view. */
  onState?: (state: PtyState, error?: string) => void;
}

/**
 * A real PTY-backed terminal view for a tmux pane. Dynamically imports xterm
 * (keeping ~250KB off the initial bundle), attaches to the pane via the WS PTY
 * protocol, and streams raw bytes both ways. Cleans up the PTY on unmount /
 * pane switch. If the attach fails or the pty exits, reports "closed" so the
 * caller can show the read-only ANSI fallback.
 */
export function XtermPane({ paneId, onState }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onStateRef = useRef(onState);
  onStateRef.current = onState;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    let term: Terminal | null = null;
    let fit: FitAddon | null = null;
    let unsub: (() => void) | null = null;
    let resizeObs: ResizeObserver | null = null;
    let gotData = false;
    // If no PTY bytes arrive shortly after attach (server absent, non-loopback
    // rejection, or a silent failure), fall back to the read-only ANSI view.
    let connectTimer: ReturnType<typeof setTimeout> | null = null;

    onStateRef.current?.("connecting");

    void (async () => {
      const [{ Terminal: XTerm }, { FitAddon: Fit }] = await Promise.all([
        import("@xterm/xterm"),
        import("@xterm/addon-fit"),
      ]);
      if (disposed) return;

      term = new XTerm({
        fontFamily: FONT_MONO,
        fontSize: 12,
        cursorBlink: true,
        allowTransparency: true,
        theme: {
          background: "rgba(0, 8, 2, 0.55)",
          foreground: "#33ff66",
          cursor: "#33ff66",
          cursorAccent: "#001a08",
          selectionBackground: "rgba(0,255,65,0.25)",
        },
      });
      fit = new Fit();
      term.loadAddon(fit);
      term.open(container);
      fit.fit();

      busSocket.send({
        type: "pty_attach",
        paneId,
        cols: term.cols,
        rows: term.rows,
      });
      connectTimer = setTimeout(() => {
        if (!gotData) onStateRef.current?.("closed");
      }, 5000);

      term.onData((data) => {
        busSocket.send({ type: "pty_input", paneId, data });
      });

      unsub = busSocket.on((event) => {
        if (event.type === "pty_data" && event.paneId === paneId) {
          if (!gotData) {
            gotData = true;
            if (connectTimer) clearTimeout(connectTimer);
          }
          term?.write(event.data);
          onStateRef.current?.("active");
        } else if (event.type === "pty_exit" && event.paneId === paneId) {
          onStateRef.current?.("closed", event.error);
        }
      });

      resizeObs = new ResizeObserver(() => {
        if (!fit || !term) return;
        try {
          fit.fit();
          busSocket.send({
            type: "pty_resize",
            paneId,
            cols: term.cols,
            rows: term.rows,
          });
        } catch {
          // fit can throw if the container is transiently 0-sized — ignore
        }
      });
      resizeObs.observe(container);
      term.focus();
    })();

    return () => {
      disposed = true;
      if (connectTimer) clearTimeout(connectTimer);
      busSocket.send({ type: "pty_detach", paneId });
      resizeObs?.disconnect();
      unsub?.();
      term?.dispose();
    };
  }, [paneId]);

  return (
    <div
      ref={containerRef}
      style={{ position: "absolute", inset: 0, padding: "6px 8px 4px" }}
    />
  );
}
