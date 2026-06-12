import { useEffect, useRef, useState } from "react";
import { useBusStore } from "../store/bus.js";
import type { DmThread } from "../store/bus.js";
import type { MessageSnapshot } from "@coord-ui/shared";
import { DAVID_ID, buildDavidThreads } from "../lib/inbox.js";
import { parseDavidDecisionPacket } from "../lib/decisionPacket.js";
import { DecisionCard } from "./DecisionCard.js";
import { AgentActivityDot } from "./AgentActivityDot.js";
import { FONT_MONO, FONT_DISPLAY } from "../theme/tokens.js";
import { GlassPanel } from "./primitives/GlassPanel.js";
import { SeverityBadge } from "./primitives/SeverityBadge.js";
import { HoloButton } from "./primitives/HoloButton.js";
import { usePanelZ } from "../hooks/usePanelZ.js";

const PANEL_WIDTH = 700;

export function InboxPanel() {
  const inboxOpen = useBusStore((s) => s.inboxOpen);
  const panelZ = usePanelZ("inbox");
  const setInboxOpen = useBusStore((s) => s.setInboxOpen);
  const activeThread = useBusStore((s) => s.activeInboxThread);
  const setActiveThread = useBusStore((s) => s.setActiveInboxThread);
  const markThreadRead = useBusStore((s) => s.markThreadRead);
  const readState = useBusStore((s) => s.readState);
  const messages = useBusStore((s) => s.messages);
  const sendMessage = useBusStore((s) => s.sendMessage);
  const threads = buildDavidThreads(messages, readState);

  useEffect(() => {
    if (!inboxOpen) return;
    // Auto-select the first thread if none active
    if (!activeThread && threads.length > 0) {
      setActiveThread(threads[0].counterpart);
    }
  }, [inboxOpen, activeThread, threads, setActiveThread]);

  if (!inboxOpen) return null;

  const currentThread =
    threads.find((t) => t.counterpart === activeThread) ?? null;

  const openThread = (counterpart: string) => {
    setActiveThread(counterpart);
    markThreadRead(counterpart);
  };

  return (
    <GlassPanel
      background="rgba(0,8,22,0.97)"
      onMouseDownCapture={panelZ.onMouseDownCapture}
      style={{
        position: "fixed",
        top: 56,
        right: 0,
        bottom: 0,
        width: PANEL_WIDTH,
        borderLeft: "1px solid rgba(0,212,255,0.25)",
        display: "flex",
        flexDirection: "column",
        zIndex: panelZ.zIndex,
        boxShadow: "-4px 0 40px rgba(0,0,0,0.6)",
      }}
    >
      {/* Top scan line */}
      <div
        style={{
          height: 1,
          background:
            "linear-gradient(90deg, transparent, rgba(0,212,255,0.5) 30%, rgba(0,212,255,0.5) 70%, transparent)",
        }}
      />

      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "10px 16px",
          borderBottom: "1px solid rgba(0,212,255,0.12)",
          flexShrink: 0,
          gap: 10,
        }}
      >
        <span
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.2em",
            color: "#00d4ff",
            textShadow: "0 0 10px rgba(0,212,255,0.7)",
          }}
        >
          INBOX
        </span>
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: 9,
            color: "rgba(0,212,255,0.35)",
            letterSpacing: "0.12em",
          }}
        >
          DM THREADS
        </span>
        <button
          onClick={() => setInboxOpen(false)}
          style={{
            marginLeft: "auto",
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "rgba(0,212,255,0.4)",
            fontFamily: FONT_MONO,
            fontSize: 16,
            lineHeight: 1,
            padding: "0 4px",
          }}
        >
          ×
        </button>
      </div>

      {/* Body: thread list + thread view */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Thread list */}
        <div
          style={{
            width: 200,
            flexShrink: 0,
            borderRight: "1px solid rgba(0,212,255,0.1)",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {threads.length === 0 ? (
            <div
              style={{
                padding: "20px 14px",
                fontFamily: FONT_MONO,
                fontSize: 11,
                color: "rgba(0,212,255,0.25)",
                letterSpacing: "0.08em",
              }}
            >
              no messages
            </div>
          ) : (
            threads.map((t) => (
              <ThreadRow
                key={t.counterpart}
                thread={t}
                active={t.counterpart === activeThread}
                onClick={() => openThread(t.counterpart)}
              />
            ))
          )}
        </div>

        {/* Thread view + reply */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
          }}
        >
          {currentThread ? (
            <ThreadView
              thread={currentThread}
              onSend={(body) => {
                sendMessage(currentThread.counterpart, body, true);
                markThreadRead(currentThread.counterpart);
              }}
            />
          ) : (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: FONT_MONO,
                fontSize: 11,
                color: "rgba(0,212,255,0.2)",
                letterSpacing: "0.1em",
              }}
            >
              SELECT A THREAD
            </div>
          )}
        </div>
      </div>
    </GlassPanel>
  );
}

