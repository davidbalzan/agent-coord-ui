import { useBusStore } from "../store/bus.js";
import type { DavidDecisionPacket } from "../lib/decisionPacket.js";

export function DecisionCard({
  packet,
  messageId,
  onSend,
  onResolve,
}: {
  packet: DavidDecisionPacket;
  messageId: string;
  onSend: (optionText: string) => void;
  onResolve?: (messageId: string) => void;
}) {
  const addResolvedDecision = useBusStore((s) => s.addResolvedDecision);
  const chosenOption = useBusStore((s) => s.resolvedDecisions[messageId]);

  const choose = (option: string) => {
    onSend(option);
    addResolvedDecision(messageId, option);
    onResolve?.(messageId);
  };

  return (
    <div
      style={{
        border: "1px solid rgba(255,78,78,0.35)",
        borderLeft: "3px solid #ff4e4e",
        borderRadius: 4,
        background: "rgba(255,78,78,0.04)",
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {/* Title */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            fontFamily: "Share Tech Mono, monospace",
            fontSize: 9,
            letterSpacing: "0.15em",
            color: "#ff4e4e",
            border: "1px solid rgba(255,78,78,0.5)",
            borderRadius: 2,
            padding: "2px 7px",
            flexShrink: 0,
          }}
        >
          DAVID_DECISION
        </span>
        <span
          style={{
            fontFamily: "Orbitron, sans-serif",
            fontSize: 11,
            fontWeight: 700,
            color: "rgba(255,200,200,0.9)",
            letterSpacing: "0.08em",
          }}
        >
          {packet.title}
        </span>
      </div>

      {/* Context */}
      <div
        style={{
          fontFamily: "Share Tech Mono, monospace",
          fontSize: 12,
          lineHeight: 1.6,
          color: "rgba(0,212,255,0.8)",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {packet.context}
      </div>

      {/* Options */}
      {chosenOption ? (
        <ResolvedState chosenOption={chosenOption} />
      ) : (
        <OptionButtons
          options={packet.options}
          recommendation={packet.recommendation}
          onChoose={choose}
        />
      )}

      {/* If-no-action footnote */}
      {!chosenOption && (
        <div
          style={{
            fontFamily: "Share Tech Mono, monospace",
            fontSize: 10,
            color: "rgba(255,140,0,0.5)",
            borderTop: "1px solid rgba(255,140,0,0.1)",
            paddingTop: 8,
            letterSpacing: "0.04em",
          }}
        >
          If no action: {packet.ifNoAction}
        </div>
      )}
    </div>
  );
}

function OptionButtons({
  options,
  recommendation,
  onChoose,
}: {
  options: string[];
  recommendation: string;
  onChoose: (option: string) => void;
}) {
  const recLower = recommendation.toLowerCase();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div
        style={{
          fontFamily: "Share Tech Mono, monospace",
          fontSize: 9,
          letterSpacing: "0.12em",
          color: "rgba(0,212,255,0.3)",
          marginBottom: 2,
        }}
      >
        SELECT OPTION
      </div>
      {options.map((option, i) => {
        const isRecommended = recLower.includes(option.toLowerCase());
        return (
          <button
            key={i}
            onClick={() => onChoose(option)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 14px",
              background: isRecommended
                ? "rgba(0,212,255,0.1)"
                : "rgba(0,212,255,0.03)",
              border: isRecommended
                ? "1px solid rgba(0,212,255,0.4)"
                : "1px solid rgba(0,212,255,0.15)",
              borderRadius: 3,
              cursor: "pointer",
              textAlign: "left",
              transition: "background 0.12s, border-color 0.12s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                isRecommended ? "rgba(0,212,255,0.18)" : "rgba(0,212,255,0.08)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                isRecommended ? "rgba(0,212,255,0.1)" : "rgba(0,212,255,0.03)";
            }}
          >
            <span
              style={{
                fontFamily: "Orbitron, sans-serif",
                fontSize: 9,
                color: isRecommended ? "#00d4ff" : "rgba(0,212,255,0.35)",
                flexShrink: 0,
                minWidth: 18,
              }}
            >
              {i + 1}.
            </span>
            <span
              style={{
                fontFamily: "Share Tech Mono, monospace",
                fontSize: 12,
                color: isRecommended ? "#00d4ff" : "rgba(0,212,255,0.75)",
                flex: 1,
                lineHeight: 1.5,
              }}
            >
              {option}
            </span>
            {isRecommended && (
              <span
                style={{
                  fontFamily: "Share Tech Mono, monospace",
                  fontSize: 8,
                  letterSpacing: "0.12em",
                  color: "rgba(0,212,255,0.5)",
                  flexShrink: 0,
                  border: "1px solid rgba(0,212,255,0.25)",
                  borderRadius: 2,
                  padding: "1px 5px",
                }}
              >
                REC
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function ResolvedState({ chosenOption }: { chosenOption: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 14px",
        background: "rgba(0,255,136,0.05)",
        border: "1px solid rgba(0,255,136,0.2)",
        borderRadius: 3,
        opacity: 0.75,
      }}
    >
      <span style={{ color: "#00ff88", fontSize: 14, flexShrink: 0 }}>✓</span>
      <div>
        <div
          style={{
            fontFamily: "Share Tech Mono, monospace",
            fontSize: 9,
            letterSpacing: "0.12em",
            color: "rgba(0,255,136,0.5)",
            marginBottom: 3,
          }}
        >
          RESOLVED — REPLY SENT
        </div>
        <div
          style={{
            fontFamily: "Share Tech Mono, monospace",
            fontSize: 12,
            color: "rgba(0,255,136,0.7)",
          }}
        >
          {chosenOption}
        </div>
      </div>
    </div>
  );
}
