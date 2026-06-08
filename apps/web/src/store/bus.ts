import { create } from 'zustand';
import type { AgentSnapshot, RoomSnapshot, MessageSnapshot } from '@coord-ui/shared';
import { busSocket } from '../lib/ws.js';

export type SelectionKind = 'agent' | 'room' | 'dm-edge';

export interface Selection {
  kind: SelectionKind;
  id: string;         // agentId, roomId, or "agentA:agentB"
}

interface BusState {
  agents: Record<string, AgentSnapshot>;
  rooms: Record<string, RoomSnapshot>;
  messages: MessageSnapshot[];
  selection: Selection | null;
  setSelection: (s: Selection | null) => void;
  sendMessage: (to: string, body: string, isDM: boolean) => void;
}

export const useBusStore = create<BusState>((set, get) => {
  // Wire WS events into the store
  busSocket.on((event) => {
    switch (event.type) {
      case 'full_state':
        set({
          agents: Object.fromEntries(event.agents.map((a) => [a.id, a])),
          rooms: Object.fromEntries(event.rooms.map((r) => [r.id, r])),
        });
        break;
      case 'agent_join':
        set((s) => ({ agents: { ...s.agents, [event.agent.id]: event.agent } }));
        break;
      case 'agent_leave':
        set((s) => {
          const agents = { ...s.agents };
          delete agents[event.agentId];
          return { agents };
        });
        break;
      case 'agent_update':
        set((s) => ({
          agents: {
            ...s.agents,
            [event.agentId]: { ...s.agents[event.agentId], ...event.patch },
          },
        }));
        break;
      case 'room_update':
        set((s) => ({ rooms: { ...s.rooms, [event.room.id]: event.room } }));
        break;
      case 'message':
        set((s) => ({ messages: [...s.messages.slice(-200), event.msg] }));
        break;
    }
  });

  busSocket.connect();

  return {
    agents: {},
    rooms: {},
    messages: [],
    selection: null,
    setSelection: (selection) => set({ selection }),
    sendMessage: (to, body, isDM) => {
      busSocket.send({ type: 'send_message', to, body, isDM });
    },
  };
});

// Derived helpers (call inside components)
export const agentList = (s: BusState) => Object.values(s.agents);
export const roomList = (s: BusState) => Object.values(s.rooms);
export const dmMessages = (s: BusState, a: string, b: string) =>
  s.messages.filter(
    (m) =>
      m.isDM &&
      ((m.from === a && m.to === b) || (m.from === b && m.to === a)),
  );
export const roomMessages = (s: BusState, roomId: string) =>
  s.messages.filter((m) => !m.isDM && m.to === roomId);
