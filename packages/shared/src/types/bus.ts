export type AgentStatus = 'active' | 'idle' | 'stale' | 'unknown';

export interface AgentSnapshot {
  id: string;
  name: string;
  status: AgentStatus;
  rooms: string[];
  lastSeen: number; // unix ms
  metadata?: Record<string, unknown>;
}

export interface RoomSnapshot {
  id: string;
  name: string;
  topic?: string;
  motd?: string;
  members: string[]; // agent ids
}

export interface MessageSnapshot {
  id: string;
  from: string; // agent id or 'operator'
  to: string;   // agent id (DM) or room id (broadcast)
  isDM: boolean;
  body: string;
  timestamp: number;
}

export type BusEvent =
  | { type: 'full_state'; agents: AgentSnapshot[]; rooms: RoomSnapshot[] }
  | { type: 'agent_join'; agent: AgentSnapshot }
  | { type: 'agent_leave'; agentId: string }
  | { type: 'agent_update'; agentId: string; patch: Partial<AgentSnapshot> }
  | { type: 'room_update'; room: RoomSnapshot }
  | { type: 'message'; msg: MessageSnapshot };

export interface SendMessagePayload {
  to: string;
  body: string;
  isDM: boolean;
}
