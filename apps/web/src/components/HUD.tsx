import { useState, useRef, useEffect, useMemo } from "react";
import { useBusStore } from "../store/bus.js";

export function HUD() {
  const agentsMap = useBusStore((s) => s.agents);
  const roomsMap = useBusStore((s) => s.rooms);
  const nameFilter = useBusStore((s) => s.nameFilter);
  const setNameFilter = useBusStore((s) => s.setNameFilter);
  const agents = Object.values(agentsMap);
  const rooms = Object.values(roomsMap);
  const active = agents.filter((a) => a.status === "active").length;
  const idle = agents.filter((a) => a.status === "idle").length;
  const stale = agents.filter((a) => a.status === "stale").length;
  const total = agents.length || 1;

  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const suggestions = nameFilter.trim()
    ? rooms.filter((r) => r.id.toLowerCase().includes(nameFilter.toLowerCase()))
    : rooms;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <header
      className="flex-shrink-0 relative"
      style={{
        height: "56px",
        background:
          "linear-gradient(90deg, rgba(0,8,20,0.98) 0%, rgba(0,15,35,0.95) 100%)",
        borderBottom: "1px solid rgba(0,212,255,0.3)",
        boxShadow:
          "0 1px 20px rgba(0,212,255,0.15), inset 0 -1px 0 rgba(0,212,255,0.1)",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "1px",
          background:
            "linear-gradient(90deg, transparent, #00d4ff 20%, #00d4ff 80%, transparent)",
          opacity: 0.6,
        }}
      />

      <div className="flex items-center h-full px-4 gap-5">
        {/* Logo */}
        <div className="flex items-center gap-2 mr-2 flex-shrink-0">
          <span
            style={{
              color: "rgba(0,212,255,0.5)",
              fontFamily: "Share Tech Mono",
              fontSize: "14px",
            }}
          >
            [
          </span>
          <div>
            <div
              style={{
                fontFamily: "Orbitron, sans-serif",
                fontWeight: 700,
                fontSize: "11px",
                letterSpacing: "0.2em",
                color: "#00d4ff",
                textShadow: "0 0 12px rgba(0,212,255,0.8)",
                lineHeight: 1,
              }}
            >
              NEXUS
            </div>
            <div
              style={{
                fontFamily: "Share Tech Mono",
                fontSize: "8px",
                letterSpacing: "0.25em",
                color: "rgba(0,212,255,0.45)",
                lineHeight: 1,
                marginTop: "2px",
              }}
            >
              AGENT COORD MATRIX
            </div>
          </div>
          <span
            style={{
              color: "rgba(0,212,255,0.5)",
              fontFamily: "Share Tech Mono",
              fontSize: "14px",
            }}
          >
            ]
          </span>
        </div>

        <div
          style={{
            width: "1px",
            height: "32px",
            background: "rgba(0,212,255,0.2)",
            flexShrink: 0,
          }}
        />

        {/* Arc gauges */}
        <div className="flex items-center gap-4 flex-shrink-0">
          <ArcGauge
            label="ACTIVE"
            value={active}
            total={total}
            color="#00ff88"
            glowColor="rgba(0,255,136,0.6)"
          />
          <ArcGauge
            label="IDLE"
            value={idle}
            total={total}
            color="#ff8c00"
            glowColor="rgba(255,140,0,0.6)"
          />
          <ArcGauge
            label="STALE"
            value={stale}
            total={total}
            color="#ff8c00"
            glowColor="rgba(255,140,0,0.4)"
          />
          <ArcGauge
            label="ROOMS"
            value={rooms.length}
            total={Math.max(rooms.length, 1)}
            color="#7b6fff"
            glowColor="rgba(123,111,255,0.6)"
          />
        </div>

        <div
          style={{
            width: "1px",
            height: "32px",
            background: "rgba(0,212,255,0.2)",
            flexShrink: 0,
          }}
        />

        {/* Filter */}
        <div
          className="flex items-center gap-2 flex-1"
          style={{ maxWidth: "260px" }}
        >
          <span
            style={{
              fontFamily: "Share Tech Mono",
              fontSize: "9px",
              letterSpacing: "0.15em",
              color: "rgba(0,212,255,0.4)",
              flexShrink: 0,
            }}
          >
            FILTER
          </span>
          <div ref={wrapRef} style={{ position: "relative", flex: 1 }}>
            <input
              className="holo-input"
              style={{
                width: "100%",
                padding: "3px 24px 3px 8px",
                fontSize: "11px",
              }}
              placeholder="agent or room…"
              value={nameFilter}
              onChange={(e) => {
                setNameFilter(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
            />
            {nameFilter ? (
              <button
                onClick={() => {
                  setNameFilter("");
                  setOpen(false);
                }}
                style={{
                  position: "absolute",
                  right: "6px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "rgba(0,212,255,0.5)",
                  fontFamily: "Share Tech Mono",
                  fontSize: "11px",
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            ) : (
              <span
                style={{
                  position: "absolute",
                  right: "7px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "rgba(0,212,255,0.3)",
                  fontSize: "9px",
                  pointerEvents: "none",
                }}
              >
                ▾
              </span>
            )}

            {open && suggestions.length > 0 && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  left: 0,
                  right: 0,
                  background: "rgba(0,8,22,0.97)",
                  border: "1px solid rgba(0,212,255,0.35)",
                  boxShadow:
                    "0 4px 24px rgba(0,212,255,0.15), inset 0 0 0 1px rgba(0,212,255,0.05)",
                  zIndex: 9999,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "1px",
                    background:
                      "linear-gradient(90deg, transparent, rgba(0,212,255,0.5), transparent)",
                  }}
                />
                {suggestions.map((r) => (
                  <button
                    key={r.id}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setNameFilter(r.id);
                      setOpen(false);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      width: "100%",
                      padding: "6px 10px",
                      background: "none",
                      border: "none",
                      borderBottom: "1px solid rgba(0,212,255,0.07)",
                      cursor: "pointer",
                      textAlign: "left",
                      fontFamily: "Share Tech Mono",
                      fontSize: "11px",
                      color: "rgba(0,212,255,0.85)",
                      letterSpacing: "0.06em",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background =
                        "rgba(0,212,255,0.08)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background =
                        "none";
                    }}
                  >
                    <span
                      style={{
                        color: "rgba(123,111,255,0.7)",
                        fontSize: "9px",
                      }}
                    >
                      ◈
                    </span>
                    {r.id}
                    <span
                      style={{
                        marginLeft: "auto",
                        fontSize: "9px",
                        color: "rgba(0,212,255,0.3)",
                        letterSpacing: "0.1em",
                      }}
                    >
                      {r.members.length} MBR
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right side hint */}
        <div
          className="ml-auto flex items-center gap-3 flex-shrink-0"
          style={{
            fontFamily: "Share Tech Mono",
            fontSize: "10px",
            color: "rgba(0,212,255,0.3)",
            letterSpacing: "0.08em",
          }}
        >
          <span>
            SYS: <span style={{ color: "#00ff88" }}>NOMINAL</span>
          </span>
          <span style={{ color: "rgba(0,212,255,0.15)" }}>|</span>
          <span>CLICK · SELECT &nbsp; DBL-CLICK · FOCUS</span>
        </div>
      </div>
    </header>
  );
}

// Arc gauge — 270° sweep, tick marks, glowing dot at tip
function ArcGauge({
  label,
  value,
  total,
  color,
  glowColor,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
  glowColor: string;
}) {
  const size = 44;
  const cx = size / 2;
  const cy = size / 2;
  const r = 17;
  const strokeW = 3;

  // 270° arc: starts at 135° (bottom-left), sweeps clockwise to 45° (bottom-right)
  const startAngle = 135;
  const sweepAngle = 270;
  const ratio = Math.min(value / total, 1);
  const filledAngle = sweepAngle * ratio;

  const filterId = useMemo(() => `glow-${label.toLowerCase()}`, [label]);

  function polarToXY(angleDeg: number, radius: number) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  }

  function describeArc(start: number, sweep: number, radius: number) {
    if (sweep <= 0) return "";
    const clamped = Math.min(sweep, 359.99);
    const end = start + clamped;
    const s = polarToXY(start, radius);
    const e = polarToXY(end, radius);
    const large = clamped > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${large} 1 ${e.x} ${e.y}`;
  }

  // Tick marks: 8 evenly spaced around the 270° arc
  const ticks = useMemo(() => {
    const n = 8;
    return Array.from({ length: n + 1 }, (_, i) => {
      const angle = startAngle + (sweepAngle / n) * i;
      const inner = polarToXY(angle, r - 5);
      const outer = polarToXY(angle, r - 2);
      return { inner, outer, angle };
    });
  }, []);

  const tipPos =
    filledAngle > 2 ? polarToXY(startAngle + filledAngle, r) : null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "1px",
      }}
    >
      <svg width={size} height={size} style={{ overflow: "visible" }}>
        <defs>
          <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Track */}
        <path
          d={describeArc(startAngle, sweepAngle, r)}
          fill="none"
          stroke="rgba(0,212,255,0.1)"
          strokeWidth={strokeW}
          strokeLinecap="round"
        />

        {/* Tick marks */}
        {ticks.map((t, i) => (
          <line
            key={i}
            x1={t.inner.x}
            y1={t.inner.y}
            x2={t.outer.x}
            y2={t.outer.y}
            stroke="rgba(0,212,255,0.2)"
            strokeWidth={1}
          />
        ))}

        {/* Fill arc */}
        {filledAngle > 0.5 && (
          <path
            d={describeArc(startAngle, filledAngle, r)}
            fill="none"
            stroke={color}
            strokeWidth={strokeW}
            strokeLinecap="round"
            filter={`url(#${filterId})`}
            style={{ opacity: 0.9 }}
          />
        )}

        {/* Glowing dot at tip */}
        {tipPos && (
          <>
            <circle
              cx={tipPos.x}
              cy={tipPos.y}
              r={4}
              fill={glowColor}
              style={{ filter: `drop-shadow(0 0 4px ${color})` }}
            />
            <circle cx={tipPos.x} cy={tipPos.y} r={2} fill={color} />
          </>
        )}

        {/* Center value */}
        <text
          x={cx}
          y={cy + 1}
          textAnchor="middle"
          dominantBaseline="middle"
          style={{
            fontFamily: "Orbitron, sans-serif",
            fontSize: "11px",
            fontWeight: 700,
            fill: color,
            filter: `drop-shadow(0 0 6px ${color})`,
          }}
        >
          {value}
        </text>
      </svg>

      <span
        style={{
          fontFamily: "Share Tech Mono",
          fontSize: "8px",
          letterSpacing: "0.18em",
          color: "rgba(0,212,255,0.4)",
          lineHeight: 1,
        }}
      >
        {label}
      </span>
    </div>
  );
}
