import type { BusPrefix } from "../lib/notificationPriority.js";
import type { Priority } from "../lib/notificationPriority.js";

// ── Colour primitives ──────────────────────────────────────────────────────
export const COLOR_CYAN = "#00d4ff";
export const COLOR_CYAN_DIM = "rgba(0,212,255,0.35)";
export const COLOR_GREEN = "#00ff88";
export const COLOR_RED = "#ff4e4e";
export const COLOR_ORANGE = "#ff8c00";

// ── Status ─────────────────────────────────────────────────────────────────
export const COLOR_STATUS_ACTIVE = COLOR_GREEN;
export const COLOR_STATUS_IDLE = "rgba(0,212,255,0.5)";
export const COLOR_STATUS_STALE = "rgba(0,212,255,0.2)";

// ── Room / agent tints ─────────────────────────────────────────────────────
export const COLOR_ROOM = COLOR_CYAN;
export const COLOR_AGENT = COLOR_CYAN_DIM;

// ── Canonical prefix → badge colour ───────────────────────────────────────
// Single source of truth — every badge, label, or tint derived from a bus
// prefix MUST use this map. Matches InboxPanel's current visual exactly.
export const PREFIX_COLORS = {
  DAVID_DECISION: COLOR_RED,
  BLOCKER: COLOR_RED,
  RISK: COLOR_ORANGE,
  AGENT_ACTION: COLOR_CYAN,
  DONE: COLOR_GREEN,
  FYI: COLOR_CYAN_DIM,
} as const satisfies Record<BusPrefix, string>;

export const PREFIX_COLOR_FALLBACK = COLOR_CYAN_DIM;

// ── Priority → notification accent colour ──────────────────────────────────
// Used by NotificationLayer for dock/popup tinting.
export const PRIORITY_ACCENT = {
  loud: "rgba(255,64,129,0.8)",
  dock: "rgba(255,176,0,0.75)",
  subtle: COLOR_CYAN_DIM,
} as const satisfies Record<Priority, string>;

// ── Surface ────────────────────────────────────────────────────────────────
export const COLOR_SURFACE = "rgba(0,8,22,0.97)";
export const COLOR_BG = "#000913";

// ── Typography ─────────────────────────────────────────────────────────────
export const FONT_MONO = '"Share Tech Mono", monospace';
export const FONT_DISPLAY = '"Orbitron", sans-serif';
// Nerd Font for the interactive PTY terminal: full powerline/devicon glyph
// coverage so agent shell prompts render correctly. Falls back to the UI mono.
export const FONT_TERMINAL =
  '"JetBrainsMono Nerd Font", "Share Tech Mono", monospace';

// ── Spacing (px values for inline styles) ──────────────────────────────────
export const SPACE = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;
