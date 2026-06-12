import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import AnsiToHtml from "ansi-to-html";
import { useBusStore } from "../store/bus.js";
import { XtermPane, type PtyState } from "./terminal/XtermPane.js";
import { usePanelZ } from "../hooks/usePanelZ.js";

const ansiConverter = new AnsiToHtml({
  fg: "#33ff66",
  bg: "transparent",
  newline: true,
  escapeXML: true,
  stream: false,
});
import type { PaneSnapshot } from "@coord-ui/shared";
import { useResizeHandle, cornerHandle } from "../hooks/useResize.js";
import { FONT_MONO } from "../theme/tokens.js";

const W = 660;
const H = 400;
const STACK_OFFSET = 10; // px per card in the stack

function activityColor(lastActivity: number): string {
  const ago = (Date.now() - lastActivity) / 1000;
  return ago < 5 ? "#00ff41" : ago < 30 ? "#ff8c00" : "#444";
}

interface TitleBarProps {
  pane: PaneSnapshot;
  sessionPanes: PaneSnapshot[];
  activeIdx: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onMouseDown: (e: React.MouseEvent) => void;
}

function TitleBar({
  pane,
  sessionPanes,
  activeIdx,
  onClose,
  onPrev,
  onNext,
  onMouseDown,
}: TitleBarProps) {
  const ago = Math.round((Date.now() - pane.lastActivity) / 1000);
  const actColor = activityColor(pane.lastActivity);
  const total = sessionPanes.length;

  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "0 10px",
        height: 34,
        flexShrink: 0,
        cursor: "grab",
        userSelect: "none",
        background: "rgba(0,255,65,0.04)",
        borderBottom: "1px solid rgba(0,255,65,0.12)",
      }}
    >
      {/* Traffic lights */}
      <button
        onClick={onClose}
        style={dotStyle("#ff5f57", "rgba(255,95,87,0.5)")}
      />
      <div style={dotStyle("rgba(255,165,0,0.35)", "none")} />
      <div style={dotStyle("rgba(0,255,65,0.35)", "none")} />

      {/* Session label */}
      <span
        style={{
          fontFamily: FONT_MONO,
          fontSize: "0.66rem",
          letterSpacing: "0.07em",
          color: "rgba(0,255,65,0.55)",
          flex: 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          textAlign: "center",
        }}
      >
        {pane.session}
        <span style={{ opacity: 0.4, margin: "0 5px" }}>·</span>
        {pane.window}.{pane.pane}
        <span style={{ opacity: 0.4, margin: "0 5px" }}>·</span>
        {pane.command}
      </span>

      {/* Stack navigator — only shown when there are siblings */}
      {total > 1 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            flexShrink: 0,
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPrev();
            }}
            style={navBtn}
          >
            ‹
          </button>
          <span
            style={{
              fontFamily: FONT_MONO,
              fontSize: "0.6rem",
              color: "rgba(0,255,65,0.45)",
              minWidth: 28,
              textAlign: "center",
            }}
          >
            {activeIdx + 1}/{total}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNext();
            }}
            style={navBtn}
          >
            ›
          </button>
        </div>
      )}

      {/* Activity */}
      <span
        style={{
          fontFamily: FONT_MONO,
          fontSize: "0.6rem",
          color: actColor,
          flexShrink: 0,
        }}
      >
        {ago}s
      </span>
      <div
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: actColor,
          boxShadow: `0 0 5px ${actColor}`,
          flexShrink: 0,
        }}
      />
    </div>
  );
}

const dotStyle = (bg: string, shadow: string): React.CSSProperties => ({
  width: 12,
  height: 12,
  borderRadius: "50%",
  flexShrink: 0,
  background: bg,
  border: "none",
  cursor: "pointer",
  padding: 0,
  boxShadow: shadow !== "none" ? `0 0 6px ${shadow}` : undefined,
});

const navBtn: React.CSSProperties = {
  background: "none",
  border: "1px solid rgba(0,255,65,0.2)",
  borderRadius: 3,
  color: "rgba(0,255,65,0.6)",
  fontFamily: FONT_MONO,
  fontSize: "0.75rem",
  lineHeight: 1,
  cursor: "pointer",
  padding: "1px 5px",
};

