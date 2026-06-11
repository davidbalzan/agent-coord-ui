import { useEffect } from "react";
import { useBusStore } from "../store/bus.js";
import type {
  BacklogQueueItem,
  BacklogDoneItem,
  ProjectBacklog,
} from "@coord-ui/shared";

const PRIORITY_COLOR: Record<string, string> = {
  P1: "#ff4e4e",
  P2: "#ff8c00",
  P3: "#7b6fff",
};

function PriorityBadge({ p }: { p: string }) {
  const color = PRIORITY_COLOR[p] ?? "#00d4ff";
  return (
    <span
      style={{
        fontFamily: "Share Tech Mono, monospace",
        fontSize: 8,
        letterSpacing: "0.12em",
        color,
        border: `1px solid ${color}`,
        borderRadius: 2,
        padding: "1px 5px",
        flexShrink: 0,
        opacity: 0.9,
      }}
    >
      {p}
    </span>
  );
}

function QueueItem({ item }: { item: BacklogQueueItem }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        padding: "6px 0",
        borderBottom: "1px solid rgba(0,212,255,0.06)",
      }}
    >
      <span
        style={{
          flexShrink: 0,
          marginTop: 1,
          width: 12,
          height: 12,
          border: "1px solid rgba(0,212,255,0.3)",
          borderRadius: 2,
          display: "inline-block",
        }}
      />
      <PriorityBadge p={item.priority} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: "Share Tech Mono, monospace",
            fontSize: 11,
            color: "rgba(0,212,255,0.85)",
            lineHeight: 1.4,
            wordBreak: "break-word",
          }}
        >
          {item.text}
        </div>
        {item.refs && (
          <div
            style={{
              fontFamily: "Share Tech Mono, monospace",
              fontSize: 9,
              color: "rgba(0,212,255,0.35)",
              marginTop: 2,
              letterSpacing: "0.04em",
            }}
          >
            {item.refs}
          </div>
        )}
      </div>
    </div>
  );
}

function DoneItem({ item }: { item: BacklogDoneItem }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        padding: "5px 0",
        borderBottom: "1px solid rgba(0,212,255,0.04)",
        opacity: 0.6,
      }}
    >
      <span
        style={{
          flexShrink: 0,
          marginTop: 1,
          width: 12,
          height: 12,
          border: "1px solid rgba(0,255,136,0.3)",
          borderRadius: 2,
          background: "rgba(0,255,136,0.12)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 8,
          color: "#00ff88",
        }}
      >
        ✓
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: "Share Tech Mono, monospace",
            fontSize: 10,
            color: "rgba(0,212,255,0.6)",
            textDecoration: "line-through",
            wordBreak: "break-word",
          }}
        >
          {item.text}
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 2,
          }}
        >
          <span
            style={{
              fontFamily: "Share Tech Mono, monospace",
              fontSize: 9,
              color: "rgba(0,255,136,0.5)",
              letterSpacing: "0.04em",
            }}
          >
            {item.ref}
          </span>
          {item.date && (
            <span
              style={{
                fontFamily: "Share Tech Mono, monospace",
                fontSize: 9,
                color: "rgba(0,212,255,0.25)",
              }}
            >
              {item.date}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function ProjectSection({ backlog }: { backlog: ProjectBacklog }) {
  const name = backlog.project.split("/").pop() ?? backlog.project;
  return (
    <div style={{ marginBottom: 20 }}>
      <div
        style={{
          fontFamily: "Orbitron, sans-serif",
          fontSize: 9,
          letterSpacing: "0.2em",
          color: "rgba(0,212,255,0.5)",
          marginBottom: 8,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span style={{ color: "#00d4ff", opacity: 0.4 }}>◈</span>
        {name.toUpperCase()}
      </div>

      {backlog.queue.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={sectionLabelStyle}>QUEUE · {backlog.queue.length}</div>
          {backlog.queue.map((item, i) => (
            <QueueItem key={i} item={item} />
          ))}
        </div>
      )}

      {backlog.done.length > 0 && (
        <div>
          <div style={sectionLabelStyle}>DONE · {backlog.done.length}</div>
          {backlog.done.map((item, i) => (
            <DoneItem key={i} item={item} />
          ))}
        </div>
      )}

      {backlog.queue.length === 0 && backlog.done.length === 0 && (
        <div style={emptyStyle}>no items</div>
      )}
    </div>
  );
}

export function BacklogPanel() {
  const backlogs = useBusStore((s) => s.backlogs);
  const fetchBacklogs = useBusStore((s) => s.fetchBacklogs);
  const setBacklogOpen = useBusStore((s) => s.setBacklogOpen);

  useEffect(() => {
    fetchBacklogs();
  }, [fetchBacklogs]);

  return (
    <div
      style={{
        position: "fixed",
        top: 56,
        right: 0,
        width: 340,
        height: "calc(100vh - 56px)",
        background:
          "linear-gradient(180deg, rgba(0,8,22,0.97) 0%, rgba(0,4,14,0.99) 100%)",
        borderLeft: "1px solid rgba(0,212,255,0.2)",
        boxShadow: "-4px 0 32px rgba(0,212,255,0.06)",
        display: "flex",
        flexDirection: "column",
        zIndex: 200,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid rgba(0,212,255,0.15)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontFamily: "Orbitron, sans-serif",
              fontSize: 10,
              letterSpacing: "0.2em",
              color: "#00d4ff",
              textShadow: "0 0 8px rgba(0,212,255,0.6)",
            }}
          >
            BACKLOG
          </span>
          <span
            style={{
              fontFamily: "Share Tech Mono, monospace",
              fontSize: 9,
              color: "rgba(0,212,255,0.3)",
              letterSpacing: "0.1em",
            }}
          >
            READ-ONLY
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={() => fetchBacklogs()}
            style={{
              background: "none",
              border: "1px solid rgba(0,212,255,0.2)",
              color: "rgba(0,212,255,0.5)",
              fontFamily: "Share Tech Mono, monospace",
              fontSize: 9,
              letterSpacing: "0.1em",
              padding: "2px 8px",
              cursor: "pointer",
            }}
            title="Refresh"
          >
            ↻
          </button>
          <button
            onClick={() => setBacklogOpen(false)}
            style={{
              background: "none",
              border: "none",
              color: "rgba(0,212,255,0.4)",
              fontFamily: "Share Tech Mono, monospace",
              fontSize: 14,
              cursor: "pointer",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
        {backlogs.length === 0 ? (
          <div style={emptyStyle}>
            No backlogs found.
            <br />
            Set AGENT_COORD_PROJECT_REPOS to repo paths.
          </div>
        ) : (
          backlogs.map((b) => <ProjectSection key={b.project} backlog={b} />)
        )}
      </div>
    </div>
  );
}

const sectionLabelStyle: React.CSSProperties = {
  fontFamily: "Share Tech Mono, monospace",
  fontSize: 8,
  letterSpacing: "0.18em",
  color: "rgba(0,212,255,0.3)",
  marginBottom: 4,
};

const emptyStyle: React.CSSProperties = {
  fontFamily: "Share Tech Mono, monospace",
  fontSize: 10,
  color: "rgba(0,212,255,0.25)",
  textAlign: "center",
  marginTop: 40,
  lineHeight: 1.8,
  letterSpacing: "0.06em",
};
