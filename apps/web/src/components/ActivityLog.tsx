import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { AgentSnapshot, MessageSnapshot } from "@coord-ui/shared";
import { useBusStore } from "../store/bus.js";
import {
  classifyPriority,
  extractPrefix,
  type BusPrefix,
  type Priority,
} from "../lib/notificationPriority.js";
import { MdMessage } from "./MdMessage.js";

const MAX_VISIBLE_ACTIVITY_ENTRIES = 7;
const EMPTY_AGENT_IDS = new Set<string>();
export const MAX_RETAINED_ACTIVITY_ENTRIES = 18;
export const ACTIVITY_LOG_TILE_LABEL = "◇ BUS ACTIVITY";
export const ACTIVITY_HOLD_MS = 8000;
export const ACTIVITY_FADE_MS = 4000;
export const ACTIVITY_TTL_MS = ACTIVITY_HOLD_MS + ACTIVITY_FADE_MS;

export interface ActivityLogEntry {
  id: string;
  label: string;
  isCoordinator: boolean;
  message: MessageSnapshot;
  createdAt: number;
  pausedAgeMs?: number;
}

export interface ActivityEventDetail {
  route: string;
  sender: string;
  recipient: string;
  channelType: "DM" | "ROOM";
  body: string;
  timestamp: string;
  prefix: BusPrefix | null;
  severity: Priority;
}

interface LastSeenMessage {
  id: string | null;
  count: number;
}

export function formatActivityLabel(msg: MessageSnapshot): string {
  if (msg.isDM) return `${msg.from} → ${msg.to}`;
  return `${msg.from} → #${msg.to.replace(/^#/, "")}`;
}

export function formatActivityTimestamp(timestamp: number): string {
  return new Date(timestamp).toISOString().replace("T", " ").slice(0, 19);
}

