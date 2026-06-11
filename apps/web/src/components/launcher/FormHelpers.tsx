import type { ReactNode } from "react";

export function Section({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        padding: "8px 12px",
        borderBottom: "1px solid rgba(0,212,255,0.06)",
      }}
    >
      <Label>{label}</Label>
      <div style={{ marginTop: 4 }}>{children}</div>
    </div>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontFamily: "Share Tech Mono",
        fontSize: 8,
        letterSpacing: "0.2em",
        color: "rgba(0,212,255,0.4)",
        textTransform: "uppercase",
        marginBottom: 2,
      }}
    >
      {children}
    </div>
  );
}

export function Hint({
  color,
  children,
}: {
  color: string;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        fontFamily: "Share Tech Mono",
        fontSize: 9,
        color,
        marginTop: 3,
        letterSpacing: "0.05em",
      }}
    >
      ⚠ {children}
    </div>
  );
}
