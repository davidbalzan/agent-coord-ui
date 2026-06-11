import { describe, it, expect } from "vitest";
import {
  PREFIX_COLORS,
  PREFIX_COLOR_FALLBACK,
  PRIORITY_ACCENT,
  COLOR_CYAN,
  COLOR_RED,
  COLOR_ORANGE,
  COLOR_GREEN,
  COLOR_CYAN_DIM,
  FONT_MONO,
  FONT_DISPLAY,
} from "./tokens.js";
import type { BusPrefix } from "../lib/notificationPriority.js";

const ALL_PREFIXES: BusPrefix[] = [
  "DAVID_DECISION",
  "BLOCKER",
  "RISK",
  "AGENT_ACTION",
  "DONE",
  "FYI",
];

describe("PREFIX_COLORS", () => {
  it("covers all BusPrefix values", () => {
    for (const prefix of ALL_PREFIXES) {
      expect(PREFIX_COLORS[prefix]).toBeTruthy();
    }
  });

  it("DAVID_DECISION and BLOCKER share the red colour", () => {
    expect(PREFIX_COLORS.DAVID_DECISION).toBe(COLOR_RED);
    expect(PREFIX_COLORS.BLOCKER).toBe(COLOR_RED);
  });

  it("RISK is orange", () => {
    expect(PREFIX_COLORS.RISK).toBe(COLOR_ORANGE);
  });

  it("AGENT_ACTION is cyan", () => {
    expect(PREFIX_COLORS.AGENT_ACTION).toBe(COLOR_CYAN);
  });

  it("DONE is green", () => {
    expect(PREFIX_COLORS.DONE).toBe(COLOR_GREEN);
  });

  it("FYI is dim cyan", () => {
    expect(PREFIX_COLORS.FYI).toBe(COLOR_CYAN_DIM);
  });

  it("fallback matches FYI/dim-cyan", () => {
    expect(PREFIX_COLOR_FALLBACK).toBe(COLOR_CYAN_DIM);
  });
});

describe("PRIORITY_ACCENT", () => {
  it("covers all Priority values", () => {
    expect(PRIORITY_ACCENT.loud).toBeTruthy();
    expect(PRIORITY_ACCENT.dock).toBeTruthy();
    expect(PRIORITY_ACCENT.subtle).toBeTruthy();
  });

  it("subtle accent matches the dim-cyan fallback", () => {
    expect(PRIORITY_ACCENT.subtle).toBe(COLOR_CYAN_DIM);
  });
});

describe("font tokens", () => {
  it("FONT_MONO includes Share Tech Mono", () => {
    expect(FONT_MONO).toContain("Share Tech Mono");
  });

  it("FONT_DISPLAY includes Orbitron", () => {
    expect(FONT_DISPLAY).toContain("Orbitron");
  });
});
