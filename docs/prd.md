# PRD: agent-coord-ui — 3D Visual Command Centre for Agent Coordination

**Status:** Draft  
**Author:** David Balzan  
**Created:** 2026-06-08  
**Companion project:** `agent-coord-mcp` (data source), `agent-coord-irc` (prior text UI precedent)

---

## 1. Problem

The `agent-coord-mcp` bus carries rich topology — agents, rooms, DM threads, heartbeats, status updates — but the only human interfaces today are the raw MCP tool calls and the terminal IRC-style chat (`coord-chat`). Operators have no at-a-glance view of:

- which agents are alive and what they are doing
- how agents are connected (room membership, DM relationships)
- message traffic flowing between nodes in real time
- a way to reach into any agent or room with a single click

This makes debugging multi-agent runs and monitoring coordination health slow and error-prone.

---

## 2. Goal

Ship `agent-coord-ui`: a standalone web app (plugin on top of `agent-coord-mcp`) that renders the live coordination bus as an interactive 3D force-directed node graph and lets the operator communicate with any agent, room, or DM thread by clicking a node.

---

## 3. Non-Goals (v1)

- Mobile layout optimisation
- Multi-bus / federated view (single `agent-coord-mcp` instance only)
- Agent administration (kick, ban, rename) — read + message only
- Persistence / replay of historical sessions beyond the bus's own store
- Auth / multi-user access control (single-operator local tool)

---

## 4. User Stories

| # | As the operator I want to… | So that… |
|---|---------------------------|----------|
| U1 | See all live agents as nodes in a 3D graph | I know who is running at a glance |
| U2 | See rooms as distinct nodes with edges to member agents | I understand the group topology |
| U3 | Watch messages animate along edges in real time | I can see traffic flow without reading logs |
| U4 | Click an agent node and open a DM panel | I can send a direct command to one agent |
| U5 | Click an edge between two agents | I can read the full DM thread between them |
| U6 | Click a room node and open the room chat panel | I can broadcast to a room or read its history |
| U7 | See agent status (idle / working / stale) encoded in node colour/pulse | I spot blocked or dead agents instantly |
| U8 | Filter or spotlight a single room or agent | I reduce visual noise when the bus is large |

---

## 5. Architecture

```
┌──────────────────────────────────────────────┐
│               agent-coord-ui                 │
│                                              │
│  ┌────────────┐      ┌─────────────────────┐ │
│  │  3D Graph  │      │   Side Panel        │ │
│  │ (Three.js / │◄────►│  - DM thread        │ │
│  │  3d-force- │      │  - Room chat        │ │
│  │   graph)   │      │  - Agent details    │ │
│  └────────────┘      └─────────────────────┘ │
│         ▲                       ▲            │
│         └──────────┬────────────┘            │
│                    │                         │
│            ┌───────▼──────┐                  │
│            │  WS / SSE    │  (bridge layer)  │
│            │  Gateway     │                  │
│            └───────┬──────┘                  │
└────────────────────┼─────────────────────────┘
                     │ HTTP + file poll / inotify
          ┌──────────▼──────────┐
          │   agent-coord-mcp   │
          │  (file-backed store)│
          └─────────────────────┘
```

### 5.1 Bridge / Backend (`packages/server`)

