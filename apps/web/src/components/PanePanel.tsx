import { useEffect, useRef, useState, useCallback } from "react";
import { useBusStore } from "../store/bus.js";
import { FONT_MONO } from "../theme/tokens.js";

interface Props {
  paneId: string; // "pane:session:window.pane" — strip prefix before use
}

export function PanePanel({ paneId }: Props) {
  const rawId = paneId.replace(/^pane:/, "");
  const pane = useBusStore((s) => s.panes[rawId]);
  const sendPaneKeys = useBusStore((s) => s.sendPaneKeys);
  const requestPaneOutput = useBusStore((s) => s.requestPaneOutput);

  const [input, setInput] = useState("");
  const outputRef = useRef<HTMLPreElement>(null);

  // Request fresh ANSI output when the panel opens
  useEffect(() => {
    requestPaneOutput(rawId);
  }, [rawId, requestPaneOutput]);

  // Scroll to bottom on new content
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [pane?.lines]);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;
    sendPaneKeys(rawId, trimmed + "\n");
    setInput("");
  }, [input, rawId, sendPaneKeys]);

  if (!pane) {
    return (
      <div
        style={{
          padding: "1rem",
          color: "#334466",
          fontFamily: FONT_MONO,
          fontSize: "0.8rem",
        }}
      >
        PANE NOT FOUND
      </div>
    );
  }

  const lastActivityAgo = Math.round((Date.now() - pane.lastActivity) / 1000);
  const activityColor =
    lastActivityAgo < 5
      ? "#00ff41"
      : lastActivityAgo < 30
        ? "#ff8c00"
        : "#334466";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        gap: "0.5rem",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          padding: "0.5rem 0",
          borderBottom: "1px solid rgba(0,255,65,0.2)",
        }}
      >
        <span
          style={{
            color: "#00ff41",
            fontFamily: FONT_MONO,
            fontSize: "0.7rem",
            letterSpacing: "0.1em",
          }}
        >
          {"// TMUX PANE"}
        </span>
        <span
          style={{
            marginLeft: "auto",
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: activityColor,
            boxShadow: `0 0 6px ${activityColor}`,
          }}
        />
        <span
          style={{
            color: activityColor,
            fontFamily: FONT_MONO,
            fontSize: "0.65rem",
          }}
        >
          {lastActivityAgo}s ago
        </span>
      </div>

      {/* Meta */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "0.25rem 1rem",
          padding: "0.25rem 0",
        }}
      >
        {[
          ["SESSION", pane.session],
          ["WINDOW", `${pane.window}.${pane.pane}`],
          ["COMMAND", pane.command],
          ["PID", String(pane.pid)],
        ].map(([label, value]) => (
          <div
            key={label}
            style={{ display: "flex", flexDirection: "column", gap: 2 }}
          >
            <span
              style={{
                color: "#334466",
                fontFamily: FONT_MONO,
                fontSize: "0.6rem",
                letterSpacing: "0.08em",
              }}
            >
              {label}
            </span>
            <span
              style={{
                color: "#00d4ff",
                fontFamily: FONT_MONO,
                fontSize: "0.72rem",
              }}
            >
              {value}
            </span>
          </div>
        ))}
      </div>

      {/* Output */}
      <pre
        ref={outputRef}
        style={{
          flex: 1,
          overflowY: "auto",
          margin: 0,
          padding: "0.5rem",
          background: "rgba(0,255,65,0.03)",
          border: "1px solid rgba(0,255,65,0.15)",
          borderRadius: 2,
          fontFamily: FONT_MONO,
          fontSize: "0.68rem",
          lineHeight: 1.5,
          color: "#a8ffb8",
          whiteSpace: "pre-wrap",
          wordBreak: "break-all",
        }}
      >
        {pane.lines.join("\n") || "— no output —"}
      </pre>

      {/* Send keys */}
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="send keys…"
          style={{
            flex: 1,
            background: "rgba(0,255,65,0.05)",
            border: "1px solid rgba(0,255,65,0.3)",
            borderRadius: 2,
            padding: "0.35rem 0.6rem",
            color: "#00ff41",
            fontFamily: FONT_MONO,
            fontSize: "0.75rem",
            outline: "none",
          }}
        />
        <button
          onClick={handleSend}
          style={{
            padding: "0.35rem 0.75rem",
            background: "rgba(0,255,65,0.1)",
            border: "1px solid rgba(0,255,65,0.4)",
            borderRadius: 2,
            color: "#00ff41",
            fontFamily: FONT_MONO,
            fontSize: "0.72rem",
            cursor: "pointer",
            letterSpacing: "0.08em",
          }}
        >
          SEND
        </button>
      </div>
    </div>
  );
}
