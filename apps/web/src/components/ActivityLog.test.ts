import { describe, expect, it } from "vitest";
import type { AgentSnapshot, MessageSnapshot } from "@coord-ui/shared";
import {
  appendActivityEntries,
  formatActivityLabel,
  isCoordinatorSender,
  newMessagesSince,
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