export function FloatingTerminal() {
  const paneSelection = useBusStore((s) => s.paneSelection);
  const setPaneSelection = useBusStore((s) => s.setPaneSelection);
  const panesMap = useBusStore((s) => s.panes);
  const paneAnsi = useBusStore((s) => s.paneAnsi);
  const sendPaneKeys = useBusStore((s) => s.sendPaneKeys);
  const requestOutput = useBusStore((s) => s.requestPaneOutput);
  const panelZ = usePanelZ("terminal");

  const activePane = paneSelection ? panesMap[paneSelection] : undefined;

  // All panes in the same tmux session, sorted by window.pane
  const sessionPanes = useMemo<PaneSnapshot[]>(
    () =>
      activePane
        ? Object.values(panesMap)
            .filter((p) => p.session === activePane.session)
            .sort((a, b) => a.window - b.window || a.pane - b.pane)
        : [],
    [activePane, panesMap]
  );

  const activeIdx = sessionPanes.findIndex((p) => p.id === paneSelection);

  const goTo = useCallback(
    (idx: number) => {
      const target =
        sessionPanes[(idx + sessionPanes.length) % sessionPanes.length];
      if (target) setPaneSelection(target.id);
    },
    [sessionPanes, setPaneSelection]
  );

  const [input, setInput] = useState("");
  // PTY (xterm) lifecycle. "closed" → fall back to the read-only ANSI snapshot.
  const [ptyState, setPtyState] = useState<PtyState>("connecting");
  const ptyFallback = ptyState === "closed";
  const outputRef = useRef<HTMLPreElement>(null);
  const [rect, setRect] = useState({ x: 16, y: 16, w: W, h: H });
  const dragRef = useRef<{
    ox: number;
    oy: number;
    px: number;
    py: number;
  } | null>(null);
  const onResize = useResizeHandle(setRect);
  const [lifting, setLifting] = useState(false); // drives the lift animation
  const prevPaneRef = useRef<string | null>(null);

  useEffect(() => {
    if (!paneSelection) return;
    setPtyState("connecting"); // re-attempt the PTY for the newly-selected pane
    requestOutput(paneSelection);
    // Trigger lift animation only when switching between panes (not on first open)
    if (prevPaneRef.current && prevPaneRef.current !== paneSelection) {
      setLifting(true);
    }
    prevPaneRef.current = paneSelection;
  }, [paneSelection, requestOutput]);

  // Poll for fresh ANSI output while a pane is open
  useEffect(() => {
    if (!paneSelection) return;
    const id = setInterval(() => requestOutput(paneSelection), 2000);
    return () => clearInterval(id);
  }, [paneSelection, requestOutput]);

  useEffect(() => {
    if (outputRef.current)
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [activePane?.lines, paneAnsi[paneSelection ?? ""]]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || !paneSelection) return;
    sendPaneKeys(paneSelection, text + "\n");
    setInput("");
  }, [input, paneSelection, sendPaneKeys]);

  const onTitleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).tagName === "BUTTON") return;
      e.preventDefault();
      dragRef.current = {
        ox: e.clientX,
        oy: e.clientY,
        px: rect.x,
        py: rect.y,
      };
      const onMove = (ev: MouseEvent) => {
        if (!dragRef.current) return;
        setRect((r) => ({
          ...r,
          x: Math.max(
            0,
            dragRef.current!.px + ev.clientX - dragRef.current!.ox
          ),
          y: Math.max(
            0,
            dragRef.current!.py + ev.clientY - dragRef.current!.oy
          ),
        }));
      };
      const onUp = () => {
        dragRef.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [rect.x, rect.y]
  );

  if (!paneSelection || !activePane) return null;

  // Cards behind the active one (all siblings except active, in order)
  const behind = sessionPanes.filter((p) => p.id !== paneSelection);

  return (
    <>
      {/* Behind cards — rendered bottom-to-top so closest is painted last */}
      {[...behind].reverse().map((p, revIdx) => {
        const depth = behind.length - revIdx; // 1 = closest to active
        const offset = depth * STACK_OFFSET;
        const ageColor = activityColor(p.lastActivity);
        return (
          <div
            key={p.id}
            onClick={() => setPaneSelection(p.id)}
            onMouseDownCapture={panelZ.onMouseDownCapture}
            title={`${p.session} ${p.window}.${p.pane} — click to focus`}
            style={{
              position: "fixed",
              left: rect.x + offset,
              top: rect.y + offset,
              width: rect.w,
              height: rect.h,
              zIndex: panelZ.zIndex + Math.min(9, behind.length - depth),
              borderRadius: 6,
              background: "rgba(0, 4, 12, 0.22)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              border: "1px solid rgba(0,255,65,0.09)",
              boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
              cursor: "pointer",
              opacity: Math.max(0.45, 0.82 - depth * 0.16),
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "0 10px",
                height: 34,
                background: "rgba(0,255,65,0.025)",
                borderBottom: "1px solid rgba(0,255,65,0.07)",
              }}
            >
              <div style={dotStyle("rgba(255,95,87,0.2)", "none")} />
              <div style={dotStyle("rgba(255,165,0,0.2)", "none")} />
              <div style={dotStyle("rgba(0,255,65,0.2)", "none")} />
              <span
                style={{
                  flex: 1,
                  fontFamily: FONT_MONO,
                  fontSize: "0.64rem",
                  color: "rgba(0,255,65,0.3)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  textAlign: "center",
                  letterSpacing: "0.06em",
                }}
              >
                {p.session} · {p.window}.{p.pane} · {p.command}
              </span>
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: ageColor,
                  flexShrink: 0,
                }}
              />
            </div>
          </div>
        );
      })}

      {/* Active terminal */}
      <div
        className={lifting ? "terminal-lift" : ""}
        onAnimationEnd={() => setLifting(false)}
        onMouseDownCapture={panelZ.onMouseDownCapture}
        style={{
          position: "fixed",
          left: rect.x,
          top: rect.y,
          width: rect.w,
          height: rect.h,
          zIndex: panelZ.zIndex + 10,
          display: "flex",
          flexDirection: "column",
          borderRadius: 6,
          overflow: "hidden",
          // Active card is deliberately more transparent — glass effect shines through
          background: "rgba(0, 4, 12, 0.10)",
          backdropFilter: "blur(32px) saturate(180%)",
          WebkitBackdropFilter: "blur(32px) saturate(180%)",
          border: "1px solid rgba(0,255,65,0.28)",
          boxShadow:
            "0 12px 56px rgba(0,0,0,0.65), 0 0 0 1px rgba(0,255,65,0.07), inset 0 1px 0 rgba(0,255,65,0.12)",
        }}
      >
        {/* Corner resize handles */}
        {(["nw", "ne", "sw", "se"] as const).map((edge) => (
          <div
            key={edge}
            onMouseDown={(e) => onResize(e, edge)}
            style={{
              ...cornerHandle(edge),
              // Visual tick marks at corners
              background: "transparent",
            }}
          >
            <svg
              width="14"
              height="14"
              style={{ display: "block", opacity: 0.35 }}
            >
              {edge === "se" && (
                <>
                  <line
                    x1="14"
                    y1="6"
                    x2="14"
                    y2="14"
                    stroke="#00ff41"
                    strokeWidth="1.5"
                  />
                  <line
                    x1="6"
                    y1="14"
                    x2="14"
                    y2="14"
                    stroke="#00ff41"
                    strokeWidth="1.5"
                  />
                </>
              )}
              {edge === "sw" && (
                <>
                  <line
                    x1="0"
                    y1="6"
                    x2="0"
                    y2="14"
                    stroke="#00ff41"
                    strokeWidth="1.5"
                  />
                  <line
                    x1="0"
                    y1="14"
                    x2="8"
                    y2="14"
                    stroke="#00ff41"
                    strokeWidth="1.5"
                  />
                </>
              )}
              {edge === "ne" && (
                <>
                  <line
                    x1="14"
                    y1="0"
                    x2="14"
                    y2="8"
                    stroke="#00ff41"
                    strokeWidth="1.5"
                  />
                  <line
                    x1="6"
                    y1="0"
                    x2="14"
                    y2="0"
                    stroke="#00ff41"
                    strokeWidth="1.5"
                  />
                </>
              )}
              {edge === "nw" && (
                <>
                  <line
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="8"
                    stroke="#00ff41"
                    strokeWidth="1.5"
                  />
                  <line
                    x1="0"
                    y1="0"
                    x2="8"
                    y2="0"
                    stroke="#00ff41"
                    strokeWidth="1.5"
                  />
                </>
              )}
            </svg>
          </div>
        ))}
        <TitleBar
          pane={activePane}
          sessionPanes={sessionPanes}
          activeIdx={activeIdx}
          onClose={() => setPaneSelection(null)}
          onPrev={() => goTo(activeIdx - 1)}
          onNext={() => goTo(activeIdx + 1)}
          onMouseDown={onTitleMouseDown}
        />

        {/* Terminal output */}
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              zIndex: 1,
              backgroundImage:
                "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.07) 2px, rgba(0,0,0,0.07) 4px)",
            }}
          />
          {/* Fallback notice — the live PTY couldn't attach; we're showing the
              read-only ANSI snapshot. Surfaced so it's never silent. */}
          {ptyFallback && (
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                zIndex: 3,
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "5px 12px",
                background: "rgba(40, 18, 0, 0.93)",
                borderBottom: "1px solid rgba(255,140,0,0.45)",
                fontFamily: FONT_MONO,
                fontSize: "0.66rem",
                letterSpacing: "0.05em",
                color: "#ffb454",
                textShadow: "0 0 6px rgba(255,140,0,0.4)",
              }}
            >
              <span style={{ flex: 1 }}>
                ⚠ LIVE TERMINAL UNAVAILABLE — showing read-only snapshot
              </span>
              <button
                onClick={() => setPtyState("connecting")}
                title="Retry the live PTY connection"
                style={{
                  background: "rgba(255,140,0,0.12)",
                  border: "1px solid rgba(255,140,0,0.5)",
                  color: "#ffb454",
                  fontFamily: FONT_MONO,
                  fontSize: "0.62rem",
                  letterSpacing: "0.1em",
                  padding: "2px 9px",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                ↻ RETRY
              </button>
            </div>
          )}
          {ptyFallback ? (
            <pre
              ref={outputRef}
              style={{
                position: "absolute",
                inset: 0,
                margin: 0,
                padding: "8px 14px 4px",
                overflowY: "auto",
                fontFamily: FONT_MONO,
                fontSize: "0.71rem",
                lineHeight: 1.5,
                color: "#33ff66",
                background: "rgba(0, 8, 2, 0.55)",
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
                textShadow: "0 0 4px rgba(0,255,65,0.3)",
              }}
              dangerouslySetInnerHTML={{
                __html: paneAnsi[activePane.id]
                  ? ansiConverter.toHtml(paneAnsi[activePane.id]!)
                  : activePane.lines.join("\n"),
              }}
            />
          ) : (
            // Real interactive PTY view. Remount on pane switch via key.
            <XtermPane
              key={activePane.id}
              paneId={activePane.id}
              onState={setPtyState}
            />
          )}
        </div>

        {/* Input — fallback only; the live PTY captures keystrokes directly */}
        {ptyFallback && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              height: 32,
              flexShrink: 0,
              borderTop: "1px solid rgba(0,255,65,0.12)",
              background: "rgba(0,8,2,0.7)",
              padding: "0 0 0 10px",
            }}
          >
            <span
              style={{
                fontFamily: FONT_MONO,
                fontSize: "0.71rem",
                color: "rgba(0,255,65,0.5)",
                userSelect: "none",
                whiteSpace: "nowrap",
                textShadow: "0 0 4px rgba(0,255,65,0.3)",
              }}
            >
              {activePane.session}:{activePane.window}.{activePane.pane}
              <span style={{ color: "rgba(0,255,65,0.8)", marginLeft: 4 }}>
                $
              </span>
            </span>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder=" type and press Enter…"
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                color: "#33ff66",
                fontFamily: FONT_MONO,
                fontSize: "0.71rem",
                caretColor: "#33ff66",
                padding: "0 6px",
                textShadow: "0 0 4px rgba(0,255,65,0.3)",
              }}
            />
            <button
              onClick={handleSend}
              style={{
                height: "100%",
                padding: "0 12px",
                background: "rgba(0,255,65,0.07)",
                border: "none",
                borderLeft: "1px solid rgba(0,255,65,0.1)",
                color: "rgba(0,255,65,0.6)",
                fontFamily: FONT_MONO,
                fontSize: "0.8rem",
                cursor: "pointer",
              }}
            >
              ↵
            </button>
          </div>
        )}
      </div>
    </>
  );
}
