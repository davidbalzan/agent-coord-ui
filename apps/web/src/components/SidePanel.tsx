import { useState, useCallback, useRef } from "react";
import { useBusStore } from "../store/bus.js";
import { DMPanel } from "./DMPanel.js";
import { RoomPanel } from "./RoomPanel.js";
import { X } from "lucide-react";

const MIN_W = 260;
const MAX_W = 560;

export function SidePanel() {
  const selection = useBusStore((s) => s.selection);
  const setSelection = useBusStore((s) => s.setSelection);
  const [width, setWidth] = useState(320);
  const startRef = useRef<{ mx: number; w: number } | null>(null);

  const onEdgeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      startRef.current = { mx: e.clientX, w: width };
      const onMove = (ev: MouseEvent) => {
        if (!startRef.current) return;
        const delta = startRef.current.mx - ev.clientX; // dragging left = increase
        setWidth(Math.min(MAX_W, Math.max(MIN_W, startRef.current.w + delta)));
      };
      const onUp = () => {
        startRef.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [width]
  );

  if (!selection || selection.kind === "pane") return null;

  return (
    <aside
      className="flex-shrink-0 flex flex-col h-full glass-surface"
      style={{
        width,
        position: "relative",
      }}
    >
      {/* Left edge resize handle */}
      <div
        onMouseDown={onEdgeMouseDown}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 5,
          cursor: "w-resize",
          zIndex: 10,
          background: "transparent",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.background =
            "rgba(0,212,255,0.12)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.background = "transparent";
        }}
      />

      {/* Top accent */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "1px",
          background:
            "linear-gradient(90deg, transparent, rgba(0,212,255,0.6), transparent)",
        }}
      />

      {/* Corner brackets */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "12px",
          height: "12px",
          borderTop: "2px solid #00d4ff",
          borderLeft: "2px solid #00d4ff",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: "12px",
          height: "12px",
          borderTop: "2px solid #00d4ff",
          borderRight: "2px solid #00d4ff",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: "12px",
          height: "12px",
          borderBottom: "2px solid #00d4ff",
          borderLeft: "2px solid #00d4ff",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 0,
          right: 0,
          width: "12px",
          height: "12px",
          borderBottom: "2px solid #00d4ff",
          borderRight: "2px solid #00d4ff",
        }}
      />

      {/* Header bar */}
      <div
        className="flex items-center justify-between px-4 py-2 flex-shrink-0"
        style={{
          borderBottom: "1px solid rgba(0,212,255,0.15)",
          background: "rgba(0,212,255,0.04)",
        }}
      >
        <span
          style={{
            fontFamily: "Share Tech Mono",
            fontSize: "9px",
            letterSpacing: "0.2em",
            color: "rgba(0,212,255,0.5)",
            textTransform: "uppercase",
          }}
        >
          {selection.kind === "agent" ? "// AGENT LINK" : "// ROOM CHANNEL"}
        </span>
        <button
          onClick={() => setSelection(null)}
          style={{
            color: "rgba(0,212,255,0.4)",
            background: "none",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            padding: "2px",
            transition: "color 0.2s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "#00d4ff";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color =
              "rgba(0,212,255,0.4)";
          }}
        >
          <X size={14} />
        </button>
      </div>

      {selection.kind === "agent" && <DMPanel agentId={selection.id} />}
      {selection.kind === "room" && <RoomPanel roomId={selection.id} />}
    </aside>
  );
}