- **Node.js + Hono** (already a dep in agent-coord-mcp, consistent)
- Reads `agent-coord-mcp` store files directly (same host) or via HTTP if the MCP server is running in networked mode
- Exposes a **WebSocket** endpoint (`/ws`) that pushes graph diff events to the UI
- Exposes a **REST API** for read queries and message sends (proxies to MCP tools via `agent-coord-mcp`'s HTTP API or by importing the store module directly)
- Polls or watches the store at ~1s cadence; pushes delta events to connected clients

Event shape (WebSocket, JSON):
```ts
type BusEvent =
  | { type: 'agent_join';   agent: AgentSnapshot }
  | { type: 'agent_leave';  agentId: string }
  | { type: 'agent_update'; agentId: string; patch: Partial<AgentSnapshot> }
  | { type: 'room_update';  room: RoomSnapshot }
  | { type: 'message';      msg: MessageSnapshot }   // triggers edge animation
  | { type: 'full_state';   agents: AgentSnapshot[]; rooms: RoomSnapshot[] }
```

### 5.2 Frontend (`packages/ui`)

- **React 18 + Vite**
- **[3d-force-graph](https://github.com/vasturiano/3d-force-graph)** (Three.js-backed, zero-config force layout in 3D)
- **Tailwind CSS** for the side panel and HUD chrome
- State managed with **Zustand** (lightweight, no boilerplate)

#### Node types

| Node type | Visual | Represents |
|-----------|--------|------------|
| Agent | Glowing sphere; colour = status (green=active, amber=idle, red=stale) | A registered agent |
| Room | Cube / hexagonal prism; labelled | A coordination room |
| DM edge | Dashed line between two agent nodes | Active DM relationship |
| Room-member edge | Solid line from room to agent | Room membership |

#### Interaction model

| Click target | Action |
|-------------|--------|
| Agent node | Open DM panel — shows thread history + compose box |
| Room node | Open room panel — shows room chat + topic/motd + compose |
| Edge (agent↔agent) | Open DM panel for that pair (same as clicking either endpoint but filtered) |
| Edge (room↔agent) | Highlight room + show member list |
| Background drag | Orbit / pan camera |
| Scroll | Zoom |
| Double-click node | Lock camera focus on node, dim others |

#### Message flow animation

When a `message` event arrives, animate a particle travelling along the relevant edge (agent→room or agent→agent) over ~600ms using Three.js sprite + lerp. Queue simultaneous events; don't drop packets visually.

---

## 6. Key Screens

### 6.1 Main graph view

```
┌─────────────────────────────────────────────────────┐
│ [agent-coord-ui]           ◉ 4 agents  ◈ 3 rooms   │  ← HUD bar
├──────────────────────────────────────┬──────────────┤
│                                      │ Side Panel   │
│        3D Force Graph                │              │
│                                      │  (empty      │
│   ●─────────────────●                │   until      │
│   │  agent-A   agent-B│              │   click)     │
│   │      \    /       │              │              │
│   │       [room-1]    │              │              │
│   │      /    \       │              │              │
│   ●  agent-C  agent-D ●              │              │
│                                      │              │
└──────────────────────────────────────┴──────────────┘
  [Filter: room ▾]  [Spotlight ▾]  [Settings]
```

### 6.2 DM panel (after clicking agent node)

```
┌──────────────────────┐
│ ● agent-B            │
│ status: working      │
│ last seen: 2s ago    │
├──────────────────────┤
│ [agent-A] hello      │
│ [agent-B] on it      │
│ ...                  │
├──────────────────────┤
│ ▸ Send message       │
│ ________________________│
│ [type here…]  [Send] │
└──────────────────────┘
```

### 6.3 Room panel (after clicking room node)

```
┌──────────────────────┐
│ ◈ room-1             │
│ topic: sprint-42     │
│ 4 members            │
├──────────────────────┤
│ [agent-A] status ok  │
│ [agent-C] done slice │
│ ...                  │
├──────────────────────┤
│ ▸ Post to room       │
│ [type here…]  [Post] │
└──────────────────────┘
```

---

## 7. Project Structure

```
agent-coord-ui/               ← new repo / sub-package
├── packages/
│   ├── server/               ← Hono bridge backend
│   │   ├── src/
│   │   │   ├── index.ts      ← HTTP + WS server entry
│   │   │   ├── store.ts      ← reads agent-coord-mcp store
│   │   │   ├── watcher.ts    ← polls/watches for changes, emits events
│   │   │   └── router.ts     ← REST endpoints (messages, state)
│   │   └── package.json
│   └── ui/                   ← React Vite app
│       ├── src/
│       │   ├── main.tsx
│       │   ├── App.tsx
│       │   ├── components/
│       │   │   ├── Graph3D.tsx       ← 3d-force-graph wrapper
│       │   │   ├── NodeObject.tsx    ← custom node renderer
│       │   │   ├── SidePanel.tsx     ← DM / room panel container
│       │   │   ├── DMPanel.tsx
│       │   │   ├── RoomPanel.tsx
│       │   │   └── HUD.tsx
│       │   ├── store/
│       │   │   └── bus.ts            ← Zustand store, WS subscriber
│       │   └── lib/
│       │       └── ws.ts             ← WebSocket client wrapper
│       └── package.json
├── package.json              ← pnpm workspace root
└── README.md
```

---

## 8. Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Backend runtime | Node.js 18+ | Matches agent-coord-mcp |
| Backend framework | Hono | Already a dep; fast, minimal |
| 3D graph | `3d-force-graph` | Purpose-built Three.js force graph; handles 100+ nodes cleanly |
| Frontend framework | React 18 | Ecosystem fit, team familiarity |
| Build | Vite | Fast dev loop |
| Styling | Tailwind CSS | Rapid UI iteration |
| State | Zustand | Simple, no boilerplate |
| WS transport | native `ws` (server) + browser WebSocket | No extra dep |

---

## 9. Milestones

| Milestone | Deliverable | Target |
|-----------|-------------|--------|
| M1 — Skeleton | Monorepo scaffold, Hono server boots, Vite app loads | Week 1 |
| M2 — Live graph | Agents + rooms appear as nodes, edges correct, real-time updates via WS | Week 2 |
| M3 — Message flow | Particle animation on edges when messages arrive | Week 3 |
| M4 — Interaction | Click-to-open side panel, DM send, room post | Week 4 |
| M5 — Polish | Spotlight/filter, status colours, stale pulse, HUD stats | Week 5 |

---

## 10. Open Questions

1. **Deployment**: local-only (`localhost:4000`) or should it support a shared URL for remote teams? (v1 assumption: local only)
2. **Auth**: if exposed on a network, needs at minimum a shared secret token. Defer to v2?
3. **agent-coord-mcp store access**: direct file import (fastest, same host) vs HTTP API (cleaner separation). Prefer direct import for v1; HTTP for v2 networked mode.
4. **Message send operator identity**: posts will appear as a special `operator` agent. Should the operator register a real agent entry on the bus, or send anonymously?
5. **Scale**: at what node count does 3d-force-graph need level-of-detail culling? Test at 50+ agents.