function ThreadRow({
  thread,
  active,
  onClick,
}: {
  thread: DmThread;
  active: boolean;
  onClick: () => void;
}) {
  const lastMsg = thread.messages[thread.messages.length - 1];
  const preview = lastMsg ? truncate(lastMsg.body, 42) : "";

  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 3,
        padding: "10px 14px",
        background: active ? "rgba(0,212,255,0.07)" : "none",
        border: "none",
        borderBottom: "1px solid rgba(0,212,255,0.06)",
        borderLeft: active
          ? "2px solid rgba(0,212,255,0.6)"
          : "2px solid transparent",
        cursor: "pointer",
        textAlign: "left",
        transition: "background 0.1s",
      }}
      onMouseEnter={(e) => {
        if (!active)
          (e.currentTarget as HTMLButtonElement).style.background =
            "rgba(0,212,255,0.04)";
      }}
      onMouseLeave={(e) => {
        if (!active)
          (e.currentTarget as HTMLButtonElement).style.background = "none";
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: 11,
            color: active ? "#00d4ff" : "rgba(0,212,255,0.75)",
            letterSpacing: "0.06em",
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {thread.counterpart}
        </span>
        {thread.unreadCount > 0 && (
          <span
            style={{
              background: "#00d4ff",
              color: "#000913",
              fontFamily: FONT_DISPLAY,
              fontWeight: 700,
              fontSize: 8,
              padding: "1px 5px",
              borderRadius: 8,
              flexShrink: 0,
              minWidth: 16,
              textAlign: "center",
            }}
          >
            {thread.unreadCount}
          </span>
        )}
      </div>
      <span
        style={{
          fontFamily: FONT_MONO,
          fontSize: 10,
          color: "rgba(0,212,255,0.3)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          letterSpacing: "0.04em",
        }}
      >
        {preview}
      </span>
    </button>
  );
}

