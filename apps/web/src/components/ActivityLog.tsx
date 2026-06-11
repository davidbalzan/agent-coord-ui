import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { AgentSnapshot, MessageSnapshot } from "@coord-ui/shared";
import { useBusStore } from "../store/bus.js";

const MAX_ACTIVITY_ENTRIES = 7;
export const ACTIVITY_LOG_TILE_LABEL = "◇ BUS ACTIVITY";
export const ACTIVITY_HOLD_MS = 8000;
export const ACTIVITY_FADE_MS = 4000;
export const ACTIVITY_TTL_MS = ACTIVITY_HOLD_MS + ACTIVITY_FADE_MS;

export interface ActivityLogEntry {
  id: string;
  label: string;
  isCoordinator: boolean;
  createdAt: number;
  pausedAgeMs?: number;
}

interface LastSeenMessage {
  id: string | null;
  count: number;
}

export function formatActivityLabel(msg: MessageSnapshot): string {
  if (msg.isDM) return `${msg.from} → ${msg.to}`;
  return `${msg.from} → #${msg.to.replace(/^#/, "")}`;
}

export function isCoordinatorSender(
  senderId: string,
  agents: Record<string, AgentSnapshot>
): boolean {
  const agent = agents[senderId];
  const role = agent?.metadata?.role;
  if (typeof role === "string") return role.toLowerCase() === "coordinator";
  if (role !== undefined) return false;

  const name = agent?.name ?? senderId;
  return /(^coord|-coordinator$)/i.test(name);
}

export function newMessagesSince(
  messages: MessageSnapshot[],
  lastSeen: LastSeenMessage
): MessageSnapshot[] {
  if (messages.length === 0) return [];
  if (!lastSeen.id) return messages.slice(lastSeen.count);

  const lastSeenIndex = messages.findIndex((msg) => msg.id === lastSeen.id);
  if (lastSeenIndex >= 0) return messages.slice(lastSeenIndex + 1);

  return messages.slice(lastSeen.count);
}

export function appendActivityEntries(
  entries: ActivityLogEntry[],
  messages: MessageSnapshot[],
  agents: Record<string, AgentSnapshot>,
  now: number,
  maxEntries = MAX_ACTIVITY_ENTRIES
): ActivityLogEntry[] {
  const nextEntries = messages.map((msg, index) => ({
    id: `${msg.id}:${now}:${index}`,
    label: formatActivityLabel(msg),
    isCoordinator: isCoordinatorSender(msg.from, agents),
    createdAt: now,
  }));

  return [...entries, ...nextEntries].slice(-maxEntries);
}

export function activityEntryAge(entry: ActivityLogEntry, now: number): number {
  return entry.pausedAgeMs ?? Math.max(0, now - entry.createdAt);
}

export function activityEntryOpacity(
  ageMs: number,
  isHovered: boolean
): number {
  if (isHovered) return 1;
  if (ageMs <= ACTIVITY_HOLD_MS) return 1;

  const fadeProgress = (ageMs - ACTIVITY_HOLD_MS) / ACTIVITY_FADE_MS;
  return Math.max(0, 1 - fadeProgress);
}

export function pauseActivityEntries(
  entries: ActivityLogEntry[],
  now: number
): ActivityLogEntry[] {
  return entries.map((entry) => ({
    ...entry,
    pausedAgeMs: activityEntryAge(entry, now),
  }));
}

export function resumeActivityEntries(
  entries: ActivityLogEntry[],
  now: number
): ActivityLogEntry[] {
  return entries.map((entry) => {
    const ageMs = activityEntryAge(entry, now);
    const { pausedAgeMs: _pausedAgeMs, ...rest } = entry;
    return {
      ...rest,
      createdAt: now - ageMs,
    };
  });
}

export function expireActivityEntries(
  entries: ActivityLogEntry[],
  now: number
): ActivityLogEntry[] {
  return entries.filter(
    (entry) => activityEntryAge(entry, now) < ACTIVITY_TTL_MS
  );
}

