import { useState, useCallback, useRef, useEffect } from "react";
import { useBusStore } from "../store/bus.js";
import { DMPanel } from "./DMPanel.js";
import { RoomPanel } from "./RoomPanel.js";
import { X } from "lucide-react";
import { GlassPanel } from "./primitives/GlassPanel.js";
import { FONT_MONO } from "../theme/tokens.js";

const MIN_W = 260;
const MAX_W = 560;

export function SidePanel() {
  const selection = useBusStore((s) => s.selection);
  const setSelection = useBusStore((s) => s.setSelection);
  const setSidePanelWidth = useBusStore((s) => s.setSidePanelWidth);
  const [width, setWidth] = useState(320);
  const startRef = useRef<{ mx: number; w: number } | null>(null);

  const isOpen = !!selection && selection.kind !== "pane";

  // Keep store in sync with actual visible width
  useEffect(() => {
    setSidePanelWidth(isOpen ? width : 0);
  }, [isOpen, width, setSidePanelWidth]);

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

  if (!isOpen) return null;

  return (
    <GlassPanel
      as="aside"
      background="rgba(0,8,22,0.52)"
      blur={22}
      saturate={160}
      className="flex flex-col"
      style={{
        position: "fixed",
        top: 48,
        right: 0,
        // Stop above the 28px status ticker so the compose/POST row isn't covered
        bottom: 28,
        width,
        zIndex: 50,
        borderLeft: "1px solid rgba(0,212,255,0.18)",
        boxShadow:
          "-2px 0 40px rgba(0,212,255,0.06), inset 1px 0 0 rgba(0,212,255,0.04)",
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
            fontFamily: FONT_MONO,
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
    </GlassPanel>
  );
}
