import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import type { ReactNode } from "react";

interface Props {
  body: string;
  agentIds: Set<string>;
  onHover?: (id: string | null) => void;
}

function processText(
  text: string,
  agentIds: Set<string>,
  onHover?: (id: string | null) => void
): ReactNode {
  const parts = text.split(/(@[\w-]+)/g);
  if (parts.length === 1) return text;
  return parts.map((part, i) => {
    if (!part.startsWith("@")) return part;
    const handle = part.slice(1).toLowerCase();
    const known = agentIds.has(handle);
    return (
      <span
        key={i}
        onMouseEnter={known && onHover ? () => onHover(handle) : undefined}
        onMouseLeave={known && onHover ? () => onHover(null) : undefined}
        style={{
          color: known ? "#00d4ff" : "#7b6fff",
          fontWeight: 600,
          textShadow: known
            ? "0 0 8px rgba(0,212,255,0.7)"
            : "0 0 6px rgba(123,111,255,0.5)",
          background: known ? "rgba(0,212,255,0.06)" : "rgba(123,111,255,0.06)",
          borderRadius: 2,
          padding: "0 2px",
          cursor: known && onHover ? "crosshair" : undefined,
        }}
      >
        {part}
      </span>
    );
  });
}

function withMentions(
  children: ReactNode,
  agentIds: Set<string>,
  onHover?: (id: string | null) => void
): ReactNode {
  if (typeof children === "string")
    return processText(children, agentIds, onHover);
  if (Array.isArray(children))
    return children.map((c, i) => {
      const processed = withMentions(c, agentIds, onHover);
      return Array.isArray(processed) ? (
        <span key={i}>{processed}</span>
      ) : (
        processed
      );
    });
  return children;
}

export function MdMessage({ body, agentIds, onHover }: Props) {
  const components: Components = {
    p: ({ children }) => (
      <p>{withMentions(children as ReactNode, agentIds, onHover)}</p>
    ),
    li: ({ children }) => (
      <li>{withMentions(children as ReactNode, agentIds, onHover)}</li>
    ),
  };

  return (
    <div className="md-body">
      <ReactMarkdown components={components}>{body}</ReactMarkdown>
    </div>
  );
}
