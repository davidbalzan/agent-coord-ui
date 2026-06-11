import { useState, useEffect, useRef } from "react";
import { MdMessage } from "./MdMessage.js";
import { useShallow } from "zustand/react/shallow";
import { useBusStore } from "../store/bus.js";
import { AgentActivityDot } from "./AgentActivityDot.js";
import { HoloButton } from "./primitives/HoloButton.js";

interface Props {
  agentId: string;
}

const STATUS_COLOR: Record<string, string> = {
  active: "#00ff88",
  idle: "#ff8c00",
  stale: "#ff3333",
  unknown: "#334466",
};

const STATUS_LABEL: Record<string, string> = {
  active: "ONLINE",
  idle: "STANDBY",
  stale: "OFFLINE",
  unknown: "UNKNOWN",
};

export function DMPanel({ agentId }: Props) {
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const agent = useBusStore((s) => s.agents[agentId]);
  const agentIdList = useBusStore(useShallow((s) => Object.keys(s.agents)));
  const agentIds = new Set(agentIdList);
  const cwd = useBusStore(
    (s) =>
      Object.values(s.panes).find((p) => p.agentId === agentId)?.cwd ?? null
  );
  const sendMessage = useBusStore((s) => s.sendMessage);
  const setHoveredAgentId = useBusStore((s) => s.setHoveredAgentId);
  const setNameFilter = useBusStore((s) => s.setNameFilter);
  // All DMs where this agent is sender or recipient, sorted oldest-first
  const msgs = useBusStore(
    useShallow((s) =>
      s.messages
        .filter((m) => m.isDM && (m.from === agentId || m.to === agentId))
        .sort((a, b) => a.timestamp - b.timestamp)
    )
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  if (!agent)
    return (
      <p
        style={{
          fontFamily: "Share Tech Mono",
          fontSize: "11px",
          color: "rgba(0,212,255,0.4)",
          padding: "16px",
        }}
      >
        {"// AGENT NOT FOUND"}
      </p>
    );

  const send = () => {
    if (!draft.trim()) return;
    sendMessage(agentId, draft.trim(), true);
    setDraft("");
  };

  const statusColor = STATUS_COLOR[agent.status] ?? STATUS_COLOR["unknown"]!;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Agent header */}
      <div
        className="px-4 py-3 flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(0,212,255,0.12)" }}
      >
        <div className="flex items-center gap-3">
          {/* Status indicator with glow */}
          <div
            style={{
              position: "relative",
              width: "10px",
              height: "10px",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                background: statusColor,
                boxShadow: `0 0 8px ${statusColor}, 0 0 16px ${statusColor}40`,
                animation:
                  agent.status === "active"
                    ? "glow-pulse 2s ease-in-out infinite"
                    : undefined,
              }}
            />
          </div>
          <div>
            <div
              style={{
                fontFamily: "Orbitron, sans-serif",
                fontWeight: 600,
                fontSize: "12px",
                color: "#8ecfff",
                letterSpacing: "0.1em",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              {agent.name.toUpperCase()}
              <AgentActivityDot agentId={agentId} />
            </div>
            <div
              style={{
                fontFamily: "Share Tech Mono",
                fontSize: "9px",
                letterSpacing: "0.15em",
                marginTop: "2px",
              }}
            >
              <span
                style={{
                  color: statusColor,
                  textShadow: `0 0 6px ${statusColor}`,
                }}
              >
                {STATUS_LABEL[agent.status] ?? "UNKNOWN"}
              </span>
              <span style={{ color: "rgba(0,212,255,0.3)", marginLeft: "8px" }}>
                LAST PING: {new Date(agent.lastSeen).toLocaleTimeString()}
              </span>
            </div>
          </div>
        </div>

        {/* Agent metadata line */}
        <div
          className="flex gap-4 mt-2"
          style={{
            fontFamily: "Share Tech Mono",
            fontSize: "9px",
            letterSpacing: "0.1em",
            color: "rgba(0,212,255,0.3)",
          }}
        >
          <span>ID: {agentId.slice(0, 8).toUpperCase()}</span>
          {cwd && (
            <span
              style={{ color: "rgba(0,255,65,0.5)", letterSpacing: "0.04em" }}
              title={cwd}
            >
              ~/
              {cwd.replace(/^.*\/([^/]+\/[^/]+)$/, "$1")}
            </span>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
        {msgs.length === 0 && (
          <p
            style={{
              fontFamily: "Share Tech Mono",
              fontSize: "10px",
              color: "rgba(0,212,255,0.25)",
              letterSpacing: "0.1em",
            }}
          >
            {"// SECURE CHANNEL OPEN — NO TRANSMISSIONS"}
          </p>
        )}
        {msgs.map((m) => {
          // outgoing = sent BY the viewed agent; incoming = received by them
          const isOutgoing = m.from === agentId;
          return (
            <div
              key={m.id}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: isOutgoing ? "flex-end" : "flex-start",
              }}
            >
              <div
                style={{
                  fontFamily: "Share Tech Mono",
                  fontSize: "9px",
                  letterSpacing: "0.1em",
                  color: isOutgoing
                    ? "rgba(0,255,136,0.5)"
                    : "rgba(0,212,255,0.4)",
                  marginBottom: "3px",
                }}
              >
                {m.from.toUpperCase()} → {m.to.toUpperCase()}
              </div>
              <div
                style={{
                  fontFamily: "Exo 2, sans-serif",
                  fontSize: "12px",
                  color: isOutgoing ? "#c8f7e4" : "#8ecfff",
                  background: isOutgoing
                    ? "rgba(0,255,136,0.05)"
                    : "rgba(0,212,255,0.07)",
                  border: `1px solid ${isOutgoing ? "rgba(0,255,136,0.15)" : "rgba(0,212,255,0.2)"}`,
                  padding: "6px 10px",
                  maxWidth: "85%",
                  clipPath: isOutgoing
                    ? "polygon(0 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%)"
                    : "polygon(0 0, 100% 0, 100% 100%, 6px 100%, 0 calc(100% - 6px))",
                }}
              >
                <MdMessage
                  body={m.body}
                  agentIds={agentIds}
                  onHover={setHoveredAgentId}
                  onChannelClick={setNameFilter}
                />
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Compose */}
      <div
        className="px-4 py-3 flex gap-2 flex-shrink-0"
        style={{
          borderTop: "1px solid rgba(0,212,255,0.15)",
          background: "rgba(0,212,255,0.02)",
        }}
      >
        <input
          className="holo-input flex-1"
          placeholder={`TRANSMIT TO ${agent.name.toUpperCase()}…`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <HoloButton onClick={send}>SEND</HoloButton>
      </div>
    </div>
  );
}
