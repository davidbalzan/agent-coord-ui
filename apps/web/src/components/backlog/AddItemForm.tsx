import { useState, useRef } from "react";
import type { BacklogQueueItem } from "@coord-ui/shared";
import { PRIORITY_COLOR } from "./styles.js";

export function AddItemForm({
  onAdd,
}: {
  onAdd: (item: BacklogQueueItem) => void;
}) {
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
