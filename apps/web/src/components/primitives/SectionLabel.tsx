import type { HTMLAttributes } from "react";
import { FONT_MONO } from "../../theme/tokens.js";

interface SectionLabelProps extends HTMLAttributes<HTMLDivElement> {
  color?: string;
}

export function SectionLabel({
  color = "rgba(0,212,255,0.4)",
  style,
  ...rest
}: SectionLabelProps) {
  return (
    <div
      style={{
        fontFamily: FONT_MONO,
        fontSize: 9,
        letterSpacing: "0.2em",
        color,
        marginBottom: 8,
        display: "flex",
        alignItems: "center",
        ...style,
      }}
      {...rest}
    />
  );
}
