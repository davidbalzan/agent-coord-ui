import type { BacklogQueueItem, BacklogDoneItem } from "@coord-ui/shared";
import { PRIORITY_COLOR, reorderBtnStyle } from "./styles.js";

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

export function QueueItemRow({
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

export function DoneItemRow({ item }: { item: BacklogDoneItem }) {
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
