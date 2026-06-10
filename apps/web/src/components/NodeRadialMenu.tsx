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

// Geometry — INNER_R must contain the rendered 3D node sphere on screen
const INNER_R = 50; // hole radius around node
const OUTER_R = 145; // outer edge — must be large vs INNER_R to look like petals not ring
const GAP_DEG = 16; // wider gaps → true petal separation
const PAD = 18; // extra space around wheel
const HALF = OUTER_R + PAD;
const SIZE = HALF * 2;

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
  const x1 = cx + r2 * Math.cos(sr),
    y1 = cy + r2 * Math.sin(sr);
  const x2 = cx + r2 * Math.cos(er),
    y2 = cy + r2 * Math.sin(er);
  const x3 = cx + r1 * Math.cos(er),
    y3 = cy + r1 * Math.sin(er);
  const x4 = cx + r1 * Math.cos(sr),
    y4 = cy + r1 * Math.sin(sr);
  return [
    `M ${x1} ${y1}`,
    `A ${r2} ${r2} 0 ${largeArc} 1 ${x2} ${y2}`,
    `L ${x3} ${y3}`,
    `A ${r1} ${r1} 0 ${largeArc} 0 ${x4} ${y4}`,
    "Z",
  ].join(" ");
}

function sectorCenter(
  cx: number,
  cy: number,
  r1: number,
  r2: number,
  startDeg: number,
  endDeg: number
) {
  const mid = toRad((startDeg + endDeg) / 2);
  const r = r1 + (r2 - r1) * 0.58; // slightly toward outer edge
  return { x: cx + r * Math.cos(mid), y: cy + r * Math.sin(mid) };
}

interface SectorDef {
  label: string;
  icon: string;
  startDeg: number;
  endDeg: number;
  destructive?: boolean;
}

// Agent: 4 equal 90° sectors
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