export function ActivityLog() {
  const messages = useBusStore((s) => s.messages);
  const agents = useBusStore((s) => s.agents);
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [isHovered, setIsHovered] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const lastSeenRef = useRef<LastSeenMessage | null>(null);

  useEffect(() => {
    const latestMessage = messages[messages.length - 1] ?? null;

    if (!lastSeenRef.current) {
      lastSeenRef.current = {
        id: latestMessage?.id ?? null,
        count: messages.length,
      };
      return;
    }

    const nextMessages = newMessagesSince(messages, lastSeenRef.current);
    lastSeenRef.current = {
      id: latestMessage?.id ?? null,
      count: messages.length,
    };

    if (nextMessages.length === 0) return;

    const now = Date.now();
    setEntries((current) => {
      const nextEntries = appendActivityEntries(
        current,
        nextMessages,
        agents,
        now
      );
      return isHovered ? pauseActivityEntries(nextEntries, now) : nextEntries;
    });
  }, [agents, isHovered, messages]);

  useEffect(() => {
    if (entries.length === 0) return;

    const timer = window.setInterval(() => {
      const nextNow = Date.now();
      setNow(nextNow);
      if (isHovered) return;

      setEntries((current) => expireActivityEntries(current, nextNow));
    }, 500);

    return () => window.clearInterval(timer);
  }, [entries.length, isHovered]);

  const handleMouseEnter = () => {
    const hoverNow = Date.now();
    setNow(hoverNow);
    setIsHovered(true);
    setEntries((current) => pauseActivityEntries(current, hoverNow));
  };

  const handleMouseLeave = () => {
    const leaveNow = Date.now();
    setNow(leaveNow);
    setIsHovered(false);
    setEntries((current) => resumeActivityEntries(current, leaveNow));
  };

  return (
    <aside
      aria-hidden="true"
      style={shellStyle}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div style={tileStyle}>{ACTIVITY_LOG_TILE_LABEL}</div>
      {entries.length > 0 ? (
        <div style={stackStyle}>
          {entries.map((entry) => {
            const ageMs = activityEntryAge(entry, now);
            const opacity = activityEntryOpacity(ageMs, isHovered);

            return (
              <div key={entry.id} style={{ ...entryStyle, opacity }}>
                {entry.isCoordinator ? (
                  <span style={coordMarkStyle}>◆</span>
                ) : null}
                <span>{entry.label}</span>
              </div>
            );
          })}
        </div>
      ) : null}
      <style>{`
        @keyframes activity-log-enter {
          0% {
            opacity: 0;
            transform: translate3d(-6px, 2px, 0);
            filter: blur(2px);
          }
          100% {
            opacity: 1;
            transform: translate3d(0, 0, 0);
            filter: blur(0);
          }
        }
      `}</style>
    </aside>
  );
}

const shellStyle: CSSProperties = {
  position: "absolute",
  top: 18,
  left: 18,
  zIndex: 4,
  width: 260,
  maxWidth: "34vw",
  pointerEvents: "auto",
  fontFamily: '"Share Tech Mono", monospace',
  color: "rgba(157, 244, 255, 0.72)",
  textShadow: "0 0 10px rgba(0, 212, 255, 0.22)",
  mixBlendMode: "screen",
};

const tileStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  marginBottom: 7,
  padding: "4px 8px",
  border: "1px solid rgba(0, 212, 255, 0.13)",
  borderRadius: 2,
  background:
    "linear-gradient(90deg, rgba(0, 212, 255, 0.055), rgba(0, 212, 255, 0.012))",
  boxShadow:
    "0 0 18px rgba(0, 212, 255, 0.035), inset 0 0 12px rgba(0, 212, 255, 0.035)",
  fontSize: 10,
  letterSpacing: "0.22em",
  color: "rgba(157, 244, 255, 0.44)",
};

const stackStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const entryStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  width: "fit-content",
  maxWidth: "100%",
  padding: "3px 7px",
  borderLeft: "1px solid rgba(0, 212, 255, 0.18)",
  background:
    "linear-gradient(90deg, rgba(0, 212, 255, 0.08), rgba(0, 212, 255, 0.01))",
  boxShadow: "inset 0 0 12px rgba(0, 212, 255, 0.035)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontSize: 11,
  lineHeight: 1.25,
  transition: "opacity 240ms linear",
  animation: "activity-log-enter 180ms ease-out",
};

const coordMarkStyle: CSSProperties = {
  color: "rgba(255, 209, 102, 0.8)",
  textShadow: "0 0 8px rgba(255, 209, 102, 0.42)",
};
