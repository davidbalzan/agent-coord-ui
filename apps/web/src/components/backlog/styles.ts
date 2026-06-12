import type React from "react";
import { FONT_MONO } from "../../theme/tokens.js";

export const PRIORITY_COLOR: Record<string, string> = {
  P1: "#ff4e4e",
  P2: "#ff8c00",
  P3: "#7b6fff",
};

export const emptyStyle: React.CSSProperties = {
  fontFamily: FONT_MONO,
  fontSize: 11,
  color: "rgba(0,212,255,0.2)",
  textAlign: "center",
  marginTop: 32,
  letterSpacing: "0.06em",
};

export const iconBtnStyle: React.CSSProperties = {
  background: "none",
  border: "1px solid rgba(0,212,255,0.2)",
  color: "rgba(0,212,255,0.5)",
  fontFamily: FONT_MONO,
  fontSize: 11,
  letterSpacing: "0.08em",
  padding: "3px 8px",
  cursor: "pointer",
  borderRadius: 2,
};

export function actionBtnStyle(
  bg: string,
  border: string,
  color: string
): React.CSSProperties {
  return {
    background: bg,
    border: `1px solid ${border}`,
    color,
    fontFamily: FONT_MONO,
    fontSize: 9,
    letterSpacing: "0.12em",
    padding: "3px 10px",
    cursor: "pointer",
    borderRadius: 2,
  };
}

export function reorderBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    background: "none",
    border: "1px solid rgba(0,212,255,0.2)",
    color: disabled ? "rgba(0,212,255,0.15)" : "rgba(0,212,255,0.55)",
    fontFamily: FONT_MONO,
    fontSize: 10,
    padding: "1px 5px",
    cursor: disabled ? "default" : "pointer",
    borderRadius: 2,
    lineHeight: 1.2,
  };
}
