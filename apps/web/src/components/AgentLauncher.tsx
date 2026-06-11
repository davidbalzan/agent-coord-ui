import { useState, useEffect, useCallback, useMemo } from "react";
import { useBusStore } from "../store/bus.js";
import type { LauncherPrefill } from "../store/bus.js";
import { PresetEditor } from "./PresetEditor.js";
import { HoloButton } from "./primitives/HoloButton.js";
import { AGENT_ID_RE } from "./launcher/types.js";
import { LauncherShell } from "./launcher/LauncherShell.js";
import { Section, Label, Hint } from "./launcher/FormHelpers.js";
import {
  ProgressCard,
  dangerBtnStyle,
  cancelBtnStyle,
} from "./launcher/ProgressCard.js";

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
          <HoloButton
            style={{ fontSize: 9, padding: "3px 8px", flexShrink: 0 }}
            onClick={() => setShowPresetEditor(true)}
          >
            EDIT
          </HoloButton>
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
        <HoloButton
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
        </HoloButton>
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
