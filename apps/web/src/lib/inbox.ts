import type { MessageSnapshot } from "@coord-ui/shared";

export const DAVID_ID = "david";

export interface DmThread {
  counterpart: string;
  messages: MessageSnapshot[];
  latestTimestamp: number;
  unreadCount: number;
}

const LS_KEY = "coord-ui:inbox-read-state";

export function loadReadState(): Record<string, number> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

export function saveReadState(state: Record<string, number>): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch {
    // storage quota or unavailable — silent
  }
}

export function buildDavidThreads(
  messages: MessageSnapshot[],
  readState: Record<string, number>
): DmThread[] {
  const byCounterpart = new Map<string, MessageSnapshot[]>();

  for (const msg of messages) {
    if (!msg.isDM) continue;
    const isFromDavid = msg.from === DAVID_ID;
    const isToDavid = msg.to === DAVID_ID;
    if (!isFromDavid && !isToDavid) continue;

    const counterpart = isFromDavid ? msg.to : msg.from;
    const list = byCounterpart.get(counterpart) ?? [];
    list.push(msg);
    byCounterpart.set(counterpart, list);
  }

  const threads: DmThread[] = [];
  for (const [counterpart, msgs] of byCounterpart) {
    const sorted = [...msgs].sort((a, b) => a.timestamp - b.timestamp);
    const latestTimestamp = sorted[sorted.length - 1]?.timestamp ?? 0;
    const lastRead = readState[counterpart] ?? 0;
    // Only inbound messages (from counterpart to david) count as unread
    const unreadCount = sorted.filter(
      (m) => m.from !== DAVID_ID && m.timestamp > lastRead
    ).length;
    threads.push({
      counterpart,
      messages: sorted,
      latestTimestamp,
      unreadCount,
    });
  }

  // Unread threads first, then by latest timestamp descending
  threads.sort((a, b) => {
    if (b.unreadCount !== a.unreadCount) return b.unreadCount - a.unreadCount;
    return b.latestTimestamp - a.latestTimestamp;
  });

  return threads;
}

export function globalUnreadCount(threads: DmThread[]): number {
  return threads.reduce((sum, t) => sum + t.unreadCount, 0);
}
