import type { CSSProperties, ElementType, HTMLAttributes } from "react";

interface GlassPanelProps extends HTMLAttributes<HTMLElement> {
  /** HTML element to render. Default: "div". */
  as?: ElementType;
  /** Full CSS `background` value — solid colour or gradient. Required. */
  background: string;
  /**
   * When set, applies `backdropFilter: blur(<blur>px) saturate(<saturate>%)`.
   * Omit entirely for panels that have no blur (e.g. InboxPanel, BacklogPanel).
   */
  blur?: number;
  /** `saturate()` value to pair with `blur`. Default: 160. */
  saturate?: number;
  /**
   * Render two absolutely-positioned corner bracket elements that replicate
   * the `.holo-panel::before/::after` bracket animation. Requires the
   * containing element to be `position: relative` (set automatically).
   */
  cornerBrackets?: boolean;
}

const BRACKET_BASE: CSSProperties = {
  position: "absolute",
  width: 10,
  height: 10,
  borderColor: "#00d4ff",
  borderStyle: "solid",
  animation: "corner-spin 2s ease-in-out infinite",
};

const bracketTL: CSSProperties = {
  ...BRACKET_BASE,
  top: -1,
  left: -1,
  borderWidth: "2px 0 0 2px",
};

const bracketBR: CSSProperties = {
  ...BRACKET_BASE,
  bottom: -1,
  right: -1,
  borderWidth: "0 2px 2px 0",
};

export function GlassPanel({
  as: Tag = "div",
  background,
  blur,
  saturate = 160,
  cornerBrackets = false,
  style,
  children,
  ...rest
}: GlassPanelProps) {
  const filter =
    blur != null ? `blur(${blur}px) saturate(${saturate}%)` : undefined;

  const glassStyle: CSSProperties = {
    background,
    ...(filter
      ? { backdropFilter: filter, WebkitBackdropFilter: filter }
      : undefined),
    ...(cornerBrackets ? { position: "relative" } : undefined),
    // Consumer style always wins — spread last so position/border/etc. can override
    ...style,
  };

  return (
    <Tag {...rest} style={glassStyle}>
      {cornerBrackets && (
        <>
          <span style={bracketTL} aria-hidden="true" />
          <span style={bracketBR} aria-hidden="true" />
        </>
      )}
      {children}
    </Tag>
  );
}
