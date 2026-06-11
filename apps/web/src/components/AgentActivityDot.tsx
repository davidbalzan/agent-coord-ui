import { useBusStore } from "../store/bus.js";
import { isAgentActive } from "../store/bus.js";

/**
 * Subtle "working…" indicator that lights when the agent's pane is producing
 * terminal output (proxy for responding; 2s granularity, clears within ~4s).
 */
export function AgentActivityDot({ agentId }: { agentId: string }) {
  const active = useBusStore((s) => isAgentActive(s, agentId));
  if (!active) return null;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: "#00ff88",
          boxShadow: "0 0 6px #00ff88, 0 0 12px rgba(0,255,136,0.4)",
          animation: "activity-pulse 1.2s ease-in-out infinite",
          flexShrink: 0,
          display: "inline-block",
        }}
      />
      <span
        style={{
          fontFamily: "Share Tech Mono, monospace",
          fontSize: 9,
          letterSpacing: "0.12em",
          color: "rgba(0,255,136,0.7)",
        }}
      >
        working…
      </span>
      <style>{`
        @keyframes activity-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.75); }
        }
      `}</style>
    </span>
  );
}
