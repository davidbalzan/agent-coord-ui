import { useEffect, useState, useRef } from "react";
import { useBusStore } from "../store/bus.js";
import type { BacklogQueueItem, BacklogDoneItem } from "@coord-ui/shared";
import { matchQueueToDone } from "../lib/matchQueueToDone.js";
import { GlassPanel } from "./primitives/GlassPanel.js";

const PRIORITY_COLOR: Record<string, string> = {
  P1: "#ff4e4e",
  P2: "#ff8c00",
  P3: "#7b6fff",
};

// ─── Read-only sub-components ─────────────────────────────────────────────────

function PriorityBadge({ p }: { p: string }) {
  const color = PRIORITY_COLOR[p] ?? "#00d4ff";
  return (
    <span
      style={{
        fontFamily: "Share Tech Mono, monospace",
        fontSize: 10,
        letterSpacing: "0.12em",
        color,
        border: `1px solid ${color}`,
        borderRadius: 2,
        padding: "2px 6px",
        flexShrink: 0,
        opacity: 0.9,
      }}
    >
      {p}
    </span>
  );
}

function QueueItemRow({
  item,
  editMode,
  doneMatch,
  onEdit,
  onMoveUp,
  onMoveDown,
  onRemove,
  isFirst,
  isLast,
}: {
  item: BacklogQueueItem;
  editMode: boolean;
  doneMatch: BacklogDoneItem | null;
  onEdit: (field: "priority" | "text", value: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "8px 0",
        borderBottom: "1px solid rgba(0,212,255,0.07)",
        opacity: doneMatch && !editMode ? 0.65 : 1,
      }}
    >
      <span
        style={{
          flexShrink: 0,
          marginTop: 3,
          width: 14,
          height: 14,
          border: "1px solid rgba(0,212,255,0.3)",
          borderRadius: 2,
          display: "inline-block",
        }}
      />
      {editMode ? (
        <select
          value={item.priority}
          onChange={(e) => onEdit("priority", e.target.value)}
          style={{
            flexShrink: 0,
            background: "rgba(0,8,22,0.95)",
            border: `1px solid ${PRIORITY_COLOR[item.priority] ?? "#00d4ff"}`,
            color: PRIORITY_COLOR[item.priority] ?? "#00d4ff",
            fontFamily: "Share Tech Mono, monospace",
            fontSize: 10,
            padding: "1px 4px",
            borderRadius: 2,
            cursor: "pointer",
          }}
        >
          <option value="P1">P1</option>
          <option value="P2">P2</option>
          <option value="P3">P3</option>
        </select>
      ) : (
        <PriorityBadge p={item.priority} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        {editMode ? (
          <textarea
            value={item.text}
            onChange={(e) => onEdit("text", e.target.value)}
            rows={2}
            style={{
              width: "100%",
              background: "rgba(0,8,22,0.9)",
              border: "1px solid rgba(0,212,255,0.3)",
              color: "rgba(0,212,255,0.95)",
              fontFamily: "Share Tech Mono, monospace",
              fontSize: 13,
              lineHeight: 1.5,
              padding: "4px 8px",
              resize: "vertical",
              borderRadius: 2,
              boxSizing: "border-box",
            }}
          />
        ) : (
          <div
            style={{
              fontFamily: "Share Tech Mono, monospace",
              fontSize: 13,
              color: doneMatch ? "rgba(0,212,255,0.55)" : "rgba(0,212,255,0.9)",
              lineHeight: 1.5,
              wordBreak: "break-word",
              textDecoration: doneMatch ? "line-through" : "none",
            }}
          >
            {item.text}
          </div>
        )}
        {doneMatch && !editMode && (
          <div
            style={{
              marginTop: 4,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span
              style={{
                fontFamily: "Share Tech Mono, monospace",
                fontSize: 8,
                letterSpacing: "0.12em",
                color: "#00ff88",
                border: "1px solid rgba(0,255,136,0.35)",
                borderRadius: 2,
                padding: "1px 6px",
              }}
            >
              DONE ✓
            </span>
            {doneMatch.ref && (
              <span
                style={{
                  fontFamily: "Share Tech Mono, monospace",
                  fontSize: 9,
                  color: "rgba(0,255,136,0.45)",
                }}
              >
                {doneMatch.ref}
              </span>
            )}
            {doneMatch.date && (
              <span
                style={{
                  fontFamily: "Share Tech Mono, monospace",
                  fontSize: 9,
                  color: "rgba(0,212,255,0.25)",
                }}
              >
                {doneMatch.date}
              </span>
            )}
          </div>
        )}
      </div>
      {/* Per-item prune button (read-only mode, matched items only) */}
      {!editMode && doneMatch && (
        <button
          onClick={onRemove}
          title="Remove from queue"
          style={{
            flexShrink: 0,
            background: "none",
            border: "1px solid rgba(0,255,136,0.25)",
            color: "rgba(0,255,136,0.55)",
            fontFamily: "Share Tech Mono, monospace",
            fontSize: 9,
            padding: "2px 8px",
            cursor: "pointer",
            borderRadius: 2,
            letterSpacing: "0.08em",
            marginTop: 2,
          }}
        >
          PRUNE
        </button>
      )}
      {editMode && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 3,
            flexShrink: 0,
          }}
        >
          <button
            onClick={onMoveUp}
            disabled={isFirst}
            style={reorderBtnStyle(isFirst)}
            title="Move up"
          >
            ↑
          </button>
          <button
            onClick={onMoveDown}
            disabled={isLast}
            style={reorderBtnStyle(isLast)}
            title="Move down"
          >
            ↓
          </button>
          <button
            onClick={onRemove}
            style={{
              ...reorderBtnStyle(false),
              color: "rgba(255,78,78,0.7)",
              borderColor: "rgba(255,78,78,0.3)",
            }}
            title="Remove"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

function DoneItemRow({ item }: { item: BacklogDoneItem }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "7px 0",
        borderBottom: "1px solid rgba(0,212,255,0.04)",
        opacity: 0.6,
      }}
    >
      <span
        style={{
          flexShrink: 0,
          marginTop: 3,
          width: 14,
          height: 14,
          border: "1px solid rgba(0,255,136,0.3)",
          borderRadius: 2,
          background: "rgba(0,255,136,0.12)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 9,
          color: "#00ff88",
        }}
      >
        ✓
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: "Share Tech Mono, monospace",
            fontSize: 12,
            color: "rgba(0,212,255,0.65)",
            textDecoration: "line-through",
            wordBreak: "break-word",
            lineHeight: 1.5,
          }}
        >
          {item.text}
        </div>
        {(item.ref || item.date) && (
          <div style={{ display: "flex", gap: 10, marginTop: 3 }}>
            {item.ref && (
              <span
                style={{
                  fontFamily: "Share Tech Mono, monospace",
                  fontSize: 10,
                  color: "rgba(0,255,136,0.5)",
                  letterSpacing: "0.04em",
                }}
              >
                {item.ref}
              </span>
            )}
            {item.date && (
              <span
                style={{
                  fontFamily: "Share Tech Mono, monospace",
                  fontSize: 10,
                  color: "rgba(0,212,255,0.28)",
                }}
              >
                {item.date}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Add-item form ─────────────────────────────────────────────────────────────

function AddItemForm({ onAdd }: { onAdd: (item: BacklogQueueItem) => void }) {
  const [priority, setPriority] = useState<"P1" | "P2" | "P3">("P2");
  const [text, setText] = useState("");
  const textRef = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onAdd({ priority, text: t, refs: "", checked: false });
    setText("");
    textRef.current?.focus();
  };

  return (
    <div
      style={{
        marginTop: 12,
        padding: "10px 12px",
        border: "1px solid rgba(0,212,255,0.15)",
        borderRadius: 4,
        background: "rgba(0,212,255,0.03)",
      }}
    >
      <div
        style={{
          fontFamily: "Share Tech Mono, monospace",
          fontSize: 9,
          letterSpacing: "0.15em",
          color: "rgba(0,212,255,0.4)",
          marginBottom: 8,
        }}
      >
        NEW ITEM
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as "P1" | "P2" | "P3")}
          style={{
            flexShrink: 0,
            background: "rgba(0,8,22,0.95)",
            border: `1px solid ${PRIORITY_COLOR[priority]}`,
            color: PRIORITY_COLOR[priority],
            fontFamily: "Share Tech Mono, monospace",
            fontSize: 10,
            padding: "3px 6px",
            borderRadius: 2,
          }}
        >
          <option value="P1">P1</option>
          <option value="P2">P2</option>
          <option value="P3">P3</option>
        </select>
        <textarea
          ref={textRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Task description…"
          rows={2}
          style={{
            flex: 1,
            background: "rgba(0,8,22,0.9)",
            border: "1px solid rgba(0,212,255,0.25)",
            color: "rgba(0,212,255,0.9)",
            fontFamily: "Share Tech Mono, monospace",
            fontSize: 12,
            padding: "4px 8px",
            resize: "vertical",
            borderRadius: 2,
          }}
        />
        <button
          onClick={submit}
          disabled={!text.trim()}
          style={{
            flexShrink: 0,
            background: text.trim()
              ? "rgba(0,212,255,0.12)"
              : "rgba(0,212,255,0.03)",
            border: "1px solid rgba(0,212,255,0.3)",
            color: text.trim() ? "#00d4ff" : "rgba(0,212,255,0.25)",
            fontFamily: "Share Tech Mono, monospace",
            fontSize: 10,
            padding: "4px 12px",
            borderRadius: 2,
            cursor: text.trim() ? "pointer" : "default",
            letterSpacing: "0.08em",
          }}
        >
          ADD
        </button>
      </div>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function BacklogPanel() {
  const backlogs = useBusStore((s) => s.backlogs);
  const fetchBacklogs = useBusStore((s) => s.fetchBacklogs);
  const saveBacklogQueue = useBusStore((s) => s.saveBacklogQueue);
  const openBacklogProject = useBusStore((s) => s.openBacklogProject);
  const setOpenBacklogProject = useBusStore((s) => s.setOpenBacklogProject);

  const backlog =
    backlogs.find((b) => b.project === openBacklogProject) ?? null;

  // Edit mode state (draft queue — not saved yet)
  const [editMode, setEditMode] = useState(false);
  const [draftQueue, setDraftQueue] = useState<BacklogQueueItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [pruning, setPruning] = useState(false);

  // Reset edit state whenever the project changes or panel closes
  useEffect(() => {
    setEditMode(false);
    setDraftQueue([]);
  }, [openBacklogProject]);

  const enterEdit = () => {
    setDraftQueue(backlog?.queue.map((item) => ({ ...item })) ?? []);
    setEditMode(true);
  };

  const cancelEdit = () => {
    setEditMode(false);
    setDraftQueue([]);
  };

  const save = async () => {
    if (!openBacklogProject) return;
    setSaving(true);
    try {
      await saveBacklogQueue(openBacklogProject, draftQueue);
      setEditMode(false);
      setDraftQueue([]);
    } finally {
      setSaving(false);
    }
  };

  const updateItem = (
    idx: number,
    field: "priority" | "text",
    value: string
  ) => {
    setDraftQueue((q) =>
      q.map((item, i) => (i === idx ? { ...item, [field]: value } : item))
    );
  };

  const moveItem = (idx: number, dir: -1 | 1) => {
    setDraftQueue((q) => {
      const next = [...q];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return q;
      [next[idx], next[target]] = [next[target]!, next[idx]!];
      return next;
    });
  };

  const removeItem = (idx: number) => {
    setDraftQueue((q) => q.filter((_, i) => i !== idx));
  };

  const addItem = (item: BacklogQueueItem) => {
    setDraftQueue((q) => [...q, item]);
  };

  // Prune a single matched item immediately (no edit mode needed)
  const pruneItem = async (idx: number) => {
    if (!openBacklogProject || !backlog) return;
    const newQueue = backlog.queue.filter((_, i) => i !== idx);
    setPruning(true);
    try {
      await saveBacklogQueue(openBacklogProject, newQueue);
    } finally {
      setPruning(false);
    }
  };

  // Bulk-prune all matched items after confirmation
  const clearCompleted = async () => {
    if (!openBacklogProject || !backlog) return;
    const matches = matchQueueToDone(backlog.queue, backlog.done);
    const matchCount = matches.filter(Boolean).length;
    if (matchCount === 0) return;
    if (
      !window.confirm(
        `Remove ${matchCount} completed item${matchCount !== 1 ? "s" : ""} from ## Queue? ## Done is untouched.`
      )
    )
      return;
    const newQueue = backlog.queue.filter((_, i) => matches[i] === null);
    setPruning(true);
    try {
      await saveBacklogQueue(openBacklogProject, newQueue);
    } finally {
      setPruning(false);
    }
  };

  if (!openBacklogProject) return null;

  const projectName =
    openBacklogProject.split("/").filter(Boolean).pop() ?? openBacklogProject;
  const displayQueue = editMode ? draftQueue : (backlog?.queue ?? []);
  const displayDone = backlog?.done ?? [];

  // Match live queue against done for badge/prune affordances (read-only mode only)
  const doneMatches = editMode
    ? displayQueue.map(() => null)
    : matchQueueToDone(displayQueue, displayDone);
  const completedCount = doneMatches.filter(Boolean).length;

  return (
    <GlassPanel
      background="linear-gradient(180deg, rgba(0,8,22,0.98) 0%, rgba(0,4,14,0.99) 100%)"
      style={{
        position: "fixed",
        top: 56,
        right: 0,
        width: 520,
        height: "calc(100vh - 56px)",
        borderLeft: "1px solid rgba(0,212,255,0.2)",
        boxShadow: "-6px 0 40px rgba(0,212,255,0.07)",
        display: "flex",
        flexDirection: "column",
        zIndex: 200,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "14px 18px",
          borderBottom: "1px solid rgba(0,212,255,0.15)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
          gap: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            minWidth: 0,
          }}
        >
          <span
            style={{
              fontFamily: "Share Tech Mono, monospace",
              fontSize: 9,
              color: "rgba(255,170,0,0.6)",
              letterSpacing: "0.15em",
              flexShrink: 0,
            }}
          >
            ◈
          </span>
          <span
            style={{
              fontFamily: "Orbitron, sans-serif",
              fontSize: 11,
              letterSpacing: "0.18em",
              color: "#00d4ff",
              textShadow: "0 0 8px rgba(0,212,255,0.6)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {projectName.toUpperCase()}
          </span>
          {!editMode && (
            <span
              style={{
                fontFamily: "Share Tech Mono, monospace",
                fontSize: 8,
                color: "rgba(0,212,255,0.3)",
                letterSpacing: "0.1em",
                flexShrink: 0,
              }}
            >
              READ-ONLY
            </span>
          )}
          {editMode && (
            <span
              style={{
                fontFamily: "Share Tech Mono, monospace",
                fontSize: 8,
                color: "rgba(255,170,0,0.7)",
                letterSpacing: "0.1em",
                border: "1px solid rgba(255,170,0,0.3)",
                borderRadius: 2,
                padding: "1px 6px",
                flexShrink: 0,
              }}
            >
              EDITING
            </span>
          )}
        </div>
        <div
          style={{
            display: "flex",
            gap: 6,
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          {editMode ? (
            <>
              <button
                onClick={save}
                disabled={saving}
                style={actionBtnStyle(
                  "rgba(0,255,136,0.15)",
                  "rgba(0,255,136,0.5)",
                  "#00ff88"
                )}
              >
                {saving ? "…" : "SAVE"}
              </button>
              <button
                onClick={cancelEdit}
                style={actionBtnStyle(
                  "rgba(255,78,78,0.1)",
                  "rgba(255,78,78,0.4)",
                  "#ff4e4e"
                )}
              >
                CANCEL
              </button>
            </>
          ) : (
            <button
              onClick={enterEdit}
              style={actionBtnStyle(
                "rgba(255,170,0,0.08)",
                "rgba(255,170,0,0.35)",
                "rgba(255,170,0,0.8)"
              )}
              title="Edit queue"
            >
              ✎ EDIT
            </button>
          )}
          <button
            onClick={() => {
              void fetchBacklogs();
            }}
            style={iconBtnStyle}
            title="Refresh"
          >
            ↻
          </button>
          <button
            onClick={() => setOpenBacklogProject(null)}
            style={{ ...iconBtnStyle, fontSize: 16 }}
          >
            ×
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px" }}>
        {!backlog ? (
          <div style={emptyStyle}>Loading…</div>
        ) : (
          <>
            {/* Queue section */}
            <div style={{ marginBottom: 28 }}>
              <div style={sectionHeadStyle}>
                QUEUE
                <span style={{ color: "rgba(0,212,255,0.3)", marginLeft: 8 }}>
                  · {displayQueue.length}
                </span>
                {!editMode && completedCount > 0 && (
                  <button
                    onClick={() => void clearCompleted()}
                    disabled={pruning}
                    title={`Remove ${completedCount} completed item${completedCount !== 1 ? "s" : ""} from queue`}
                    style={{
                      marginLeft: "auto",
                      background: pruning
                        ? "rgba(0,255,136,0.04)"
                        : "rgba(0,255,136,0.08)",
                      border: "1px solid rgba(0,255,136,0.3)",
                      color: pruning ? "rgba(0,255,136,0.35)" : "#00ff88",
                      fontFamily: "Share Tech Mono, monospace",
                      fontSize: 8,
                      letterSpacing: "0.12em",
                      padding: "2px 10px",
                      cursor: pruning ? "default" : "pointer",
                      borderRadius: 2,
                    }}
                  >
                    {pruning ? "…" : `CLEAR ${completedCount} DONE`}
                  </button>
                )}
              </div>
              {displayQueue.length === 0 && (
                <div style={emptyStyle}>Queue is empty</div>
              )}
              {displayQueue.map((item, i) => (
                <QueueItemRow
                  key={i}
                  item={item}
                  editMode={editMode}
                  doneMatch={doneMatches[i] ?? null}
                  onEdit={(f, v) => updateItem(i, f, v)}
                  onMoveUp={() => moveItem(i, -1)}
                  onMoveDown={() => moveItem(i, 1)}
                  onRemove={
                    editMode ? () => removeItem(i) : () => void pruneItem(i)
                  }
                  isFirst={i === 0}
                  isLast={i === displayQueue.length - 1}
                />
              ))}
              {editMode && <AddItemForm onAdd={addItem} />}
            </div>

            {/* Done section */}
            <div>
              <div style={sectionHeadStyle}>
                DONE
                <span style={{ color: "rgba(0,212,255,0.3)", marginLeft: 8 }}>
                  · {displayDone.length}
                </span>
                <span
                  style={{
                    marginLeft: 10,
                    fontFamily: "Share Tech Mono, monospace",
                    fontSize: 8,
                    color: "rgba(0,212,255,0.2)",
                    letterSpacing: "0.1em",
                  }}
                >
                  [coordinator-owned · read-only]
                </span>
              </div>
              {displayDone.map((item, i) => (
                <DoneItemRow key={i} item={item} />
              ))}
            </div>
          </>
        )}
      </div>
    </GlassPanel>
  );
}

// ─── Style helpers ────────────────────────────────────────────────────────────

const sectionHeadStyle: React.CSSProperties = {
  fontFamily: "Share Tech Mono, monospace",
  fontSize: 9,
  letterSpacing: "0.2em",
  color: "rgba(0,212,255,0.4)",
  marginBottom: 8,
  display: "flex",
  alignItems: "center",
};

const emptyStyle: React.CSSProperties = {
  fontFamily: "Share Tech Mono, monospace",
  fontSize: 11,
  color: "rgba(0,212,255,0.2)",
  textAlign: "center",
  marginTop: 32,
  letterSpacing: "0.06em",
};

const iconBtnStyle: React.CSSProperties = {
  background: "none",
  border: "1px solid rgba(0,212,255,0.2)",
  color: "rgba(0,212,255,0.5)",
  fontFamily: "Share Tech Mono, monospace",
  fontSize: 11,
  letterSpacing: "0.08em",
  padding: "3px 8px",
  cursor: "pointer",
  borderRadius: 2,
};

function actionBtnStyle(
  bg: string,
  border: string,
  color: string
): React.CSSProperties {
  return {
    background: bg,
    border: `1px solid ${border}`,
    color,
    fontFamily: "Share Tech Mono, monospace",
    fontSize: 9,
    letterSpacing: "0.12em",
    padding: "3px 10px",
    cursor: "pointer",
    borderRadius: 2,
  };
}

function reorderBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    background: "none",
    border: "1px solid rgba(0,212,255,0.2)",
    color: disabled ? "rgba(0,212,255,0.15)" : "rgba(0,212,255,0.55)",
    fontFamily: "Share Tech Mono, monospace",
    fontSize: 10,
    padding: "1px 5px",
    cursor: disabled ? "default" : "pointer",
    borderRadius: 2,
    lineHeight: 1.2,
  };
}
