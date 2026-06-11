import { describe, expect, it } from "vitest";
import type { AgentSnapshot, MessageSnapshot } from "@coord-ui/shared";
import {
  ACTIVITY_FADE_MS,
  ACTIVITY_HOLD_MS,
  ACTIVITY_TTL_MS,
  appendActivityEntries,
  activityEntryAge,
  activityEntryOpacity,
  expireActivityEntries,
  formatActivityLabel,
  isCoordinatorSender,
  newMessagesSince,
  pauseActivityEntries,
  resumeActivityEntries,
  type ActivityLogEntry,
} from "./ActivityLog.js";

describe("ActivityLog helpers", () => {
  it("formats DMs and room posts as short ambient routes", () => {
    expect(formatActivityLabel(msg("m-1", "alice", "bob", true))).toBe(
      "alice → bob"
    );
    expect(formatActivityLabel(msg("m-2", "alice", "coord-ui", false))).toBe(
      "alice → #coord-ui"
    );
    expect(formatActivityLabel(msg("m-3", "alice", "#ops", false))).toBe(
      "alice → #ops"
    );
  });

  it("selects only messages after the last seen message", () => {
    const messages = [
      msg("m-1", "a", "b", true),
      msg("m-2", "a", "c", true),
      msg("m-3", "a", "room", false),
    ];

    expect(newMessagesSince(messages, { id: "m-1", count: 1 })).toEqual([
      messages[1],
      messages[2],
    ]);
  });

  it("falls back to count when the last seen id is no longer present", () => {
    const messages = [msg("m-3", "a", "b", true), msg("m-4", "a", "b", true)];

    expect(newMessagesSince(messages, { id: "m-2", count: 1 })).toEqual([
      messages[1],
    ]);
  });

  it("caps visible entries to protect the corner from bursts", () => {
    const existing: ActivityLogEntry[] = [
      { id: "old-1", label: "old → one", isCoordinator: false, createdAt: 1 },
      { id: "old-2", label: "old → two", isCoordinator: false, createdAt: 1 },
    ];
    const entries = appendActivityEntries(
      existing,
      [
        msg("m-1", "a", "b", true),
        msg("m-2", "c", "d", true),
        msg("m-3", "e", "f", true),
      ],
      {},
      100,
      3
    );

    expect(entries.map((entry) => entry.label)).toEqual([
      "a → b",
      "c → d",
      "e → f",
    ]);
  });

  it("keeps each line fully visible before fading it independently", () => {
    expect(activityEntryOpacity(ACTIVITY_HOLD_MS - 1, false)).toBe(1);
    expect(activityEntryOpacity(ACTIVITY_HOLD_MS, false)).toBe(1);
    expect(
      activityEntryOpacity(ACTIVITY_HOLD_MS + ACTIVITY_FADE_MS / 2, false)
    ).toBe(0.5);
    expect(activityEntryOpacity(ACTIVITY_TTL_MS, false)).toBe(0);
  });

  it("removes only entries that have completed their own lifecycle", () => {
    const entries: ActivityLogEntry[] = [
      {
        id: "fresh",
        label: "fresh → #room",
        isCoordinator: false,
        createdAt: 1000,
      },
      {
        id: "expired",
        label: "expired → #room",
        isCoordinator: false,
        createdAt: 999,
      },
    ];

    expect(
      expireActivityEntries(entries, 1000 + ACTIVITY_TTL_MS - 1).map(
        (entry) => entry.id
      )
    ).toEqual(["fresh"]);
  });

  it("restores full opacity while hovered and resumes from the paused age", () => {
    const entries: ActivityLogEntry[] = [
      {
        id: "fading",
        label: "fading → #room",
        isCoordinator: false,
        createdAt: 1000,
      },
    ];
    const pauseAt = 1000 + ACTIVITY_HOLD_MS + 1000;
    const [paused] = pauseActivityEntries(entries, pauseAt);

    expect(activityEntryAge(paused!, pauseAt + 5000)).toBe(
      ACTIVITY_HOLD_MS + 1000
    );
    expect(activityEntryOpacity(activityEntryAge(paused!, pauseAt), true)).toBe(
      1
    );

    const [resumed] = resumeActivityEntries([paused!], pauseAt + 5000);

    expect(activityEntryAge(resumed!, pauseAt + 5000)).toBe(
      ACTIVITY_HOLD_MS + 1000
    );
    expect(activityEntryAge(resumed!, pauseAt + 6000)).toBe(
      ACTIVITY_HOLD_MS + 2000
    );
  });

  it("marks coordinator senders by role, with fallback only when role is absent", () => {
    const agents: Record<string, AgentSnapshot> = {
      coord: agent("coord", "human-name", "coordinator"),
      fallback: agent("fallback", "coord-ui-coordinator"),
      worker: agent("worker", "coord-worker", "repo-owner"),
    };

    expect(isCoordinatorSender("coord", agents)).toBe(true);
    expect(isCoordinatorSender("fallback", agents)).toBe(true);
    expect(isCoordinatorSender("worker", agents)).toBe(false);
  });
});

function msg(
  id: string,
  from: string,
  to: string,
  isDM: boolean
): MessageSnapshot {
  return {
    id,
    from,
    to,
    isDM,
    body: "payload",
    timestamp: 100,
  };
}

function agent(id: string, name: string, role?: string): AgentSnapshot {
  return {
    id,
    name,
    status: "active",
    rooms: [],
    lastSeen: 100,
    metadata: role ? { role } : undefined,
  };
}
