import type { HTMLAttributes } from "react";
import {
  PREFIX_COLORS,
  PREFIX_COLOR_FALLBACK,
  FONT_MONO,
} from "../../theme/tokens.js";

interface SeverityBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  prefix: string;
}

export function SeverityBadge({ prefix, style, ...rest }: SeverityBadgeProps) {
  const color =
    PREFIX_COLORS[prefix as keyof typeof PREFIX_COLORS] ??
    PREFIX_COLOR_FALLBACK;

  return (
    <span
      style={{
        fontFamily: FONT_MONO,
        fontSize: 9,
        letterSpacing: "0.1em",
        color,
        border: `1px solid ${color}`,
        borderRadius: 2,
        padding: "1px 5px",
        opacity: 0.85,
        ...style,
      }}
      {...rest}
    >
      {prefix}
    </span>
  );
}
