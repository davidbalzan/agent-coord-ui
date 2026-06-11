import { useState, useEffect, useCallback, useMemo } from "react";
import { useBusStore } from "../store/bus.js";
import type { LauncherPrefill } from "../store/bus.js";
import { PresetEditor } from "./PresetEditor.js";
import { GlassPanel } from "./primitives/GlassPanel.js";

const AGENT_ID_RE = /^[\w-]{1,64}$/;

const STEPS = [
  "creating",
  "launching",
  "configuring",
  "joining",
  "confirming",
  "done",
] as const;

type StepName = (typeof STEPS)[number] | "error";

const STEP_LABELS: Record<string, string> = {
  creating: "CREATE PANE",
  launching: "LAUNCH PROCESS",
  configuring: "CONFIGURE",
  joining: "JOIN BUS",
  confirming: "CONFIRM REG",
  done: "ONLINE",
  error: "ERROR",
};

interface Props {
  onClose: () => void;
  prefill?: LauncherPrefill | null;
}

export function AgentLauncher({ onClose, prefill }: Props) {
  const presets = useBusStore((s) => s.presets);
  const agents = useBusStore((s) => s.agents);
  const spawnProgress = useBusStore((s) => s.spawnProgress);
  const fetchPresets = useBusStore((s) => s.fetchPresets);
  const spawnAgent = useBusStore((s) => s.spawnAgent);
  const teardownAgent = useBusStore((s) => s.teardownAgent);
  const clearSpawnProgress = useBusStore((s) => s.clearSpawnProgress);
  // Derive terminal groups from pane session data with useMemo to avoid
  // the infinite re-render loop that results from calling a selector that
  // returns a new array reference on every invocation.
  const panesMap = useBusStore((s) => s.panes);
  const groups = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const pane of Object.values(panesMap)) {
      const list = map.get(pane.session) ?? [];
      list.push(pane.id);
      map.set(pane.session, list);
    }
    return Array.from(map.entries()).map(([session, paneIds]) => ({
      id: session,
      label: session,
      paneIds,
    }));
  }, [panesMap]);

  const [selectedPresetId, setSelectedPresetId] = useState(
    prefill?.presetId ?? ""
  );
  const [agentId, setAgentId] = useState("");
  const [paneKind, setPaneKind] = useState<
    "split-window" | "new-window" | "new-session"
  >(prefill?.paneKind ?? "split-window");
  const [paneTarget, setPaneTarget] = useState(
    prefill?.paneKind !== "new-session" ? (prefill?.paneTarget ?? "") : ""
  );
  const [sessionName, setSessionName] = useState(
    prefill?.paneKind === "new-session" ? (prefill?.paneTarget ?? "") : ""
  );
  const [showPresetEditor, setShowPresetEditor] = useState(false);
  const [teardownConfirm, setTeardownConfirm] = useState<string | null>(null);

  useEffect(() => {
    fetchPresets();
  }, [fetchPresets]);

  const agentIdValid = AGENT_ID_RE.test(agentId);
  const agentIdCollides = agentIdValid && agentId in agents;
  const canLaunch = selectedPresetId !== "" && agentIdValid && !agentIdCollides;

  const handleLaunch = useCallback(() => {
    if (!canLaunch) return;
    // For new-session, pass the named session as paneTarget so createPane can
    // use it as the session name (e.g. tmux new-session -d -s <sessionName>).
    const resolvedTarget =
      paneKind === "new-session"
        ? sessionName.trim() || undefined
        : paneTarget.trim() || undefined;
    spawnAgent(selectedPresetId, agentId, paneKind, resolvedTarget);
  }, [
    canLaunch,
    spawnAgent,
    selectedPresetId,
    agentId,
    paneKind,
    paneTarget,
    sessionName,
  ]);

  const findPaneForAgent = useCallback(
    (id: string) => {
      const fromProgress = spawnProgress[id]?.paneId;
      if (fromProgress) return fromProgress;
      return Object.values(panesMap).find((p) => p.agentId === id)?.id;
    },
    [spawnProgress, panesMap]
  );

  const handleTeardown = useCallback(
    (id: string) => {
      const paneId = findPaneForAgent(id);
      if (!paneId) return;
      teardownAgent(id, paneId);
      setTeardownConfirm(null);
      clearSpawnProgress(id);
    },
    [findPaneForAgent, teardownAgent, clearSpawnProgress]
  );

  if (showPresetEditor) {
    return (
      <LauncherShell onClose={onClose}>
        <PresetEditor
          onBack={() => {
            setShowPresetEditor(false);
            fetchPresets();
          }}
        />
      </LauncherShell>
    );
  }

  return (
    <LauncherShell onClose={onClose}>
      {/* ── Spawn form ── */}
      <Section label="PRESET">
        <div style={{ display: "flex", gap: 6 }}>
          <select
            className="holo-input"
            style={{ flex: 1, fontSize: 11 }}
            value={selectedPresetId}
            onChange={(e) => setSelectedPresetId(e.target.value)}
          >
            <option value="">— select preset —</option>
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} [{p.role}]
              </option>
            ))}
          </select>
          <button
            className="holo-btn"
            style={{ fontSize: 9, padding: "3px 8px", flexShrink: 0 }}
            onClick={() => setShowPresetEditor(true)}
          >
            EDIT
          </button>
        </div>
        {selectedPresetId &&
          (() => {
            const p = presets.find((pr) => pr.id === selectedPresetId);
            return p ? (
              <div
                style={{
                  marginTop: 4,
                  fontFamily: "Share Tech Mono",
                  fontSize: 9,
                  color: "rgba(0,212,255,0.4)",
                  lineHeight: 1.5,
                }}
              >
                MODEL: {p.model} &nbsp;·&nbsp; LANE: {p.lane ?? "—"}{" "}
                &nbsp;·&nbsp; ROOMS: {p.rooms?.join(",") ?? "—"}
              </div>
            ) : null;
          })()}
      </Section>

      <Section label="AGENT ID">
        <input
          className="holo-input"
          style={{ width: "100%", fontSize: 11 }}
          placeholder="e.g. my-worker-01"
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
        />
        {agentId && !agentIdValid && (
          <Hint color="#ff8c00">use [a-z A-Z 0-9 _ -] only, max 64 chars</Hint>
        )}
        {agentIdCollides && (
          <Hint color="#ff3333">
            agent &quot;{agentId}&quot; already registered on bus
          </Hint>
        )}
      </Section>

      <Section label="PANE KIND">
        <div style={{ display: "flex", gap: 6 }}>
          {(["split-window", "new-window", "new-session"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setPaneKind(k)}
              style={{
                flex: 1,
                padding: "4px 0",
                fontFamily: "Share Tech Mono",
                fontSize: 9,
                letterSpacing: "0.08em",
                cursor: "pointer",
                border: `1px solid ${paneKind === k ? "rgba(0,212,255,0.8)" : "rgba(0,212,255,0.2)"}`,
                background:
                  paneKind === k
                    ? "rgba(0,212,255,0.15)"
                    : "rgba(0,212,255,0.03)",
                color: paneKind === k ? "#00d4ff" : "rgba(0,212,255,0.5)",
                boxShadow:
                  paneKind === k ? "0 0 8px rgba(0,212,255,0.3)" : "none",
                transition: "all 0.15s",
              }}
            >
              {k === "split-window"
                ? "SPLIT"
                : k === "new-window"
                  ? "WINDOW"
                  : "SESSION"}
            </button>
          ))}
        </div>
      </Section>

      {paneKind === "new-session" ? (
        <Section label="SESSION NAME (optional)">
          <input
            className="holo-input"
            style={{ width: "100%", fontSize: 11 }}
            placeholder="e.g. agents-2"
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
          />
          {groups.length > 0 && (
            <div style={{ marginTop: 4 }}>
              <div
                style={{
                  fontFamily: "Share Tech Mono",
                  fontSize: 8,
                  color: "rgba(0,212,255,0.3)",
                  marginBottom: 3,
                }}
              >
                EXISTING SESSIONS
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                {groups.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setSessionName(g.id)}
                    style={{
                      fontFamily: "Share Tech Mono",
                      fontSize: 9,
                      padding: "1px 6px",
                      cursor: "pointer",
                      border: "1px solid rgba(0,212,255,0.25)",
                      background:
                        sessionName === g.id
                          ? "rgba(0,212,255,0.15)"
                          : "rgba(0,212,255,0.04)",
                      color:
                        sessionName === g.id
                          ? "#00d4ff"
                          : "rgba(0,212,255,0.5)",
                      transition: "all 0.1s",
                    }}
                  >
                    {g.id}{" "}
                    <span style={{ opacity: 0.5 }}>({g.paneIds.length})</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </Section>
      ) : (
        <Section label="TARGET GROUP / PANE (optional)">
          <input
            className="holo-input"
            style={{ width: "100%", fontSize: 11 }}
            placeholder="default: agent-coord-ui session"
            value={paneTarget}
            onChange={(e) => setPaneTarget(e.target.value)}
          />
          {groups.length > 0 && (
            <div style={{ marginTop: 4 }}>
              <div
                style={{
                  fontFamily: "Share Tech Mono",
                  fontSize: 8,
                  color: "rgba(0,212,255,0.3)",
                  marginBottom: 3,
                }}
              >
                TERMINAL GROUPS
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                {groups.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setPaneTarget(g.id)}
                    style={{
                      fontFamily: "Share Tech Mono",
                      fontSize: 9,
                      padding: "1px 6px",
                      cursor: "pointer",
                      border: "1px solid rgba(0,212,255,0.25)",
                      background:
                        paneTarget === g.id
                          ? "rgba(0,212,255,0.15)"
                          : "rgba(0,212,255,0.04)",
                      color:
                        paneTarget === g.id ? "#00d4ff" : "rgba(0,212,255,0.5)",
                      transition: "all 0.1s",
                    }}
                  >
                    {g.id}{" "}
                    <span style={{ opacity: 0.5 }}>({g.paneIds.length})</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </Section>
      )}

      <div style={{ padding: "8px 12px" }}>
        <button
          className="holo-btn"
          style={{
            width: "100%",
            padding: "7px 0",
            fontSize: 11,
            opacity: canLaunch ? 1 : 0.4,
            cursor: canLaunch ? "pointer" : "not-allowed",
          }}
          disabled={!canLaunch}
          onClick={handleLaunch}
        >
          ▶ LAUNCH AGENT
        </button>
      </div>

      {/* ── In-flight progress ── */}
      {Object.values(spawnProgress).length > 0 && (
        <div
          style={{
            borderTop: "1px solid rgba(0,212,255,0.1)",
            padding: "8px 12px",
          }}
        >
          <Label>IN FLIGHT</Label>
          {Object.values(spawnProgress).map((prog) => (
            <ProgressCard
              key={prog.agentId}
              prog={prog}
              onDismiss={() => clearSpawnProgress(prog.agentId)}
            />
          ))}
        </div>
      )}

      {/* ── Active agents teardown ── */}
      {Object.keys(agents).length > 0 && (
        <div
          style={{
            borderTop: "1px solid rgba(0,212,255,0.1)",
            padding: "8px 12px",
          }}
        >
          <Label>ACTIVE AGENTS</Label>
          {Object.values(agents).map((agent) => {
            const paneId = findPaneForAgent(agent.id);
            return (
              <div
                key={agent.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "4px 0",
                  borderBottom: "1px solid rgba(0,212,255,0.05)",
                }}
              >
                <div
                  style={{
                    fontFamily: "Share Tech Mono",
                    fontSize: 10,
                    color: "#8ecfff",
                  }}
                >
                  <span
                    style={{
                      color:
                        agent.status === "active"
                          ? "#00ff88"
                          : agent.status === "idle"
                            ? "#ff8c00"
                            : "#ff3333",
                    }}
                  >
                    ◈
                  </span>{" "}
                  {agent.id}
                </div>
                {teardownConfirm === agent.id ? (
                  <div style={{ display: "flex", gap: 4 }}>
                    <button
                      style={dangerBtnStyle}
                      onClick={() => handleTeardown(agent.id)}
                      disabled={!paneId}
                    >
                      CONFIRM
                    </button>
                    <button
                      style={cancelBtnStyle}
                      onClick={() => setTeardownConfirm(null)}
                    >
                      CANCEL
                    </button>
                  </div>
                ) : (
                  <button
                    style={{
                      ...cancelBtnStyle,
                      opacity: paneId ? 1 : 0.3,
                      cursor: paneId ? "pointer" : "not-allowed",
                    }}
                    disabled={!paneId}
                    title={
                      paneId ? "Teardown agent" : "No pane found for this agent"
                    }
                    onClick={() => setTeardownConfirm(agent.id)}
                  >
                    TEARDOWN
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </LauncherShell>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function LauncherShell({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <GlassPanel
      background="rgba(0,8,22,0.55)"
      blur={20}
      saturate={180}
      cornerBrackets
      style={{
        position: "fixed",
        top: 64,
        right: 16,
        width: 320,
        maxHeight: "calc(100vh - 96px)",
        overflowY: "auto",
        zIndex: 200,
        display: "flex",
        flexDirection: "column",
        border: "1px solid rgba(0,212,255,0.2)",
        animation: "border-glow 3s ease-in-out infinite",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 12px",
          borderBottom: "1px solid rgba(0,212,255,0.15)",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: "Orbitron, sans-serif",
            fontWeight: 700,
            fontSize: 10,
            letterSpacing: "0.2em",
            color: "#00d4ff",
            textShadow: "0 0 10px rgba(0,212,255,0.6)",
          }}
        >
          ◈ AGENT LAUNCHER
        </span>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "rgba(0,212,255,0.5)",
            fontFamily: "Share Tech Mono",
            fontSize: 14,
            lineHeight: 1,
            padding: "2px 4px",
          }}
        >
          ×
        </button>
      </div>
      {children}
    </GlassPanel>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        padding: "8px 12px",
        borderBottom: "1px solid rgba(0,212,255,0.06)",
      }}
    >
      <Label>{label}</Label>
      <div style={{ marginTop: 4 }}>{children}</div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: "Share Tech Mono",
        fontSize: 8,
        letterSpacing: "0.2em",
        color: "rgba(0,212,255,0.4)",
        textTransform: "uppercase",
        marginBottom: 2,
      }}
    >
      {children}
    </div>
  );
}

function Hint({
  color,
  children,
}: {
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        fontFamily: "Share Tech Mono",
        fontSize: 9,
        color,
        marginTop: 3,
        letterSpacing: "0.05em",
      }}
    >
      ⚠ {children}
    </div>
  );
}

function ProgressCard({
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

const dangerBtnStyle: React.CSSProperties = {
  fontFamily: "Share Tech Mono",
  fontSize: 9,
  letterSpacing: "0.08em",
  padding: "2px 8px",
  cursor: "pointer",
  border: "1px solid rgba(255,51,51,0.5)",
  background: "rgba(255,51,51,0.1)",
  color: "#ff3333",
};

const cancelBtnStyle: React.CSSProperties = {
  fontFamily: "Share Tech Mono",
  fontSize: 9,
  letterSpacing: "0.08em",
  padding: "2px 8px",
  cursor: "pointer",
  border: "1px solid rgba(0,212,255,0.3)",
  background: "rgba(0,212,255,0.05)",
  color: "rgba(0,212,255,0.6)",
};
