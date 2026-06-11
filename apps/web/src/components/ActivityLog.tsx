import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { AgentSnapshot, MessageSnapshot } from "@coord-ui/shared";
import { useBusStore } from "../store/bus.js";

const MAX_ACTIVITY_ENTRIES = 7;
const ACTIVITY_TTL_MS = 5600;

export interface ActivityLogEntry {
  id: string;
  label: string;
  isCoordinator: boolean;
  createdAt: number;
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

export function ActivityLog() {
  const messages = useBusStore((s) => s.messages);
  const agents = useBusStore((s) => s.agents);
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
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
    setEntries((current) =>
      appendActivityEntries(current, nextMessages, agents, now)
    );
  }, [agents, messages]);

  useEffect(() => {
    if (entries.length === 0) return;

    const timer = window.setInterval(() => {
      const now = Date.now();
      setEntries((current) =>
        current.filter((entry) => now - entry.createdAt < ACTIVITY_TTL_MS)
      );
    }, 700);

    return () => window.clearInterval(timer);
  }, [entries.length]);

  if (entries.length === 0) return null;

  return (
    <aside aria-hidden="true" style={shellStyle}>
      <div style={headerStyle}>BUS ACTIVITY</div>
      <div style={stackStyle}>
        {entries.map((entry) => (
          <div key={entry.id} style={entryStyle}>
            {entry.isCoordinator ? <span style={coordMarkStyle}>◆</span> : null}
            <span>{entry.label}</span>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes activity-log-fade {
          0% {
            opacity: 0;
            transform: translate3d(-6px, 2px, 0);
            filter: blur(2px);
          }
          14% {
            opacity: 0.62;
            transform: translate3d(0, 0, 0);
            filter: blur(0);
          }
          72% {
            opacity: 0.42;
          }
          100% {
            opacity: 0;
            transform: translate3d(0, -5px, 0);
            filter: blur(1px);
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
  pointerEvents: "none",
  fontFamily: '"Share Tech Mono", monospace',
  color: "rgba(157, 244, 255, 0.72)",
  textShadow: "0 0 10px rgba(0, 212, 255, 0.22)",
  mixBlendMode: "screen",
};

const headerStyle: CSSProperties = {
  marginBottom: 6,
  fontSize: 9,
  letterSpacing: "0.22em",
  color: "rgba(0, 212, 255, 0.32)",
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
  animation: `activity-log-fade ${ACTIVITY_TTL_MS}ms linear forwards`,
};

const coordMarkStyle: CSSProperties = {
  color: "rgba(255, 209, 102, 0.8)",
  textShadow: "0 0 8px rgba(255, 209, 102, 0.42)",
};
