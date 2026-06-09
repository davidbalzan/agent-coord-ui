import { useEffect, useRef, useState } from "react";
import { useBusStore } from "../store/bus.js";

const SPEED_PX_PER_MS = 0.055;
const SEP = "   ·   ";
const START_TIME = Date.now();

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function formatTs(ts: number): string {
  return new Date(ts).toISOString().replace("T", " ").slice(11, 19) + " UTC";
}

export function StatusTicker() {
  const agents = Object.values(useBusStore((s) => s.agents));
  const rooms = useBusStore((s) => s.rooms);
  const messages = useBusStore((s) => s.messages);

  const [now, setNow] = useState(() => Date.now());

  // Tick clock every second
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const active = agents.filter((a) => a.status === "active").length;
  const idle = agents.filter((a) => a.status === "idle").length;
  const stale = agents.filter((a) => a.status === "stale").length;
  const roomCount = Object.keys(rooms).length;
  const lastMsg = messages.at(-1);

  const parts: Array<{ text: string; color?: string }> = [
    { text: `JARVIS  ${formatTs(now)}` },
    { text: `AGENTS  ${agents.length}` },
    { text: `ACTIVE  ${active}`, color: active > 0 ? "#00ff88" : undefined },
    { text: `IDLE  ${idle}`, color: idle > 0 ? "#ff8c00" : undefined },
    { text: `STALE  ${stale}`, color: stale > 0 ? "#ff3333" : undefined },
    { text: `CHANNELS  ${roomCount}` },
    { text: `MESSAGES  ${messages.length}` },
    {
      text: lastMsg
        ? `LAST MSG  ${formatTs(lastMsg.timestamp)}  FROM  ${lastMsg.from.toUpperCase()}`
        : `LAST MSG  —`,
    },
    { text: `UPTIME  ${formatUptime(now - START_TIME)}` },
  ];

  const html =
    parts
      .map((p) =>
        p.color
          ? `<span style="color:${p.color};text-shadow:0 0 8px ${p.color}66">${p.text}</span>`
          : p.text
      )
      .join(SEP) + SEP;

  const innerRef = useRef<HTMLSpanElement>(null);
  const offsetRef = useRef(0);
  const rafRef = useRef<number>(0);
  const lastTRef = useRef<number | null>(null);

  useEffect(() => {
    const animate = (t: number) => {
      if (lastTRef.current !== null) {
        offsetRef.current += (t - lastTRef.current) * SPEED_PX_PER_MS;
        const inner = innerRef.current;
        if (inner) {
          const halfW = inner.scrollWidth / 2;
          if (halfW > 0 && offsetRef.current >= halfW) {
            offsetRef.current -= halfW;
          }
          inner.style.transform = `translateX(-${offsetRef.current}px)`;
        }
      }
      lastTRef.current = t;
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: 28,
        zIndex: 200,
        overflow: "hidden",
        background:
          "linear-gradient(to bottom, rgba(8, 24, 48, 0.45), rgba(0, 8, 22, 0.35))",
        borderTop: "1px solid rgba(0, 212, 255, 0.22)",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.06), 0 -4px 24px rgba(0,0,0,0.35)",
        backdropFilter: "blur(16px) saturate(150%)",
        WebkitBackdropFilter: "blur(16px) saturate(150%)",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 1,
          background:
            "linear-gradient(to right, rgba(0,8,22,0.55) 0%, transparent 6%, transparent 94%, rgba(0,8,22,0.55) 100%)",
        }}
      />
      <span
        ref={innerRef}
        style={{
          display: "inline-flex",
          alignItems: "center",
          height: "100%",
          whiteSpace: "nowrap",
          willChange: "transform",
          fontFamily: '"Share Tech Mono", monospace',
          fontSize: "0.64rem",
          letterSpacing: "0.09em",
          color: "rgba(0, 212, 255, 0.65)",
          textShadow: "0 0 6px rgba(0,212,255,0.35)",
          paddingLeft: 12,
        }}
        dangerouslySetInnerHTML={{ __html: html + html }}
      />
    </div>
  );
}
