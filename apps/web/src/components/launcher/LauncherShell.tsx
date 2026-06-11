import type { ReactNode } from "react";
import { GlassPanel } from "../primitives/GlassPanel.js";

export function LauncherShell({
  onClose,
  children,
}: {
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <GlassPanel
      background="rgba(0,8,22,0.55)"
      blur={20}
      saturate={180}
      cornerBrackets
      style={{
        position: "fixed",
        top: 64,
        right: 16,
        width: 320,
        maxHeight: "calc(100vh - 96px)",
        overflowY: "auto",
        zIndex: 200,
        display: "flex",
        flexDirection: "column",
        border: "1px solid rgba(0,212,255,0.2)",
        animation: "border-glow 3s ease-in-out infinite",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 12px",
          borderBottom: "1px solid rgba(0,212,255,0.15)",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: "Orbitron, sans-serif",
            fontWeight: 700,
            fontSize: 10,
            letterSpacing: "0.2em",
            color: "#00d4ff",
            textShadow: "0 0 10px rgba(0,212,255,0.6)",
          }}
        >
          ◈ AGENT LAUNCHER
        </span>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "rgba(0,212,255,0.5)",
            fontFamily: "Share Tech Mono",
            fontSize: 14,
            lineHeight: 1,
            padding: "2px 4px",
          }}
        >
          ×
        </button>
      </div>
      {children}
    </GlassPanel>
  );
}
