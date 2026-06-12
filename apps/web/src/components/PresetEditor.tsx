import { useState, useCallback } from "react";
import type { AgentPreset, AgentRole } from "@coord-ui/shared";
import { useBusStore } from "../store/bus.js";
import { HoloButton } from "./primitives/HoloButton.js";
import { FONT_MONO, FONT_DISPLAY } from "../theme/tokens.js";

const API_BASE = "/api/agents/presets";

const EMPTY_FORM: Omit<AgentPreset, "id"> & { id: string } = {
  id: "",
  label: "",
  model: "claude-sonnet-4-6",
  role: "worker",
  lane: "",
  rooms: [],
  repoPath: "",
  launchCmd: "claude",
  skillInvocation: "/coord-worker --id={agentId}",
};

interface Props {
  onBack: () => void;
}

export function PresetEditor({ onBack }: Props) {
  const presets = useBusStore((s) => s.presets);
  const fetchPresets = useBusStore((s) => s.fetchPresets);

  const [editing, setEditing] = useState<AgentPreset | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const startCreate = () => {
    setForm({ ...EMPTY_FORM });
    setEditing(null);
    setCreating(true);
    setError(null);
  };

  const startEdit = (preset: AgentPreset) => {
    setForm({
      ...preset,
      lane: preset.lane ?? "",
      repoPath: preset.repoPath ?? "",
      rooms: preset.rooms ?? [],
    });
    setEditing(preset);
    setCreating(false);
    setError(null);
  };

  const cancelForm = () => {
    setCreating(false);
    setEditing(null);
    setError(null);
  };

  const handleSave = useCallback(async () => {
    setError(null);
    setSaving(true);
    try {
      const body: AgentPreset = {
        ...form,
        lane: form.lane || undefined,
        repoPath: form.repoPath || undefined,
        rooms: form.rooms?.length ? form.rooms : undefined,
      };
      const isNew = creating;
      const url = isNew ? API_BASE : `${API_BASE}/${editing!.id}`;
      const method = isNew ? "POST" : "PUT";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? `HTTP ${res.status}`);
        return;
      }
      await fetchPresets();
      cancelForm();
    } catch (e) {
      setError(e instanceof Error ? e.message : "request failed");
    } finally {
      setSaving(false);
    }
  }, [form, creating, editing, fetchPresets]);

  const handleDelete = useCallback(
    async (id: string) => {
      setError(null);
      setSaving(true);
      try {
        const res = await fetch(`${API_BASE}/${id}`, { method: "DELETE" });
        if (!res.ok && res.status !== 204) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          setError(data.error ?? `HTTP ${res.status}`);
          return;
        }
        await fetchPresets();
        setDeleteConfirm(null);
        if (editing?.id === id) cancelForm();
      } catch (e) {
        setError(e instanceof Error ? e.message : "request failed");
      } finally {
        setSaving(false);
      }
    },
    [editing, fetchPresets]
  );

  const showForm = creating || editing !== null;

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 12px",
          borderBottom: "1px solid rgba(0,212,255,0.1)",
        }}
      >
        <button
          onClick={onBack}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "rgba(0,212,255,0.6)",
            fontFamily: FONT_MONO,
            fontSize: 11,
            padding: 0,
          }}
        >
          ← BACK
        </button>
        <span
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 9,
            letterSpacing: "0.2em",
            color: "#00d4ff",
            textShadow: "0 0 8px rgba(0,212,255,0.5)",
          }}
        >
          PRESET EDITOR
        </span>
        {!showForm && (
          <HoloButton
            style={{ marginLeft: "auto", fontSize: 9, padding: "2px 8px" }}
            onClick={startCreate}
          >
            + NEW
          </HoloButton>
        )}
      </div>

      {error && (
        <div
          style={{
            margin: "6px 12px",
            padding: "4px 8px",
            background: "rgba(255,51,51,0.08)",
            border: "1px solid rgba(255,51,51,0.3)",
            fontFamily: FONT_MONO,
            fontSize: 9,
            color: "#ff3333",
          }}
        >
          ⚠ {error}
        </div>
      )}

      {/* Preset list */}
      {!showForm && (
        <div style={{ padding: "6px 12px" }}>
          {presets.length === 0 && (
            <div
              style={{
                fontFamily: FONT_MONO,
                fontSize: 10,
                color: "rgba(0,212,255,0.3)",
                textAlign: "center",
                padding: "12px 0",
              }}
            >
              no presets — create one
            </div>
          )}
          {presets.map((p) => (
            <div
              key={p.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "5px 0",
                borderBottom: "1px solid rgba(0,212,255,0.06)",
              }}
            >
              <div>
                <div
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: 10,
                    color: "#8ecfff",
                  }}
                >
                  {p.label}
                </div>
                <div
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: 8,
                    color: "rgba(0,212,255,0.3)",
                    letterSpacing: "0.08em",
                  }}
                >
                  {p.id} · {p.role} · {p.model}
                </div>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                {deleteConfirm === p.id ? (
                  <>
                    <button
                      style={dangerBtnStyle}
                      disabled={saving}
                      onClick={() => handleDelete(p.id)}
                    >
                      DEL
                    </button>
                    <button
                      style={cancelBtnStyle}
                      onClick={() => setDeleteConfirm(null)}
                    >
                      ×
                    </button>
                  </>
                ) : (
                  <>
                    <button style={cancelBtnStyle} onClick={() => startEdit(p)}>
                      EDIT
                    </button>
                    <button
                      style={{ ...dangerBtnStyle, opacity: 0.6 }}
                      onClick={() => setDeleteConfirm(p.id)}
                    >
                      ✕
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div style={{ padding: "8px 12px" }}>
          <FormRow label="ID">
            <input
              className="holo-input"
              style={{ width: "100%", fontSize: 11 }}
              placeholder="my-worker"
              value={form.id}
              disabled={!!editing}
              onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))}
            />
          </FormRow>
          <FormRow label="LABEL">
            <input
              className="holo-input"
              style={{ width: "100%", fontSize: 11 }}
              placeholder="My Worker"
              value={form.label}
              onChange={(e) =>
                setForm((f) => ({ ...f, label: e.target.value }))
              }
            />
          </FormRow>
          <FormRow label="MODEL">
            <input
              className="holo-input"
              style={{ width: "100%", fontSize: 11 }}
              value={form.model}
              onChange={(e) =>
                setForm((f) => ({ ...f, model: e.target.value }))
              }
            />
          </FormRow>
          <FormRow label="ROLE">
            <div style={{ display: "flex", gap: 6 }}>
              {(["coordinator", "worker"] as AgentRole[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setForm((f) => ({ ...f, role: r }))}
                  style={{
                    flex: 1,
                    padding: "3px 0",
                    fontFamily: FONT_MONO,
                    fontSize: 9,
                    cursor: "pointer",
                    border: `1px solid ${form.role === r ? "rgba(0,212,255,0.8)" : "rgba(0,212,255,0.2)"}`,
                    background:
                      form.role === r
                        ? "rgba(0,212,255,0.15)"
                        : "rgba(0,212,255,0.03)",
                    color: form.role === r ? "#00d4ff" : "rgba(0,212,255,0.5)",
                    transition: "all 0.15s",
                  }}
                >
                  {r.toUpperCase()}
                </button>
              ))}
            </div>
          </FormRow>
          <FormRow label="LANE (optional)">
            <input
              className="holo-input"
              style={{ width: "100%", fontSize: 11 }}
              placeholder="repo-owner"
              value={form.lane ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, lane: e.target.value }))}
            />
          </FormRow>
          <FormRow label="ROOMS (comma-separated)">
            <input
              className="holo-input"
              style={{ width: "100%", fontSize: 11 }}
              placeholder="general,coordui"
              value={(form.rooms ?? []).join(",")}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  rooms: e.target.value
                    ? e.target.value.split(",").map((r) => r.trim())
                    : [],
                }))
              }
            />
          </FormRow>
          <FormRow label="REPO PATH (optional)">
            <input
              className="holo-input"
              style={{ width: "100%", fontSize: 11 }}
              placeholder="/Users/you/workspace/project"
              value={form.repoPath ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, repoPath: e.target.value }))
              }
            />
          </FormRow>
          <FormRow label="LAUNCH CMD">
            <input
              className="holo-input"
              style={{ width: "100%", fontSize: 11 }}
              placeholder="claude"
              value={form.launchCmd}
              onChange={(e) =>
                setForm((f) => ({ ...f, launchCmd: e.target.value }))
              }
            />
          </FormRow>
          <FormRow label="SKILL INVOCATION">
            <input
              className="holo-input"
              style={{ width: "100%", fontSize: 11 }}
              placeholder="/coord-worker --id={agentId}"
              value={form.skillInvocation}
              onChange={(e) =>
                setForm((f) => ({ ...f, skillInvocation: e.target.value }))
              }
            />
            <div
              style={{
                fontFamily: FONT_MONO,
                fontSize: 8,
                color: "rgba(0,212,255,0.3)",
                marginTop: 3,
              }}
            >
              placeholders: {"{agentId}"} {"{lane}"} {"{rooms}"} {"{model}"}
            </div>
          </FormRow>

          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <HoloButton
              style={{ flex: 1, fontSize: 10, opacity: saving ? 0.5 : 1 }}
              disabled={saving}
              onClick={handleSave}
            >
              {saving ? "SAVING…" : creating ? "CREATE" : "UPDATE"}
            </HoloButton>
            <button
              style={{ ...cancelBtnStyle, padding: "5px 12px" }}
              onClick={cancelForm}
            >
              CANCEL
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FormRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div
        style={{
          fontFamily: FONT_MONO,
          fontSize: 8,
          letterSpacing: "0.18em",
          color: "rgba(0,212,255,0.4)",
          marginBottom: 3,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

const dangerBtnStyle: React.CSSProperties = {
  fontFamily: FONT_MONO,
  fontSize: 9,
  letterSpacing: "0.08em",
  padding: "2px 8px",
  cursor: "pointer",
  border: "1px solid rgba(255,51,51,0.5)",
  background: "rgba(255,51,51,0.1)",
  color: "#ff3333",
};

const cancelBtnStyle: React.CSSProperties = {
  fontFamily: FONT_MONO,
  fontSize: 9,
  letterSpacing: "0.08em",
  padding: "2px 8px",
  cursor: "pointer",
  border: "1px solid rgba(0,212,255,0.3)",
  background: "rgba(0,212,255,0.05)",
  color: "rgba(0,212,255,0.6)",
};
