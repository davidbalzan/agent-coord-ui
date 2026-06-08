import { readFile, readdir } from "node:fs/promises";
import { watch } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type {
  AgentSnapshot,
  RoomSnapshot,
  BusEvent,
  MessageSnapshot,
  PaneSnapshot,
} from "@coord-ui/shared";
import { logger } from "./logger.js";
import { tmuxWatcher } from "./tmux.js";

const ROOT =
  process.env.AGENT_COORD_DIR ??
  process.env.CLAUDE_COORD_DIR ??
  join(homedir(), "agent-coord");

const AGENTS_FILE = join(ROOT, "agents.json");
const ROOMS_FILE = join(ROOT, "rooms.json");
const ROOM_JSONL = join(ROOT, "room.jsonl"); // default "general" channel
const ROOMS_DIR = join(ROOT, "rooms");
const INBOX_DIR = join(ROOT, "inbox");

// Disk shape from agent-coord-mcp store
interface DiskAgent {
  agentId: string;
  role?: string;
  registeredAt?: number;
  lastHeartbeat?: number;
  status?: string;
}

interface DiskRoom {
  createdAt?: number;
  createdBy?: string;
  members?: string[];
  topic?: string;
  motd?: string;
}

type Listener = (event: BusEvent) => void;

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch {
    return null;
  }
}

async function readJsonl(file: string): Promise<MessageSnapshot[]> {
  try {
    const raw = await readFile(file, "utf8");
    return raw
      .split("\n")
      .filter(Boolean)
      .map((line, i) => {
        try {
          const obj = JSON.parse(line) as Record<string, unknown>;
          return {
            id: (obj["id"] as string | undefined) ?? `${file}:${i}`,
            from: (obj["from"] as string | undefined) ?? "",
            to: (obj["to"] as string | undefined) ?? "general",
            isDM: false,
            body: (obj["msg"] ?? obj["body"] ?? obj["text"] ?? "") as string,
            timestamp: (obj["ts"] ?? obj["timestamp"] ?? 0) as number,
          } as MessageSnapshot;
        } catch {
          return undefined;
        }
      })
      .filter((m): m is MessageSnapshot => m != null);
  } catch {
    return [];
  }
}

async function snapshotAgents(
  paneActivityByAgent?: Map<string, number>
): Promise<Record<string, AgentSnapshot>> {
  const disk = await readJson<Record<string, DiskAgent>>(AGENTS_FILE);
  if (!disk) return {};

  const now = Date.now();
  const result: Record<string, AgentSnapshot> = {};
  for (const [id, a] of Object.entries(disk)) {
    const heartbeatAge = now - (a.lastHeartbeat ?? a.registeredAt ?? now);
    const paneActivity = paneActivityByAgent?.get(id);
    const paneAge = paneActivity != null ? now - paneActivity : Infinity;

    // Prefer pane activity if fresher than heartbeat — pane output proves the process is alive
    const effectiveAge = Math.min(heartbeatAge, paneAge);
    const status: AgentSnapshot["status"] =
      effectiveAge < 60_000
        ? "active"
        : effectiveAge < 300_000
          ? "idle"
          : "stale";

    result[id] = {
      id,
      name: id,
      status,
      rooms: [],
      lastSeen: a.lastHeartbeat ?? a.registeredAt ?? now,
      metadata: { role: a.role, paneActive: paneAge < 60_000 },
    };
  }
  return result;
}

async function snapshotRooms(): Promise<Record<string, RoomSnapshot>> {
  const disk = await readJson<Record<string, DiskRoom>>(ROOMS_FILE);
  if (!disk) return {};

  const result: Record<string, RoomSnapshot> = {};
  for (const [name, r] of Object.entries(disk)) {
    result[name] = {
      id: name,
      name,
      topic: r.topic,
      motd: r.motd,
      members: r.members ?? [],
    };
  }
  return result;
}

async function snapshotMessages(): Promise<MessageSnapshot[]> {
  const msgs: MessageSnapshot[] = [];

  // default general channel
  msgs.push(
    ...(await readJsonl(ROOM_JSONL)).map((m) => ({ ...m, to: "general" }))
  );

  // named channels
  try {
    const files = await readdir(ROOMS_DIR);
    for (const f of files.filter((n) => n.endsWith(".jsonl"))) {
      const chan = f.replace(/\.jsonl$/, "");
      msgs.push(
        ...(await readJsonl(join(ROOMS_DIR, f))).map((m) => ({
          ...m,
          to: chan,
        }))
      );
    }
  } catch {
    // rooms dir may not exist yet
  }

  // DMs from inbox files — each file is named <recipientId>.jsonl
  try {
    const files = await readdir(INBOX_DIR);
    for (const f of files.filter((n) => n.endsWith(".jsonl"))) {
      const recipientId = f.replace(/\.jsonl$/, "");
      const raw = await readFile(join(INBOX_DIR, f), "utf8").catch(() => "");
      const dmMsgs = raw
        .split("\n")
        .filter(Boolean)
        .map((line, i) => {
          try {
            const obj = JSON.parse(line) as Record<string, unknown>;
            return {
              id: (obj["id"] as string | undefined) ?? `inbox:${f}:${i}`,
              from: (obj["from"] as string | undefined) ?? "",
              to: (obj["to"] as string | undefined) ?? recipientId,
              isDM: true,
              body: (obj["msg"] ?? obj["body"] ?? obj["text"] ?? "") as string,
              timestamp: (obj["ts"] ?? obj["timestamp"] ?? 0) as number,
            } as MessageSnapshot;
          } catch {
            return undefined;
          }
        })
        .filter((m): m is MessageSnapshot => m != null);
      msgs.push(...dmMsgs);
    }
  } catch {
    // inbox dir may not exist yet
  }

  return msgs;
}

