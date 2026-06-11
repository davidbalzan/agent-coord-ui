import type { CSSProperties } from "react";
import { STEPS, STEP_LABELS, type StepName } from "./types.js";

export function ProgressCard({
  prog,
  onDismiss,
}: {
  prog: {
    agentId: string;
    step: string;
    paneId?: string;
    message?: string;
    error?: string;
  };
  onDismiss: () => void;
}) {
  const step = prog.step as StepName;
  const isError = step === "error";
  const isDone = step === "done";
  const stepIndex = STEPS.indexOf(step as (typeof STEPS)[number]);

  return (
    <div
      style={{
        background: "rgba(0,212,255,0.03)",
        border: `1px solid ${isError ? "rgba(255,51,51,0.3)" : isDone ? "rgba(0,255,136,0.3)" : "rgba(0,212,255,0.15)"}`,
        padding: "6px 8px",
        marginBottom: 6,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <span
          style={{
            fontFamily: "Share Tech Mono",
            fontSize: 10,
            color: "#8ecfff",
          }}
        >
          {prog.agentId}
        </span>
        {(isError || isDone) && (
          <button
            onClick={onDismiss}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "rgba(0,212,255,0.4)",
              fontSize: 11,
              lineHeight: 1,
              padding: 0,
            }}
          >
            ×
          </button>
        )}
      </div>

      {/* Step dots */}
      <div
        style={{ display: "flex", gap: 3, marginTop: 5, alignItems: "center" }}
      >
        {STEPS.map((s, i) => {
          const active = s === step;
          const done = isDone || stepIndex > i;
          return (
            <div
              key={s}
              title={STEP_LABELS[s]}
              style={{
                width: active ? 20 : 8,
                height: 4,
                background:
                  isError && active
                    ? "#ff3333"
                    : done || active
                      ? "#00d4ff"
                      : "rgba(0,212,255,0.15)",
                boxShadow: active
                  ? `0 0 6px ${isError ? "#ff3333" : "#00d4ff"}`
                  : "none",
                transition: "all 0.2s",
                flexShrink: 0,
              }}
            />
          );
        })}
        <span
          style={{
            fontFamily: "Share Tech Mono",
            fontSize: 8,
            letterSpacing: "0.1em",
            color: isError
              ? "#ff3333"
              : isDone
                ? "#00ff88"
                : "rgba(0,212,255,0.6)",
            marginLeft: 4,
          }}
        >
          {isError ? "ERR" : (STEP_LABELS[step] ?? step.toUpperCase())}
        </span>
      </div>

      {prog.message && !isError && (
        <div
          style={{
            fontFamily: "Share Tech Mono",
            fontSize: 9,
            color: "rgba(0,212,255,0.4)",
            marginTop: 3,
          }}
        >
          {prog.message}
        </div>
      )}
      {isError && prog.error && (
        <div
          style={{
            fontFamily: "Share Tech Mono",
            fontSize: 9,
            color: "#ff3333",
            marginTop: 3,
          }}
        >
          {prog.error}
        </div>
      )}
      {prog.paneId && (
        <div
          style={{
            fontFamily: "Share Tech Mono",
            fontSize: 9,
            color: "rgba(0,212,255,0.3)",
            marginTop: 2,
          }}
        >
          pane: {prog.paneId}
        </div>
      )}
    </div>
  );
}

export const dangerBtnStyle: CSSProperties = {
  fontFamily: "Share Tech Mono",
  fontSize: 9,
  letterSpacing: "0.08em",
  padding: "2px 8px",
  cursor: "pointer",
  border: "1px solid rgba(255,51,51,0.5)",
  background: "rgba(255,51,51,0.1)",
  color: "#ff3333",
};

export const cancelBtnStyle: CSSProperties = {
  fontFamily: "Share Tech Mono",
  fontSize: 9,
  letterSpacing: "0.08em",
  padding: "2px 8px",
  cursor: "pointer",
  border: "1px solid rgba(0,212,255,0.3)",
  background: "rgba(0,212,255,0.05)",
  color: "rgba(0,212,255,0.6)",
};