// Room: 2 half-circle sectors
const ROOM_SECTORS: SectorDef[] = [
  { label: "OPEN\nROOM", icon: "◈", startDeg: -180, endDeg: 0 },
  { label: "ISOLATE\nFOCUS", icon: "◎", startDeg: 0, endDeg: 180 },
];

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

  // RAF: track node screen coords as camera animates.
  // graph2ScreenCoords returns coords relative to the canvas element, not the
  // viewport — add canvas getBoundingClientRect() to get correct fixed position.
  useEffect(() => {
    let raf: number;
    const tick = () => {
      const g = graphRef.current;
      if (g) {
        try {
          const sc = g.graph2ScreenCoords(
            node3D.x,
            node3D.y ?? 0,
            node3D.z ?? 0
          ) as { x: number; y: number };
          const canvas = g.renderer?.()?.domElement as HTMLElement | undefined;
          const rect = canvas?.getBoundingClientRect();
          setPos({
            x: (rect?.left ?? 0) + sc.x,
            y: (rect?.top ?? 0) + sc.y,
          });
        } catch {
          /* not yet mounted */
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [graphRef, node3D]);

  // Click-outside — delay 60 ms so the opening click doesn't self-close
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

  const findPane = (id: string) =>
    Object.values(panes).find((p) => p.agentId === id);

  const handleSector = (s: SectorDef) => {
    if (s.destructive) {
      setTeardownConfirm(true);
      return;
    }
    if (kind === "agent") {
      if (s.label.startsWith("OPEN")) {
        setSelection({ kind: "agent", id: nodeId });
        onClose();
      } else if (s.label.startsWith("SPAWN")) {
        const pane = findPane(nodeId);
        setLauncherPrefill({
          paneKind: "new-window",
          paneTarget: pane?.session,
        });
        setLauncherOpen(true);
        onClose();
      } else {
        onClose(); // ISOLATE
      }
    } else {
      if (s.label.startsWith("OPEN")) {
        setSelection({ kind: "room", id: nodeId });
        onClose();
      } else {
        onClose(); // ISOLATE
      }
    }
  };

  const handleTeardown = () => {
    const pane = findPane(nodeId);
    if (pane && agents[nodeId]) teardownAgent(nodeId, pane.id);
    onClose();
  };

  if (!pos) return null;

  const sectors = kind === "agent" ? AGENT_SECTORS : ROOM_SECTORS;
  const accentRgb = kind === "agent" ? "0,212,255" : "176,144,255";

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
      {/* Wheel container — centered on node */}
      <div
        style={{
          position: "absolute",
          width: SIZE,
          height: SIZE,
          transform: "translate(-50%, -50%)",
          pointerEvents: "all",
        }}
      >
        {/*
         * Glass backdrop disc — HTML element required for backdrop-filter;
         * SVG elements do not support it in any browser.
         * inset: PAD aligns this div exactly with the outer SVG circle.
         */}
        {/*
         * Very faint outer glow ring — no solid background so sector gaps
         * show the live 3D graph scene (true hollow petal separation).
         * Each sector carries its own fill opacity instead.
         */}
        <div
          style={{
            position: "absolute",
            inset: PAD,
            borderRadius: "50%",
            boxShadow: `0 0 60px rgba(${accentRgb},0.12)`,
            pointerEvents: "none",
          }}
        />

        {/* SVG — sectors, rings */}
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          style={{ position: "absolute", inset: 0, overflow: "visible" }}
        >
          {sectors.map((sector, i) => {
            const hovered = hoveredIdx === i;
            const destr = !!sector.destructive;
            const rgb = destr ? "255,70,70" : accentRgb;
            const fillOpacity = hovered ? 0.45 : 0.22;
            const strokeOpacity = hovered ? 0.95 : 0.55;
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
            const midDeg = (sector.startDeg + sector.endDeg) / 2;
            const nudge = hovered ? 5 : 0;
            const nudgeRad = toRad(midDeg);
            const nx = Math.cos(nudgeRad) * nudge;
            const ny = Math.sin(nudgeRad) * nudge;
            const lines = sector.label.split("\n");

            return (
              <g
                key={sector.label}
                transform={`translate(${nx},${ny})`}
                style={{ cursor: "pointer" }}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                onClick={() => handleSector(sector)}
              >
                <path
                  d={path}
                  fill={`rgba(${rgb},${fillOpacity})`}
                  stroke={`rgba(${rgb},${strokeOpacity})`}
                  strokeWidth={hovered ? 2 : 1.2}
                  style={{ transition: "fill 0.15s, stroke 0.15s" }}
                />
                {/* Icon */}
                <text
                  x={center.x}
                  y={center.y - (lines.length > 1 ? 15 : 7)}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="20"
                  fill={`rgba(${rgb},${hovered ? 1 : 0.75})`}
                  fontFamily="Share Tech Mono, monospace"
                  style={{
                    pointerEvents: "none",
                    transition: "fill 0.15s",
                    userSelect: "none",
                  }}
                >
                  {sector.icon}
                </text>
                {/* Label */}
                {lines.map((line, li) => (
                  <text
                    key={li}
                    x={center.x}
                    y={center.y + 8 + li * 13}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="10"
                    letterSpacing="0.1em"
                    fill={`rgba(${rgb},${hovered ? 1 : 0.65})`}
                    fontFamily="Share Tech Mono, monospace"
                    style={{
                      pointerEvents: "none",
                      transition: "fill 0.15s",
                      userSelect: "none",
                    }}
                  >
                    {line}
                  </text>
                ))}
              </g>
            );
          })}

          {/* Outer ring */}
          <circle
            cx={HALF}
            cy={HALF}
            r={OUTER_R}
            fill="none"
            stroke={`rgba(${accentRgb},0.18)`}
            strokeWidth="1"
          />

          {/* Inner ring border — no fill so Three.js node shows through */}
          <circle
            cx={HALF}
            cy={HALF}
            r={INNER_R}
            fill="none"
            stroke={`rgba(${accentRgb},0.45)`}
            strokeWidth="1.5"
          />
          {/* Subtle inner accent ring */}
          <circle
            cx={HALF}
            cy={HALF}
            r={INNER_R - 6}
            fill="none"
            stroke={`rgba(${accentRgb},0.12)`}
            strokeWidth="1.5"
          />
        </svg>

        {/* Teardown confirm overlay */}
        {teardownConfirm && (
          <div
            style={{
              position: "absolute",
              inset: PAD,
              borderRadius: "50%",
              backdropFilter: "blur(18px)",
              WebkitBackdropFilter: "blur(18px)",
              background: "rgba(8,3,12,0.85)",
              border: "1px solid rgba(255,70,70,0.4)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
            }}
          >
            <div
              style={{
                fontFamily: "Share Tech Mono",
                fontSize: 9,
                letterSpacing: "0.12em",
                color: "#ff7070",
                textAlign: "center",
                lineHeight: 1.8,
              }}
            >
              TEAR DOWN
              <br />
              <span style={{ color: "rgba(255,112,112,0.55)", fontSize: 8 }}>
                {nodeId}
              </span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={handleTeardown} style={confirmStyle}>
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
  border: "1px solid rgba(255,70,70,0.55)",
  background: "rgba(255,70,70,0.15)",
  color: "#ff7070",
};

const cancelStyle: React.CSSProperties = {
  fontFamily: "Share Tech Mono, monospace",
  fontSize: 8,
  letterSpacing: "0.1em",
  padding: "4px 10px",
  cursor: "pointer",
  border: "1px solid rgba(0,212,255,0.28)",
  background: "rgba(0,212,255,0.05)",
  color: "rgba(0,212,255,0.7)",
};