function buildPaneActivityMap(panes: PaneSnapshot[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const pane of panes) {
    if (!pane.agentId) continue;
    const existing = map.get(pane.agentId);
    if (existing == null || pane.lastActivity > existing) {
      map.set(pane.agentId, pane.lastActivity);
    }
  }
  return map;
}

interface StoreSnapshot {
  agents: Record<string, AgentSnapshot>;
  rooms: Record<string, RoomSnapshot>;
  messages: MessageSnapshot[];
  panes: PaneSnapshot[];
}

class BusWatcher {
  private listeners = new Set<Listener>();
  private prev: StoreSnapshot = {
    agents: {},
    rooms: {},
    messages: [],
    panes: [],
  };
  private timer: ReturnType<typeof setInterval> | null = null;

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(event: BusEvent) {
    for (const fn of this.listeners) fn(event);
  }

  async fullState(): Promise<{
    agents: AgentSnapshot[];
    rooms: RoomSnapshot[];
    messages: MessageSnapshot[];
    panes: PaneSnapshot[];
  }> {
    // Two-pass: get agent IDs first for pane content matching, then use pane activity to upgrade statuses
    const [rooms, messages, agentsDraft] = await Promise.all([
      snapshotRooms(),
      snapshotMessages(),
      snapshotAgents(), // initial pass without pane data — just need IDs
    ]);
    const panes = await tmuxWatcher.snapshot(Object.keys(agentsDraft));
    const paneActivity = buildPaneActivityMap(panes);
    // Re-snapshot agents with pane activity so statuses are accurate
    const agents = await snapshotAgents(paneActivity);
    for (const room of Object.values(rooms)) {
      for (const memberId of room.members) {
        if (agents[memberId]) agents[memberId]!.rooms.push(room.id);
      }
    }
    // Keep last 100 per room so no channel is starved by a high-volume room
    const byRoom = new Map<string, MessageSnapshot[]>();
    for (const m of messages) {
      const bucket = byRoom.get(m.to) ?? [];
      bucket.push(m);
      byRoom.set(m.to, bucket);
    }
    const recent = [...byRoom.values()]
      .flatMap((bucket) =>
        bucket.sort((a, b) => a.timestamp - b.timestamp).slice(-100)
      )
      .sort((a, b) => a.timestamp - b.timestamp);
    this.prev = { agents, rooms, messages: recent, panes };
    return {
      agents: Object.values(agents),
      rooms: Object.values(rooms),
      messages: recent,
      panes,
    };
  }

  private async diff() {
    const [rooms, messages] = await Promise.all([
      snapshotRooms(),
      snapshotMessages(),
    ]);
    const paneActivity = buildPaneActivityMap(tmuxWatcher.panes);
    const agents = await snapshotAgents(paneActivity);

    // Attach membership to agents
    for (const room of Object.values(rooms)) {
      for (const memberId of room.members) {
        if (agents[memberId]) agents[memberId]!.rooms.push(room.id);
      }
    }

    // Agents
    const prevIds = new Set(Object.keys(this.prev.agents));
    const nextIds = new Set(Object.keys(agents));
    for (const id of nextIds) {
      if (!prevIds.has(id)) {
        this.emit({ type: "agent_join", agent: agents[id]! });
      } else if (
        JSON.stringify(this.prev.agents[id]) !== JSON.stringify(agents[id])
      ) {
        this.emit({ type: "agent_update", agentId: id, patch: agents[id]! });
      }
    }
    for (const id of prevIds) {
      if (!nextIds.has(id)) this.emit({ type: "agent_leave", agentId: id });
    }

    // Rooms
    for (const [id, room] of Object.entries(rooms)) {
      if (JSON.stringify(this.prev.rooms[id]) !== JSON.stringify(room)) {
        this.emit({ type: "room_update", room });
      }
    }

    // New messages
    const prevMsgIds = new Set(this.prev.messages.map((m) => m.id));
    for (const msg of messages) {
      if (!prevMsgIds.has(msg.id)) this.emit({ type: "message", msg });
    }

    this.prev = { agents, rooms, messages, panes: tmuxWatcher.panes };
  }

  async start() {
    await tmuxWatcher.init();
    // Forward tmux events into the bus; supply live agent IDs for content matching
    tmuxWatcher.subscribe((event) => this.emit(event));
    tmuxWatcher.start(() => Object.keys(this.prev.agents));

    this.timer = setInterval(() => {
      this.diff().catch((err) => logger.error({ err }, "watcher diff error"));
    }, 1000);

    try {
      watch(ROOT, { recursive: false }, () => {
        this.diff().catch(() => {});
      });
    } catch {
      logger.warn("Could not fs.watch store dir — poll-only mode");
    }
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }
}

export const busWatcher = new BusWatcher();