function ThreadView({
  thread,
  onSend,
}: {
  thread: DmThread;
  onSend: (body: string) => void;
}) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState("");
  // The counterpart's tmux pane, if matched — enables the "open terminal" button.
  const counterpartPaneId = useBusStore(
    (s) =>
      Object.values(s.panes).find((p) => p.agentId === thread.counterpart)
        ?.id ?? null
  );
  const setPaneSelection = useBusStore((s) => s.setPaneSelection);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread.messages.length]);

  const submit = () => {
    const body = draft.trim();
    if (!body) return;
    onSend(body);
    setDraft("");
  };

  return (
    <>
      {/* Thread header: counterpart name + activity indicator */}
      <div
        style={{
          padding: "6px 20px",
          borderBottom: "1px solid rgba(0,212,255,0.07)",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 10,
          minHeight: 30,
        }}
      >
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: 10,
            color: "rgba(0,212,255,0.45)",
            letterSpacing: "0.1em",
          }}
        >
          {thread.counterpart}
        </span>
        <AgentActivityDot agentId={thread.counterpart} />
        {counterpartPaneId && (
          <HoloButton
            style={{
              marginLeft: "auto",
              fontSize: 9,
              padding: "2px 8px",
              flexShrink: 0,
            }}
            onClick={() => setPaneSelection(counterpartPaneId)}
            title="Open this agent's terminal"
          >
            ▣ TERMINAL
          </HoloButton>
        )}
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        {thread.messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} onSend={onSend} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply composer */}
      <div
        style={{
          padding: "12px 16px",
          borderTop: "1px solid rgba(0,212,255,0.12)",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "flex-end",
          }}
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Reply… (Enter to send, Shift+Enter for newline)"
            rows={3}
            style={{
              flex: 1,
              background: "rgba(0,212,255,0.04)",
              border: "1px solid rgba(0,212,255,0.2)",
              color: "rgba(0,212,255,0.9)",
              fontFamily: FONT_MONO,
              fontSize: 13,
              lineHeight: 1.5,
              padding: "8px 12px",
              resize: "none",
              borderRadius: 3,
              outline: "none",
            }}
          />
          <button
            onClick={submit}
            disabled={!draft.trim()}
            style={{
              background: draft.trim()
                ? "rgba(0,212,255,0.15)"
                : "rgba(0,212,255,0.04)",
              border: `1px solid ${draft.trim() ? "rgba(0,212,255,0.4)" : "rgba(0,212,255,0.1)"}`,
              color: draft.trim() ? "#00d4ff" : "rgba(0,212,255,0.25)",
              fontFamily: FONT_MONO,
              fontSize: 10,
              letterSpacing: "0.12em",
              padding: "8px 14px",
              cursor: draft.trim() ? "pointer" : "default",
              borderRadius: 3,
              flexShrink: 0,
              transition: "all 0.15s",
            }}
          >
            SEND
          </button>
        </div>
        <div
          style={{
            marginTop: 5,
            fontFamily: FONT_MONO,
            fontSize: 9,
            color: "rgba(0,212,255,0.2)",
            letterSpacing: "0.08em",
          }}
        >
          → {thread.counterpart}
        </div>
      </div>
    </>
  );
}

function MessageBubble({
  msg,
  onSend,
}: {
  msg: MessageSnapshot;
  onSend: (body: string) => void;
}) {
  const isOutbound = msg.from === DAVID_ID;
  const ts = new Date(msg.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  // Try to parse inbound DAVID_DECISION messages as structured packets
  const packet = !isOutbound ? parseDavidDecisionPacket(msg.body) : null;

  const prefix = packet ? "DAVID_DECISION" : extractPrefix(msg.body);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isOutbound ? "flex-end" : "flex-start",
        marginBottom: 12,
      }}
    >
      {/* Sender + timestamp row */}
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          marginBottom: 4,
          flexDirection: isOutbound ? "row-reverse" : "row",
        }}
      >
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: 10,
            color: isOutbound ? "rgba(0,255,136,0.6)" : "rgba(0,212,255,0.5)",
            letterSpacing: "0.08em",
          }}
        >
          {isOutbound ? "you" : msg.from}
        </span>
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: 9,
            color: "rgba(0,212,255,0.2)",
          }}
        >
          {ts}
        </span>
        {prefix && !packet && <SeverityBadge prefix={prefix} />}
      </div>

      {/* Message body — DecisionCard for packets, plain bubble otherwise */}
      {packet ? (
        <div style={{ width: "100%" }}>
          <DecisionCard packet={packet} messageId={msg.id} onSend={onSend} />
        </div>
      ) : (
        <div
          style={{
            maxWidth: "85%",
            background: isOutbound
              ? "rgba(0,255,136,0.06)"
              : "rgba(0,212,255,0.06)",
            border: `1px solid ${isOutbound ? "rgba(0,255,136,0.15)" : "rgba(0,212,255,0.15)"}`,
            borderRadius: 4,
            padding: "10px 14px",
            fontFamily: FONT_MONO,
            fontSize: 13,
            lineHeight: 1.7,
            color: isOutbound ? "rgba(0,255,136,0.85)" : "rgba(0,212,255,0.9)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {msg.body}
        </div>
      )}
    </div>
  );
}

function extractPrefix(body: string): string | null {
  const m = /^(DAVID_DECISION|BLOCKER|RISK|AGENT_ACTION|DONE|FYI):/.exec(body);
  return m ? m[1] : null;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
