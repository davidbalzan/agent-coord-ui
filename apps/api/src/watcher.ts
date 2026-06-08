import { readFile } from 'node:fs/promises';
import { watch } from 'node:fs';
import type { AgentSnapshot, RoomSnapshot, BusEvent, MessageSnapshot } from '@coord-ui/shared';
import { logger } from './logger.js';

const STORE_DIR = process.env.COORD_STORE_DIR ?? `${process.env.HOME}/.agent-coord`;

interface StoreState {
  agents: Record<string, AgentSnapshot>;
  rooms: Record<string, RoomSnapshot>;
  messages: MessageSnapshot[];
}

type Listener = (event: BusEvent) => void;

class BusWatcher {
  private listeners = new Set<Listener>();
  private prev: StoreState = { agents: {}, rooms: {}, messages: [] };
  private timer: ReturnType<typeof setInterval> | null = null;

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(event: BusEvent) {
    for (const fn of this.listeners) fn(event);
  }

  async snapshot(): Promise<StoreState> {
    try {
      const raw = await readFile(`${STORE_DIR}/state.json`, 'utf8');
      return JSON.parse(raw) as StoreState;
    } catch {
      return { agents: {}, rooms: {}, messages: [] };
    }
  }

  async fullState(): Promise<{ agents: AgentSnapshot[]; rooms: RoomSnapshot[] }> {
    const s = await this.snapshot();
    return {
      agents: Object.values(s.agents),
      rooms: Object.values(s.rooms),
    };
  }

  private async diff() {
    const next = await this.snapshot();

    // Agents
    const prevIds = new Set(Object.keys(this.prev.agents));
    const nextIds = new Set(Object.keys(next.agents));

    for (const id of nextIds) {
      if (!prevIds.has(id)) {
        this.emit({ type: 'agent_join', agent: next.agents[id] });
      } else {
        const p = this.prev.agents[id];
        const n = next.agents[id];
        if (JSON.stringify(p) !== JSON.stringify(n)) {
          this.emit({ type: 'agent_update', agentId: id, patch: n });
        }
      }
    }
    for (const id of prevIds) {
      if (!nextIds.has(id)) this.emit({ type: 'agent_leave', agentId: id });
    }

    // Rooms
    for (const id of Object.keys(next.rooms)) {
      const p = this.prev.rooms[id];
      const n = next.rooms[id];
      if (!p || JSON.stringify(p) !== JSON.stringify(n)) {
        this.emit({ type: 'room_update', room: n });
      }
    }

    // Messages — emit new ones
    const prevMsgIds = new Set(this.prev.messages.map((m) => m.id));
    for (const msg of next.messages) {
      if (!prevMsgIds.has(msg.id)) this.emit({ type: 'message', msg });
    }

    this.prev = next;
  }

  start() {
    this.timer = setInterval(() => {
      this.diff().catch((err) => logger.error({ err }, 'watcher diff error'));
    }, 1000);

    try {
      watch(STORE_DIR, () => {
        this.diff().catch(() => {});
      });
    } catch {
      logger.warn('Could not fs.watch store dir — falling back to poll-only');
    }
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }
}

export const busWatcher = new BusWatcher();
