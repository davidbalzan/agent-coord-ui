import { describe, it, expect } from "vitest";
import { isAgentActive, AGENT_ACTIVE_THRESHOLD_MS } from "./bus.js";
import type { BusState } from "./bus.js";
import type { PaneSnapshot } from "@coord-ui/shared";

function makePane(overrides: Partial<PaneSnapshot> = {}): PaneSnapshot {
  return {
    id: "%1",
    pid: 100,
    title: "",
    command: "node",
    session: "main",
    window: 0,
    pane: 0,
    active: true,
    lastActivity: 0,
    cwd: "/workspace",
    left: 0,
    top: 0,
    width: 80,
    height: 24,
    lines: [],
    ...overrides,
  };
}

function makeState(
  panes: PaneSnapshot[],
  nowTick = Date.now()
): Pick<BusState, "panes" | "nowTick"> {
  return {
    panes: Object.fromEntries(panes.map((p) => [p.id, p])),
    nowTick,
  };
}

describe("isAgentActive", () => {
  it("returns false when no pane matches the agentId", () => {
    const s = makeState([makePane({ id: "%1", agentId: "other-agent" })]);
    expect(isAgentActive(s as BusState, "target-agent")).toBe(false);
  });

  it("returns false when pane has no agentId", () => {
    const s = makeState([makePane({ id: "%1", agentId: undefined })]);
    expect(isAgentActive(s as BusState, "target-agent")).toBe(false);
  });

  it("returns true when pane lastActivity is within threshold", () => {
    const now = Date.now();
    const s = makeState(
      [makePane({ id: "%1", agentId: "agent-x", lastActivity: now - 1000 })],
      now
    );
    expect(isAgentActive(s as BusState, "agent-x")).toBe(true);
  });

  it("returns false when pane lastActivity is beyond threshold", () => {
    const now = Date.now();
    const s = makeState(
      [
        makePane({
          id: "%1",
          agentId: "agent-x",
          lastActivity: now - AGENT_ACTIVE_THRESHOLD_MS - 100,
        }),
      ],
      now
    );
    expect(isAgentActive(s as BusState, "agent-x")).toBe(false);
  });

  it("returns false when pane lastActivity is 0 (never active)", () => {
    const s = makeState([
      makePane({ id: "%1", agentId: "agent-x", lastActivity: 0 }),
    ]);
    expect(isAgentActive(s as BusState, "agent-x")).toBe(false);
  });

  it("returns true exactly at threshold boundary minus 1ms", () => {
    const now = Date.now();
    const s = makeState(
      [
        makePane({
          id: "%1",
          agentId: "agent-x",
          lastActivity: now - AGENT_ACTIVE_THRESHOLD_MS + 1,
        }),
      ],
      now
    );
    expect(isAgentActive(s as BusState, "agent-x")).toBe(true);
  });

  it("returns false at exactly the threshold", () => {
    const now = Date.now();
    const s = makeState(
      [
        makePane({
          id: "%1",
          agentId: "agent-x",
          lastActivity: now - AGENT_ACTIVE_THRESHOLD_MS,
        }),
      ],
      now
    );
    expect(isAgentActive(s as BusState, "agent-x")).toBe(false);
  });

  it("uses the first matching pane (multiple panes, one matched)", () => {
    const now = Date.now();
    const s = makeState(
      [
        makePane({ id: "%1", agentId: "agent-a", lastActivity: now - 500 }),
        makePane({ id: "%2", agentId: "agent-b", lastActivity: now - 10000 }),
      ],
      now
    );
    expect(isAgentActive(s as BusState, "agent-a")).toBe(true);
    expect(isAgentActive(s as BusState, "agent-b")).toBe(false);
  });
});