export function activityEventDetail(
  entry: ActivityLogEntry
): ActivityEventDetail {
  const message = entry.message;
  const recipient = message.isDM
    ? message.to
    : `#${message.to.replace(/^#/, "")}`;

  return {
    route: `${message.from} → ${recipient}`,
    sender: message.from,
    recipient,
    channelType: message.isDM ? "DM" : "ROOM",
    body: message.body,
    timestamp: formatActivityTimestamp(message.timestamp),
    prefix: extractPrefix(message.body),
    severity: classifyPriority(message.body),
  };
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
  maxEntries = MAX_RETAINED_ACTIVITY_ENTRIES
): ActivityLogEntry[] {
  const nextEntries = messages.map((msg, index) => ({
    id: `${msg.id}:${now}:${index}`,
    label: formatActivityLabel(msg),
    isCoordinator: isCoordinatorSender(msg.from, agents),
    message: msg,
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
  _now: number,
  maxEntries = MAX_RETAINED_ACTIVITY_ENTRIES
): ActivityLogEntry[] {
  return entries.slice(-maxEntries);
}

export function visibleActivityEntries(
  entries: ActivityLogEntry[],
  isHovered: boolean,
  maxEntries = MAX_VISIBLE_ACTIVITY_ENTRIES
): ActivityLogEntry[] {
  return isHovered ? entries : entries.slice(-maxEntries);
}

export function ActivityLog() {
  const messages = useBusStore((s) => s.messages);
  const agents = useBusStore((s) => s.agents);
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [isHovered, setIsHovered] = useState(false);
  const [hoveredEntryId, setHoveredEntryId] = useState<string | null>(null);
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
    setHoveredEntryId(null);
    setEntries((current) => resumeActivityEntries(current, leaveNow));
  };
  const renderedEntries = visibleActivityEntries(entries, isHovered);
  const hoveredEntry =
    hoveredEntryId === null
      ? null
      : (entries.find((entry) => entry.id === hoveredEntryId) ?? null);

  return (
    <aside
      aria-hidden="true"
      style={shellStyle}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div style={tileStyle}>{ACTIVITY_LOG_TILE_LABEL}</div>
      {renderedEntries.length > 0 ? (
        <div style={stackStyle}>
          {renderedEntries.map((entry) => {
            const ageMs = activityEntryAge(entry, now);
            const opacity = activityEntryOpacity(ageMs, isHovered);

            return (
              <div
                key={entry.id}
                style={{ ...entryStyle, opacity }}
                onMouseEnter={() => setHoveredEntryId(entry.id)}
                onMouseLeave={() =>
                  setHoveredEntryId((current) =>
                    current === entry.id ? null : current
                  )
                }
              >
                {entry.isCoordinator ? (
                  <span style={coordMarkStyle}>◆</span>
                ) : null}
                <span>{entry.label}</span>
              </div>
            );
          })}
        </div>
      ) : null}
      {hoveredEntry ? <ActivityEventDetailPanel entry={hoveredEntry} /> : null}
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
        .activity-detail-body .md-body {
          color: rgba(250, 254, 255, 0.96);
          font-size: 13px;
          line-height: 1.62;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.72);
        }
        .activity-detail-body .md-body strong,
        .activity-detail-body .md-body h1,
        .activity-detail-body .md-body h2,
        .activity-detail-body .md-body h3 {
          color: rgba(255, 255, 255, 0.98);
        }
        .activity-detail-body .md-body code {
          color: rgba(130, 245, 255, 0.98);
          background: rgba(0, 212, 255, 0.16);
          border-color: rgba(0, 212, 255, 0.24);
        }
        .activity-detail-body .md-body pre {
          background: rgba(0, 0, 0, 0.52);
          border-color: rgba(0, 212, 255, 0.28);
        }
      `}</style>
    </aside>
  );
}

function ActivityEventDetailPanel({ entry }: { entry: ActivityLogEntry }) {
  const detail = activityEventDetail(entry);

  return (
    <section style={detailPanelStyle}>
      <div style={detailEyebrowStyle}>
        <span>{detail.channelType}</span>
        <span>{detail.prefix ?? "NO PREFIX"}</span>
        <span>{detail.severity.toUpperCase()}</span>
      </div>
      <div style={detailRouteStyle}>{detail.route}</div>
      <div style={detailMetaGridStyle}>
        <DetailDatum label="SENDER" value={detail.sender} />
        <DetailDatum
          label={detail.channelType === "DM" ? "RECIPIENT" : "ROOM"}
          value={detail.recipient}
        />
        <DetailDatum label="TIME" value={detail.timestamp} />
      </div>
      <div className="activity-detail-body" style={detailBodyStyle}>
        <MdMessage body={detail.body} agentIds={EMPTY_AGENT_IDS} />
      </div>
    </section>
  );
}

function DetailDatum({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={detailDatumLabelStyle}>{label}</div>
      <div style={detailDatumValueStyle}>{value}</div>
    </div>
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

const detailPanelStyle: CSSProperties = {
  position: "fixed",
  top: "50%",
  left: "50%",
  zIndex: 80,
  width: 560,
  maxWidth: "min(560px, calc(100vw - 48px))",
  transform: "translate(-50%, -50%)",
  pointerEvents: "none",
  padding: "20px 22px",
  border: "1px solid rgba(0, 212, 255, 0.28)",
  borderRadius: 12,
  // Frosted glass: translucent enough that the heavy backdrop-blur is actually
  // visible (the graph behind reads as a soft wash), kept legible by the dark
  // tint + strong text-shadow. At ~0.97 the blur was invisible (nothing showed
  // through); at ~0.4 it was unreadable — ~0.62 is the frosted middle.
  background: "rgba(0, 8, 22, 0.62)",
  boxShadow: "0 20px 60px rgba(0,0,0,0.62), 0 0 24px rgba(0,212,255,0.10)",
  backdropFilter: "blur(26px) saturate(160%)",
  WebkitBackdropFilter: "blur(26px) saturate(160%)",
  color: "rgba(242, 253, 255, 0.97)",
  textShadow: "0 1px 3px rgba(0, 0, 0, 0.9), 0 0 10px rgba(0, 212, 255, 0.16)",
};

const detailEyebrowStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginBottom: 10,
  fontSize: 9,
  letterSpacing: "0.18em",
  color: "rgba(96, 232, 255, 0.82)",
};

const detailRouteStyle: CSSProperties = {
  marginBottom: 14,
  fontSize: 15,
  color: "rgba(232, 253, 255, 0.98)",
  letterSpacing: "0.04em",
};

const detailMetaGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 10,
  marginBottom: 16,
};

const detailDatumLabelStyle: CSSProperties = {
  marginBottom: 3,
  fontSize: 8,
  letterSpacing: "0.2em",
  color: "rgba(96, 232, 255, 0.62)",
};

const detailDatumValueStyle: CSSProperties = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontSize: 11,
  color: "rgba(232, 253, 255, 0.88)",
};

const detailBodyStyle: CSSProperties = {
  maxHeight: "42vh",
  overflow: "hidden",
  padding: "10px 0 0",
  borderTop: "1px solid rgba(0, 212, 255, 0.12)",
  color: "rgba(250, 254, 255, 0.96)",
};
