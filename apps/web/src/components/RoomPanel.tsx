import { useState, useEffect, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import { useBusStore, roomMessages } from "../store/bus.js";

interface Props {
  roomId: string;
}

export function RoomPanel({ roomId }: Props) {
  const [draft, setDraft] = useState("");
  const room = useBusStore((s) => s.rooms[roomId]);
  const agents = useBusStore((s) => s.agents);
  const sendMessage = useBusStore((s) => s.sendMessage);
  const msgs = useBusStore(useShallow((s) => roomMessages(s, roomId)));
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when room opens or new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [msgs.length, roomId]);

  if (!room)
    return (
      <p
        style={{
          fontFamily: "Share Tech Mono",
          fontSize: "11px",
          color: "rgba(0,212,255,0.4)",
          padding: "16px",
        }}
      >
        {"// ROOM NOT FOUND"}
      </p>
    );

  const send = () => {
    if (!draft.trim()) return;
    sendMessage(roomId, draft.trim(), false);
    setDraft("");
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Room header */}
      <div
        className="px-4 py-3 flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(0,212,255,0.12)" }}
      >
        <div className="flex items-center gap-2">
          <span
            style={{
              color: "#7b6fff",
              textShadow: "0 0 8px #7b6fff",
              fontSize: "12px",
            }}
          >
            ◈
          </span>
          <span
            style={{
              fontFamily: "Orbitron, sans-serif",
              fontWeight: 600,
              fontSize: "12px",
              color: "#8ecfff",
              letterSpacing: "0.1em",
            }}
          >
            {room.name.toUpperCase()}
          </span>
        </div>
        {room.topic && (
          <p
            style={{
              fontFamily: "Share Tech Mono",
              fontSize: "10px",
              color: "rgba(0,212,255,0.4)",
              marginTop: "4px",
              letterSpacing: "0.05em",
            }}
          >
            {room.topic}
          </p>
        )}
        <p
          style={{
            fontFamily: "Share Tech Mono",
            fontSize: "9px",
            color: "rgba(0,212,255,0.3)",
            marginTop: "4px",
            letterSpacing: "0.1em",
          }}
        >
          MEMBERS: {room.members.length}
        </p>
      </div>

      {/* Member chips */}
      <div
        className="px-4 py-2 flex flex-wrap gap-1.5 flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(0,212,255,0.08)" }}
      >
        {room.members.map((id: string) => (
          <span
            key={id}
            style={{
              fontFamily: "Share Tech Mono",
              fontSize: "9px",
              letterSpacing: "0.08em",
              color: "rgba(0,212,255,0.7)",
              background: "rgba(0,212,255,0.06)",
              border: "1px solid rgba(0,212,255,0.2)",
              padding: "2px 8px",
              clipPath:
                "polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px))",
            }}
          >
            {agents[id]?.name ?? id}
          </span>
        ))}
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0"
      >
        {msgs.length === 0 && (
          <p
            style={{
              fontFamily: "Share Tech Mono",
              fontSize: "10px",
              color: "rgba(0,212,255,0.25)",
              letterSpacing: "0.1em",
            }}
          >
            {"// NO TRANSMISSIONS LOGGED"}
          </p>
        )}
        {msgs.map((m) => (
          <div
            key={m.id}
            style={{
              borderLeft: "2px solid rgba(123,111,255,0.3)",
              paddingLeft: "10px",
            }}
          >
            <div
              style={{
                fontFamily: "Share Tech Mono",
                fontSize: "9px",
                color: "#7b6fff",
                letterSpacing: "0.1em",
                marginBottom: "2px",
              }}
            >
              {agents[m.from]?.name?.toUpperCase() ?? m.from}
            </div>
            <p
              style={{
                fontFamily: "Exo 2, sans-serif",
                fontSize: "12px",
                color: "#8ecfff",
                margin: 0,
              }}
            >
              {m.body}
            </p>
          </div>
        ))}
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
          placeholder={`TRANSMIT TO #${room.name.toUpperCase()}…`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <button className="holo-btn" onClick={send}>
          POST
        </button>
      </div>
    </div>
  );
}
