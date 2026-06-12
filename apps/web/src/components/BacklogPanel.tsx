import { useEffect, useState } from "react";
import { useBusStore } from "../store/bus.js";
import type { BacklogQueueItem } from "@coord-ui/shared";
import { matchQueueToDone } from "../lib/matchQueueToDone.js";
import { GlassPanel } from "./primitives/GlassPanel.js";
import { SectionLabel } from "./primitives/SectionLabel.js";
import { AddItemForm } from "./backlog/AddItemForm.js";
import { DoneItemRow, QueueItemRow } from "./backlog/BacklogRows.js";
import { actionBtnStyle, emptyStyle, iconBtnStyle } from "./backlog/styles.js";
import { FONT_MONO, FONT_DISPLAY } from "../theme/tokens.js";

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
              fontFamily: FONT_MONO,
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
              fontFamily: FONT_DISPLAY,
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
                fontFamily: FONT_MONO,
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
                fontFamily: FONT_MONO,
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
              <SectionLabel>
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
                      fontFamily: FONT_MONO,
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
              </SectionLabel>
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
              <SectionLabel>
                DONE
                <span style={{ color: "rgba(0,212,255,0.3)", marginLeft: 8 }}>
                  · {displayDone.length}
                </span>
                <span
                  style={{
                    marginLeft: 10,
                    fontFamily: FONT_MONO,
                    fontSize: 8,
                    color: "rgba(0,212,255,0.2)",
                    letterSpacing: "0.1em",
                  }}
                >
                  [coordinator-owned · read-only]
                </span>
              </SectionLabel>
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
