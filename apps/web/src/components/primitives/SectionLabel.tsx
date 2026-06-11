import type { HTMLAttributes } from "react";

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
        fontFamily: "Share Tech Mono, monospace",
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
