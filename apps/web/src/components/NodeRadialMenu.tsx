import { useEffect, useRef, useState } from "react";
import { useBusStore } from "../store/bus.js";

interface Props {
  nodeId: string;
  kind: "agent" | "room";
  node3D: { x: number; y: number; z: number };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  graphRef: React.RefObject<any>;
  onClose: () => void;
}

interface ScreenPos {
  x: number;
  y: number;
}

// Geometry
const INNER_R = 28; // hole radius around node
const OUTER_R = 90; // outer edge of sectors
const GAP_DEG = 4; // angular gap between sectors
const PAD = 14; // extra padding around wheel
const HALF = OUTER_R + PAD;
const SIZE = HALF * 2;

const ACCENT = "#00d4ff";
const ROOM_ACCENT = "#b090ff";

// ─── SVG helpers ─────────────────────────────────────────────────────────────

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

function sectorPath(
  cx: number,
  cy: number,
  r1: number,
  r2: number,
  startDeg: number,
  endDeg: number
): string {
  const s = startDeg + GAP_DEG / 2;
  const e = endDeg - GAP_DEG / 2;
  const sr = toRad(s);
  const er = toRad(e);
  const largeArc = e - s > 180 ? 1 : 0;

  const x1 = cx + r2 * Math.cos(sr);
  const y1 = cy + r2 * Math.sin(sr);
  const x2 = cx + r2 * Math.cos(er);
  const y2 = cy + r2 * Math.sin(er);
  const x3 = cx + r1 * Math.cos(er);
  const y3 = cy + r1 * Math.sin(er);
  const x4 = cx + r1 * Math.cos(sr);
  const y4 = cy + r1 * Math.sin(sr);

  return [
    `M ${x1} ${y1}`,
    `A ${r2} ${r2} 0 ${largeArc} 1 ${x2} ${y2}`,
    `L ${x3} ${y3}`,
    `A ${r1} ${r1} 0 ${largeArc} 0 ${x4} ${y4}`,
    "Z",
  ].join(" ");
}

/** Center point of a sector in polar → cartesian */
function sectorCenter(
  cx: number,
  cy: number,
  r1: number,
  r2: number,
  startDeg: number,
  endDeg: number
): { x: number; y: number } {
  const mid = toRad((startDeg + endDeg) / 2);
  const r = (r1 + r2) / 2;
  return { x: cx + r * Math.cos(mid), y: cy + r * Math.sin(mid) };
}

// ─── Button definitions ───────────────────────────────────────────────────────

interface SectorDef {
  label: string;
  icon: string;
  startDeg: number;
  endDeg: number;
  destructive?: boolean;
}

// 4-way agent wheel: top / right / bottom / left
const AGENT_SECTORS: SectorDef[] = [
  { label: "SPAWN\nCOMPANION", icon: "⊕", startDeg: -135, endDeg: -45 },
  { label: "OPEN DM", icon: "✉", startDeg: -45, endDeg: 45 },
  { label: "ISOLATE\nFOCUS", icon: "◎", startDeg: 45, endDeg: 135 },
  {
    label: "TEAR\nDOWN",
    icon: "✕",
    startDeg: 135,
    endDeg: 225,
    destructive: true,
  },
];

// 2-way room wheel: left / right
const ROOM_SECTORS: SectorDef[] = [
  { label: "OPEN\nROOM", icon: "◈", startDeg: -180, endDeg: 0 },
  { label: "ISOLATE\nFOCUS", icon: "◎", startDeg: 0, endDeg: 180 },
];

// ─── Component ───────────────────────────────────────────────────────────────

