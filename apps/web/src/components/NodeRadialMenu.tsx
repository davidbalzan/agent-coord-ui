import { useEffect, useRef, useState } from "react";
import { useBusStore } from "../store/bus.js";
import { FONT_MONO } from "../theme/tokens.js";

interface Props {
  nodeId: string;
  kind: "agent" | "room";
  node3D: { x: number; y: number; z: number };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  graphRef: React.RefObject<any>;
  onClose: () => void;
  // Closes menu but keeps camera + dim state — click background to restore
  onIsolate: () => void;
}

interface ScreenPos {
  x: number;
  y: number;
}

const INNER_R = 50;
const OUTER_R = 148;
const GAP_DEG = 16;
const CORNER_R = 10; // petal corner rounding radius
const PAD = 20;
const HALF = OUTER_R + PAD;
const SIZE = HALF * 2;

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

// Arc sector path with bezier-rounded corners
function roundedSectorPath(
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
  const cr = CORNER_R;

  // The 4 sharp corners of the wedge
  const os = { x: cx + r2 * Math.cos(sr), y: cy + r2 * Math.sin(sr) };
  const oe = { x: cx + r2 * Math.cos(er), y: cy + r2 * Math.sin(er) };
  const ie = { x: cx + r1 * Math.cos(er), y: cy + r1 * Math.sin(er) };
  const is_ = { x: cx + r1 * Math.cos(sr), y: cy + r1 * Math.sin(sr) };

  // Inset points — stepping back cr along each adjacent edge before each corner
  const acr2 = cr / r2; // angular offset at outer radius
  const acr1 = cr / r1; // angular offset at inner radius

  const os_r = {
    x: cx + (r2 - cr) * Math.cos(sr),
    y: cy + (r2 - cr) * Math.sin(sr),
  };
  const os_a = {
    x: cx + r2 * Math.cos(sr + acr2),
    y: cy + r2 * Math.sin(sr + acr2),
  };

  const oe_a = {
    x: cx + r2 * Math.cos(er - acr2),
    y: cy + r2 * Math.sin(er - acr2),
  };
  const oe_r = {
    x: cx + (r2 - cr) * Math.cos(er),
    y: cy + (r2 - cr) * Math.sin(er),
  };

  const ie_r = {
    x: cx + (r1 + cr) * Math.cos(er),
    y: cy + (r1 + cr) * Math.sin(er),
  };
  const ie_a = {
    x: cx + r1 * Math.cos(er - acr1),
    y: cy + r1 * Math.sin(er - acr1),
  };

  const is_a = {
    x: cx + r1 * Math.cos(sr + acr1),
    y: cy + r1 * Math.sin(sr + acr1),
  };
  const is_r = {
    x: cx + (r1 + cr) * Math.cos(sr),
    y: cy + (r1 + cr) * Math.sin(sr),
  };

  const largeArc = e - s > 180 ? 1 : 0;

  return [
    `M ${os_r.x} ${os_r.y}`,
    `Q ${os.x} ${os.y} ${os_a.x} ${os_a.y}`,
    `A ${r2} ${r2} 0 ${largeArc} 1 ${oe_a.x} ${oe_a.y}`,
    `Q ${oe.x} ${oe.y} ${oe_r.x} ${oe_r.y}`,
    `L ${ie_r.x} ${ie_r.y}`,
    `Q ${ie.x} ${ie.y} ${ie_a.x} ${ie_a.y}`,
    `A ${r1} ${r1} 0 ${largeArc} 0 ${is_a.x} ${is_a.y}`,
    `Q ${is_.x} ${is_.y} ${is_r.x} ${is_r.y}`,
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
  const r = r1 + (r2 - r1) * 0.56;
  return { x: cx + r * Math.cos(mid), y: cy + r * Math.sin(mid) };
}

interface SectorDef {
  label: string;
  icon: string;
  startDeg: number;
  endDeg: number;
  destructive?: boolean;
}

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
  onIsolate,
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
  const setNameFilter = useBusStore((s) => s.setNameFilter);

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
        // ISOLATE FOCUS — keep camera + dim, just close the menu
        onIsolate();
      }
    } else {
      if (s.label.startsWith("OPEN")) {
        setSelection({ kind: "room", id: nodeId });
        onClose();
      } else {
        // ISOLATE FOCUS for room — set top filter to this room, zoom back out
        setNameFilter(nodeId);
        onClose();
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
         * One HTML div per petal — backdrop-filter only works on HTML elements.
         * Each div is clipped to the rounded wedge shape so it gets an
         * independent frosted-glass look. pointer-events:none here; SVG above handles events.
         */}
        {sectors.map((sector, i) => {
          const destr = !!sector.destructive;
          const hovered = hoveredIdx === i;
          const path = roundedSectorPath(
            HALF,
            HALF,
            INNER_R,
            OUTER_R,
            sector.startDeg,
            sector.endDeg
          );
          const midDeg = (sector.startDeg + sector.endDeg) / 2;
          const nudge = hovered ? 5 : 0;
          const nx = Math.cos(toRad(midDeg)) * nudge;
          const ny = Math.sin(toRad(midDeg)) * nudge;

          return (
            <div
              key={`glass-${sector.label}`}
              style={{
                position: "absolute",
                width: SIZE,
                height: SIZE,
                transform: `translate(${nx}px, ${ny}px)`,
                backdropFilter: "blur(14px) saturate(1.6)",
                WebkitBackdropFilter: "blur(14px) saturate(1.6)",
                background: destr
                  ? `rgba(50,6,6,${hovered ? 0.72 : 0.52})`
                  : `rgba(4,14,36,${hovered ? 0.68 : 0.48})`,
                clipPath: `path("${path}")`,
                transition: "background 0.15s, transform 0.15s",
                pointerEvents: "none",
              }}
            />
          );
        })}

        {/* SVG — strokes, glow borders, text/icons, inner ring. No fills (handled above). */}
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
            const path = roundedSectorPath(
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
            const nx = Math.cos(toRad(midDeg)) * nudge;
            const ny = Math.sin(toRad(midDeg)) * nudge;
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
                {/* Stroke border only — fill handled by glass HTML div */}
                <path
                  d={path}
                  fill="none"
                  stroke={`rgba(${rgb},${hovered ? 0.9 : 0.4})`}
                  strokeWidth={hovered ? 1.5 : 0.8}
                  style={{ transition: "stroke 0.15s" }}
                />
                {/* Hit area (transparent, wider than stroke for easy clicking) */}
                <path d={path} fill="transparent" stroke="none" />

                {/* Icon */}
                <text
                  x={center.x}
                  y={center.y - (lines.length > 1 ? 15 : 7)}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="20"
                  fill={`rgba(${rgb},${hovered ? 1 : 0.75})`}
                  fontFamily={FONT_MONO}
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
                    fontFamily={FONT_MONO}
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

          {/* Inner ring — accent border around the node hole */}
          <circle
            cx={HALF}
            cy={HALF}
            r={INNER_R}
            fill="none"
            stroke={`rgba(${accentRgb},0.5)`}
            strokeWidth="1.5"
          />
          <circle
            cx={HALF}
            cy={HALF}
            r={INNER_R - 6}
            fill="none"
            stroke={`rgba(${accentRgb},0.15)`}
            strokeWidth="1"
          />
        </svg>

        {/* Teardown confirm overlay */}
        {teardownConfirm && (
          <div
            style={{
              position: "absolute",
              left: HALF - OUTER_R,
              top: HALF - OUTER_R,
              width: OUTER_R * 2,
              height: OUTER_R * 2,
              borderRadius: "50%",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              background: "rgba(10,2,12,0.88)",
              border: "1px solid rgba(255,70,70,0.4)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
            }}
          >
            <div
              style={{
                fontFamily: FONT_MONO,
                fontSize: 10,
                letterSpacing: "0.12em",
                color: "#ff7070",
                textAlign: "center",
                lineHeight: 1.8,
              }}
            >
              TEAR DOWN
              <br />
              <span style={{ color: "rgba(255,112,112,0.55)", fontSize: 9 }}>
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
  fontFamily: FONT_MONO,
  fontSize: 9,
  letterSpacing: "0.1em",
  padding: "5px 12px",
  cursor: "pointer",
  border: "1px solid rgba(255,70,70,0.55)",
  background: "rgba(255,70,70,0.15)",
  color: "#ff7070",
};

const cancelStyle: React.CSSProperties = {
  fontFamily: FONT_MONO,
  fontSize: 9,
  letterSpacing: "0.1em",
  padding: "5px 12px",
  cursor: "pointer",
  border: "1px solid rgba(0,212,255,0.28)",
  background: "rgba(0,212,255,0.05)",
  color: "rgba(0,212,255,0.7)",
};
