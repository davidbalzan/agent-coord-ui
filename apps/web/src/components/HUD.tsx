import { useState, useRef, useEffect } from "react";
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

  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const suggestions = nameFilter.trim()
    ? rooms.filter((r) => r.id.toLowerCase().includes(nameFilter.toLowerCase()))
    : rooms;

  // Close on outside click
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
        height: "48px",
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
            height: "24px",
            background: "rgba(0,212,255,0.2)",
            flexShrink: 0,
          }}
        />

        {/* Stats */}
        <div className="flex items-center gap-5 flex-shrink-0">
          <StatChip label="ACTIVE" value={active} color="#00ff88" />
          {idle > 0 && <StatChip label="IDLE" value={idle} color="#ff8c00" />}
          {stale > 0 && (
            <StatChip label="STALE" value={stale} color="#ff3333" />
          )}
          <StatChip
            label="ROOMS"
            value={rooms.length}
            color="#7b6fff"
            icon="◈"
          />
        </div>

        <div
          style={{
            width: "1px",
            height: "24px",
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

            {/* Holo dropdown */}
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
                {/* top accent line */}
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

function StatChip({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number;
  color: string;
  icon?: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span style={{ color, textShadow: `0 0 6px ${color}`, fontSize: "8px" }}>
        {icon ?? "●"}
      </span>
      <span
        style={{
          fontFamily: "Share Tech Mono",
          fontSize: "11px",
          color: "rgba(142,207,255,0.7)",
          letterSpacing: "0.05em",
        }}
      >
        <span
          style={{ color, textShadow: `0 0 8px ${color}`, fontWeight: 600 }}
        >
          {value}
        </span>{" "}
        <span
          style={{
            fontSize: "9px",
            letterSpacing: "0.15em",
            color: "rgba(0,212,255,0.4)",
          }}
        >
          {label}
        </span>
      </span>
    </div>
  );
}