export function NodeRadialMenu({
  nodeId,
  kind,
  node3D,
  graphRef,
  onClose,
}: Props) {
  const [pos, setPos] = useState<ScreenPos | null>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [teardownConfirm, setTeardownConfirm] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const agents = useBusStore((s) => s.agents);
  const panes = useBusStore((s) => s.panes);
  const setSelection = useBusStore((s) => s.setSelection);
  const teardownAgent = useBusStore((s) => s.teardownAgent);
  const setLauncherOpen = useBusStore((s) => s.setLauncherOpen);
  const setLauncherPrefill = useBusStore((s) => s.setLauncherPrefill);

  // RAF loop — track node's screen position as camera animates
  useEffect(() => {
    let rafId: number;
    const update = () => {
      const g = graphRef.current;
      if (g) {
        try {
          const sc = g.graph2ScreenCoords(
            node3D.x,
            node3D.y ?? 0,
            node3D.z ?? 0
          ) as { x: number; y: number };
          setPos(sc);
        } catch {
          // ignore
        }
      }
      rafId = requestAnimationFrame(update);
    };
    rafId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafId);
  }, [graphRef, node3D]);

  // Click-outside: delay so the opening double-click doesn't immediately close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const tid = setTimeout(
      () => document.addEventListener("mousedown", handler),
      60
    );
    return () => {
      clearTimeout(tid);
      document.removeEventListener("mousedown", handler);
    };
  }, [onClose]);

  const findPaneForAgent = (id: string) =>
    Object.values(panes).find((p) => p.agentId === id);

  const handleSector = (sector: SectorDef) => {
    if (sector.destructive) {
      setTeardownConfirm(true);
      return;
    }
    if (kind === "agent") {
      if (sector.label.startsWith("OPEN")) {
        setSelection({ kind: "agent", id: nodeId });
        onClose();
      } else if (sector.label.startsWith("ISOLATE")) {
        onClose();
      } else if (sector.label.startsWith("SPAWN")) {
        const pane = findPaneForAgent(nodeId);
        setLauncherPrefill({
          paneKind: "new-window",
          paneTarget: pane?.session,
        });
        setLauncherOpen(true);
        onClose();
      }
    } else {
      if (sector.label.startsWith("OPEN")) {
        setSelection({ kind: "room", id: nodeId });
        onClose();
      } else {
        onClose(); // ISOLATE: focus-lock already active
      }
    }
  };

  const handleTeardownConfirm = () => {
    const pane = findPaneForAgent(nodeId);
    if (pane && agents[nodeId]) teardownAgent(nodeId, pane.id);
    onClose();
  };

  if (!pos) return null;

  const sectors = kind === "agent" ? AGENT_SECTORS : ROOM_SECTORS;
  const accent = kind === "agent" ? ACCENT : ROOM_ACCENT;

  return (
    <div
      ref={menuRef}
      style={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        width: 0,
        height: 0,
        zIndex: 500,
        pointerEvents: "none",
      }}
    >
      {/* Wheel — centered on node */}
      <div
        style={{
          position: "absolute",
          width: SIZE,
          height: SIZE,
          transform: "translate(-50%, -50%)",
          pointerEvents: "all",
        }}
      >
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          style={{ overflow: "visible" }}
        >
          <defs>
            <filter
              id="wheel-blur"
              x="-20%"
              y="-20%"
              width="140%"
              height="140%"
            >
              <feGaussianBlur in="SourceGraphic" stdDeviation="0.8" />
            </filter>
          </defs>

          {/* Background disc (glassmorphism effect via fill opacity) */}
          <circle
            cx={HALF}
            cy={HALF}
            r={OUTER_R + 2}
            fill="rgba(0,8,20,0.72)"
            style={{ backdropFilter: "blur(12px)" }}
          />

          {/* Sectors */}
          {sectors.map((sector, i) => {
            const isHovered = hoveredIdx === i;
            const isDestructive = !!sector.destructive;
            const fill = isDestructive
              ? isHovered
                ? "rgba(255,70,70,0.28)"
                : "rgba(255,70,70,0.10)"
              : isHovered
                ? `rgba(${kind === "agent" ? "0,212,255" : "176,144,255"},0.22)`
                : `rgba(${kind === "agent" ? "0,212,255" : "176,144,255"},0.07)`;
            const stroke = isDestructive
              ? isHovered
                ? "rgba(255,70,70,0.7)"
                : "rgba(255,70,70,0.25)"
              : isHovered
                ? `${accent}cc`
                : `${accent}33`;

            const path = sectorPath(
              HALF,
              HALF,
              INNER_R,
              OUTER_R,
              sector.startDeg,
              sector.endDeg
            );
            const center = sectorCenter(
              HALF,
              HALF,
              INNER_R,
              OUTER_R,
              sector.startDeg,
              sector.endDeg
            );
            const midAngle = (sector.startDeg + sector.endDeg) / 2;
            const nudge = isHovered ? 4 : 0;
            const nudgeRad = toRad(midAngle);
            const nx = Math.cos(nudgeRad) * nudge;
            const ny = Math.sin(nudgeRad) * nudge;

            const lines = sector.label.split("\n");

            return (
              <g
                key={sector.label}
                style={{ cursor: "pointer" }}
                transform={`translate(${nx},${ny})`}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                onClick={() => handleSector(sector)}
              >
                <path
                  d={path}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={isHovered ? 1.5 : 1}
                  style={{ transition: "fill 0.12s, stroke 0.12s" }}
                />
                {/* Icon */}
                <text
                  x={center.x}
                  y={center.y - (lines.length > 1 ? 10 : 6)}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="16"
                  fill={
                    isDestructive
                      ? isHovered
                        ? "#ff7070"
                        : "#ff504088"
                      : isHovered
                        ? accent
                        : `${accent}99`
                  }
                  style={{
                    fontFamily: "Share Tech Mono, monospace",
                    pointerEvents: "none",
                    transition: "fill 0.12s",
                  }}
                >
                  {sector.icon}
                </text>
                {/* Label lines */}
                {lines.map((line, li) => (
                  <text
                    key={li}
                    x={center.x}
                    y={center.y + 4 + li * 11}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="8"
                    letterSpacing="0.08em"
                    fill={
                      isDestructive
                        ? isHovered
                          ? "#ff7070"
                          : "#ff504077"
                        : isHovered
                          ? accent
                          : `${accent}77`
                    }
                    style={{
                      fontFamily: "Share Tech Mono, monospace",
                      pointerEvents: "none",
                      transition: "fill 0.12s",
                    }}
                  >
                    {line}
                  </text>
                ))}
              </g>
            );
          })}

          {/* Center hole ring */}
          <circle
            cx={HALF}
            cy={HALF}
            r={INNER_R - 1}
            fill="rgba(0,6,16,0.90)"
            stroke={`${accent}44`}
            strokeWidth="1"
          />
          {/* Inner accent ring */}
          <circle
            cx={HALF}
            cy={HALF}
            r={INNER_R - 5}
            fill="none"
            stroke={`${accent}22`}
            strokeWidth="2"
          />
        </svg>

        {/* Teardown confirm overlay — replaces wheel when active */}
        {teardownConfirm && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              background: "rgba(0,6,16,0.88)",
              borderRadius: "50%",
              backdropFilter: "blur(10px)",
              border: "1px solid rgba(255,70,70,0.4)",
            }}
          >
            <div
              style={{
                fontFamily: "Share Tech Mono",
                fontSize: 9,
                letterSpacing: "0.1em",
                color: "#ff7070",
                textAlign: "center",
              }}
            >
              TEAR DOWN
              <br />
              <span style={{ color: "rgba(255,112,112,0.6)", fontSize: 8 }}>
                {nodeId}
              </span>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={handleTeardownConfirm} style={confirmStyle}>
                CONFIRM
              </button>
              <button
                onClick={() => setTeardownConfirm(false)}
                style={cancelStyle}
              >
                CANCEL
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const confirmStyle: React.CSSProperties = {
  fontFamily: "Share Tech Mono, monospace",
  fontSize: 8,
  letterSpacing: "0.1em",
  padding: "4px 10px",
  cursor: "pointer",
  border: "1px solid rgba(255,70,70,0.6)",
  background: "rgba(255,70,70,0.18)",
  color: "#ff7070",
  pointerEvents: "all",
};

const cancelStyle: React.CSSProperties = {
  fontFamily: "Share Tech Mono, monospace",
  fontSize: 8,
  letterSpacing: "0.1em",
  padding: "4px 10px",
  cursor: "pointer",
  border: "1px solid rgba(0,212,255,0.3)",
  background: "rgba(0,212,255,0.06)",
  color: "rgba(0,212,255,0.7)",
  pointerEvents: "all",
};
