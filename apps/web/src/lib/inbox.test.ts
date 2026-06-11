import { describe, it, expect } from "vitest";
import { buildDavidThreads, globalUnreadCount, DAVID_ID } from "./inbox.js";
import type { MessageSnapshot } from "@coord-ui/shared";

function msg(
  id: string,
  from: string,
  to: string,
  body: string,
  timestamp: number
): MessageSnapshot {
  return { id, from, to, body, timestamp, isDM: true };
}

const coord = "coord-ui-coordinator";
const worker2 = "coord-worker-2";

const BASE_MSGS: MessageSnapshot[] = [
  msg("1", coord, DAVID_ID, "AGENT_ACTION: do something", 1000),
  msg("2", coord, DAVID_ID, "DAVID_DECISION: pick A or B", 2000),
  msg("3", DAVID_ID, coord, "ok, going with A", 3000),
  msg("4", worker2, DAVID_ID, "FYI: merged PR", 4000),
];

describe("buildDavidThreads", () => {
  it("groups by counterpart", () => {
    const threads = buildDavidThreads(BASE_MSGS, {});
    // coord has 2 unread (msgs 1, 2); worker2 has 1 unread (msg 4) → coord sorts first
    expect(threads.map((t) => t.counterpart)).toEqual([coord, worker2]);
  });

  it("excludes non-david DMs", () => {
    const msgs: MessageSnapshot[] = [
      msg("x", "agent-a", "agent-b", "hi", 1000),
      msg("y", coord, DAVID_ID, "hello", 2000),
    ];
    const threads = buildDavidThreads(msgs, {});
    expect(threads).toHaveLength(1);
    expect(threads[0].counterpart).toBe(coord);
  });

  it("excludes non-DM messages", () => {
    const msgs: MessageSnapshot[] = [
      { ...msg("r", coord, "general", "hi room", 1000), isDM: false },
      msg("d", coord, DAVID_ID, "hi david", 2000),
    ];
    const threads = buildDavidThreads(msgs, {});
    expect(threads).toHaveLength(1);
  });

  it("messages are sorted ascending by timestamp within thread", () => {
    const msgs: MessageSnapshot[] = [
      msg("b", coord, DAVID_ID, "second", 2000),
      msg("a", coord, DAVID_ID, "first", 1000),
    ];
    const threads = buildDavidThreads(msgs, {});
    expect(threads[0].messages[0].body).toBe("first");
    expect(threads[0].messages[1].body).toBe("second");
  });

  it("unread = inbound messages newer than lastRead", () => {
    const threads = buildDavidThreads(BASE_MSGS, { [coord]: 1500 });
    const coordThread = threads.find((t) => t.counterpart === coord)!;
    // msg "2" (ts=2000) is inbound and after lastRead=1500; msg "3" is outbound (david→coord) — not counted
    expect(coordThread.unreadCount).toBe(1);
  });

  it("all unread when no readState entry", () => {
    const threads = buildDavidThreads(BASE_MSGS, {});
    const coordThread = threads.find((t) => t.counterpart === coord)!;
    // inbound from coord: msg 1 (ts=1000) and msg 2 (ts=2000) → 2 unread
    expect(coordThread.unreadCount).toBe(2);
  });

  it("zero unread when lastRead >= latest inbound", () => {
    const threads = buildDavidThreads(BASE_MSGS, { [coord]: 9999 });
    const coordThread = threads.find((t) => t.counterpart === coord)!;
    expect(coordThread.unreadCount).toBe(0);
  });

  it("outbound messages (david→counterpart) never counted as unread", () => {
    const msgs: MessageSnapshot[] = [
      msg("1", DAVID_ID, coord, "my reply", 5000),
    ];
    const threads = buildDavidThreads(msgs, {});
    expect(threads[0].unreadCount).toBe(0);
  });

  it("DAVID_DECISION stays unread until thread is explicitly opened", () => {
    // readState not set → DAVID_DECISION msg is unread
    const msgs: MessageSnapshot[] = [
      msg("dd", coord, DAVID_ID, "DAVID_DECISION: approve deploy?", 1000),
    ];
    const threads = buildDavidThreads(msgs, {});
    expect(threads[0].unreadCount).toBe(1);
    // after mark-read (lastRead = 1000)
    const threads2 = buildDavidThreads(msgs, { [coord]: 1000 });
    expect(threads2[0].unreadCount).toBe(0);
  });

  it("threads sorted: unread first, then by latestTimestamp desc", () => {
    const msgs: MessageSnapshot[] = [
      // coord: 2 inbound msgs, latest at 5000
      msg("c1", coord, DAVID_ID, "hi", 1000),
      msg("c2", coord, DAVID_ID, "again", 5000),
      // worker2: no inbound msgs (read), latest at 9000
      msg("w1", worker2, DAVID_ID, "hey", 9000),
    ];
    const readState = { [worker2]: 9000 }; // worker2 fully read
    const threads = buildDavidThreads(msgs, readState);
    // coord has unread → first; worker2 read → second
    expect(threads[0].counterpart).toBe(coord);
    expect(threads[1].counterpart).toBe(worker2);
  });

  it("latestTimestamp reflects most recent message in thread", () => {
    const threads = buildDavidThreads(BASE_MSGS, {});
    const coordThread = threads.find((t) => t.counterpart === coord)!;
    // msgs 1 (ts=1000), 2 (ts=2000), 3 (ts=3000)
    expect(coordThread.latestTimestamp).toBe(3000);
  });

  it("returns empty array for empty message list", () => {
    expect(buildDavidThreads([], {})).toEqual([]);
  });
});

describe("globalUnreadCount", () => {
  it("sums unread across all threads", () => {
    const threads = buildDavidThreads(BASE_MSGS, {});
    // coord: 2 unread (msgs 1,2); worker2: 1 unread (msg 4)
    expect(globalUnreadCount(threads)).toBe(3);
  });

  it("returns 0 when everything read", () => {
    const threads = buildDavidThreads(BASE_MSGS, {
      [coord]: 9999,
      [worker2]: 9999,
    });
    expect(globalUnreadCount(threads)).toBe(0);
  });

  it("returns 0 for empty threads", () => {
    expect(globalUnreadCount([])).toBe(0);
  });
});
