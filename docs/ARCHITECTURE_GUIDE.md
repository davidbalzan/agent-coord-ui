---
title: "Architecture Guide — agent-coord-ui"
tags: [agent-coord-ui/core]
aliases: ["Architecture Guide", "ARCHITECTURE_GUIDE"]
---

# agent-coord-ui — Architecture Guide

> Documents **why** architectural decisions were made, not just what they are. Primary reference for AI agents and developers making consistent design decisions.

---

## 🏗️ Current Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        apps/web (React SPA)                     │
│                                                                 │
│  ┌──────────────────┐       ┌───────────────────────────────┐  │
│  │   Graph3D        │       │  SidePanel                    │  │
│  │  (Three.js /     │◄─────►│  ├── DMPanel (agent thread)   │  │
│  │  3d-force-graph) │       │  └── RoomPanel (room chat)    │  │
│  └──────────────────┘       └───────────────────────────────┘  │
│          ▲                              ▲                       │
│          └──────────────────────────────┘                       │
│                        Zustand (useBusStore)                    │
│                        busSocket.on() → store.set()             │
│                             ▲                                   │
│                     ws://localhost:3000                         │
└─────────────────────────────┼───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                    apps/api (Hono + ws)                         │
│  watcher.ts polls agent-coord-mcp store (~1s cadence)           │
│  Diffs state → emits BusEvents to all connected WS clients      │
│  REST: POST /api/messages (send DM or room post)                │
│        POST /api/logs     (client error forwarding)             │
└─────────────────────────────┬───────────────────────────────────┘
                              │ file import / HTTP
                ┌─────────────▼──────────────┐
                │     agent-coord-mcp         │
                │  (file-backed store, same   │
                │   host as this process)     │
                └────────────────────────────┘
```

### Key Components

- **`apps/web` — React SPA**: Owns all UI. Subscribes to the WS event stream via `busSocket`, maintains all state in a single Zustand store. Renders a full-screen 3D graph (Three.js) with a slide-in side panel for selected nodes. No server-side rendering; single-operator local tool.
- **`apps/api` — Hono bridge**: The only process that touches `agent-coord-mcp`. Polls the store, diffs state, pushes `BusEvent` frames to connected WS clients. Exposes a tiny REST API for message sends and log forwarding. Does NOT hold business logic — it is a pure reactive bridge.
- **`packages/shared` — Type contract**: `BusEvent`, `AgentSnapshot`, `RoomSnapshot`, `MessageSnapshot`. This is the API boundary. Changing a type here is a breaking change that affects both apps simultaneously — treat with care.

### Communication Patterns

- **Frontend ↔ API**: Native browser WebSocket at `ws://localhost:3000`. JSON frames typed as `BusEvent`. The WS URL is overridable via `VITE_WS_URL` env var.
- **API ↔ MCP Store**: Direct file import (same host, v1). The watcher reads store files at ~1s cadence and computes diffs.
- **Cross-Package**: TypeScript project references with `workspace:*` protocol. Types flow from `packages/shared` → `apps/api` and `apps/web`. No runtime package publish needed.

---

## 🤔 Why a Pure WebSocket Event Stream?

### The Problem

`agent-coord-mcp` is a file-backed store — it doesn't push events. The UI needs live updates as agents join, leave, and post messages without polling from the browser.

### Decision

The API layer acts as a stateful bridge: it polls the store, computes diffs, and pushes typed `BusEvent` frames over WebSocket. The browser never polls; it reacts.

### Alternatives Considered

1. **SSE (Server-Sent Events)**
   - Pros: Simpler than WS, built into browsers, HTTP/2-multiplexable
   - Cons: Unidirectional — the operator can't send messages back without a separate REST call. Coupling two transports adds complexity.
   - Rejected because: The operator needs to post to rooms and DM agents. Bidirectional WS handles both directions in one connection.

2. **Browser polling the MCP store directly**
   - Pros: No bridge needed
   - Cons: The MCP store is a local file — not accessible from the browser. Would require exposing it via HTTP anyway.
   - Rejected because: Same work, worse result.

### Why WS + Hono Bridge is Better

- Single connection handles both receive (graph updates) and send (DM, room post)
- `auto-reconnect` logic in `ws.ts` makes the UI resilient to API restarts
- Bridge can be extracted to HTTP API mode (v2) without any frontend changes — just swap the `VITE_WS_URL`

---

## 🤔 Why Three.js Custom Node Objects for Glow?

### The Problem

`3d-force-graph` renders plain solid spheres by default. The holographic aesthetic requires emissive glow halos on nodes that convey agent status at a glance.

### Decision

Use `nodeThreeObject` to return a custom `THREE.Group` per node: inner solid emissive sphere + two outer additive-blended transparent spheres as bloom approximation + a `PointLight` for local scene illumination.

### The Deduplication Constraint

`3d-force-graph` bundles its own Three.js internally via `three-render-objects`. Importing `three` directly without deduplication creates two Three.js instances — the library's internal renderer doesn't recognise materials/geometries created from the external instance, causing `Cannot read properties of undefined (reading 'setFromMatrixPosition')`.

**Fix enforced in `vite.config.ts`**:

```ts
resolve: {
  dedupe: ["three"];
}
```

This forces both imports to the same module instance. `three` must be `^0.184.0` to satisfy `three-render-objects@1.42.0`'s peer dep — do not downgrade.

### Why Not Post-Processing Bloom?

`UnrealBloomPass` / `EffectComposer` would produce higher-quality bloom but requires taking over the renderer setup from `3d-force-graph`. The dual-sphere additive blending approach achieves ~80% of the visual result with zero renderer coupling.

---

## 🎨 Design System Layer

Added in **Phase 6** — behavior-preserving extraction of the NEXUS visual language into a single authoritative layer. All new UI work must consume these instead of writing inline values.

### `theme/tokens.ts` — Single source of truth

Canonical colour, font, and spacing constants. **No component may introduce a new inline hex or font string** — every visual value must trace back to a token.

| Export                  | Value                                  | Purpose                           |
| ----------------------- | -------------------------------------- | --------------------------------- |
| `COLOR_CYAN`            | `#00d4ff`                              | Primary accent                    |
| `COLOR_GREEN`           | `#00ff88`                              | Active / success                  |
| `COLOR_RED`             | `#ff4e4e`                              | Alert / DAVID_DECISION            |
| `COLOR_ORANGE`          | `#ff8c00`                              | Warning / RISK                    |
| `FONT_MONO`             | `"Share Tech Mono", monospace`         | Monospace UI text                 |
| `FONT_DISPLAY`          | `"Orbitron", sans-serif`               | Display / headers                 |
| `PREFIX_COLORS`         | `{ DAVID_DECISION, BLOCKER, RISK, … }` | Severity badge colours            |
| `PREFIX_COLOR_FALLBACK` | `COLOR_CYAN_DIM`                       | Badge colour for unknown prefixes |
| `PRIORITY_ACCENT`       | `{ loud, dock, subtle }`               | Notification popup tints          |
| `SPACE`                 | `{ xs:4, sm:8, md:12, lg:16, xl:24 }`  | Spacing scale (px)                |

`PREFIX_COLORS` is the **canonical prefix→severity map** — the single place that maps bus message prefixes (`DAVID_DECISION`, `BLOCKER`, `RISK`, `AGENT_ACTION`, `DONE`, `FYI`) to their badge colours. Any badge, label, or node tint driven by a bus prefix must read from this map.

### `components/primitives/` — Reusable presentational components

Self-contained, zero business logic. Consume tokens; accept `style` override for caller-specific overrides (spread last so callers always win).

| Primitive       | Props                                                        | Purpose                                                      |
| --------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| `GlassPanel`    | `background`, `blur?`, `saturate?`, `cornerBrackets?`, `as?` | Frosted-glass surface with optional animated corner brackets |
| `HoloButton`    | standard `<button>` props                                    | Holographic button wrapping `.holo-btn` CSS class            |
| `SeverityBadge` | `prefix: string`, `style?`                                   | Bordered inline badge coloured via `PREFIX_COLORS`           |
| `PulsingDot`    | —                                                            | Animated green dot + "working…" activity indicator           |
| `SectionLabel`  | `color?`, `style?`, children                                 | Uppercase eyebrow label (Share Tech Mono, dim cyan)          |

### Sub-module structure — co-located `*/*.tsx`

Large component files are split into co-located sub-folders. The top-level file is a thin orchestrator; logic/sub-components live in the named folder.

| Folder      | Orchestrator        | Contains                                                                                  |
| ----------- | ------------------- | ----------------------------------------------------------------------------------------- |
| `graph/`    | `Graph3D.tsx`       | `buildGlowNode.ts`, `forces.ts`, `animationLoop.ts`, `interactions.ts`, `backlogNodes.ts` |
| `launcher/` | `AgentLauncher.tsx` | `types.ts`, `LauncherShell.tsx`, `FormHelpers.tsx`, `ProgressCard.tsx`                    |
| `backlog/`  | `BacklogPanel.tsx`  | `BacklogRows.tsx`, `AddItemForm.tsx`, `styles.ts`                                         |

### Rules

1. **Tokens are the single source of truth** — no new inline hex colour or font-family string in any component. Use `COLOR_*`, `FONT_MONO`, `FONT_DISPLAY`, `PREFIX_COLORS`, or `PRIORITY_ACCENT`.
2. **Primitives are presentational** — no store access, no business logic. If you need store-connected behaviour, wrap the primitive (see `AgentActivityDot` wrapping `PulsingDot`).
3. **`SeverityBadge` scope** — only apply where a severity colour is already shown today. Do not add severity colouring to components that don't currently colour by prefix.
4. **`style` prop overrides** — primitives spread `style` last, so callers can always override defaults without forking the primitive.

---

## 📁 Directory Structure

```
apps/web/src/
├── theme/
│   └── tokens.ts        # Design tokens — colours, fonts, spacing, PREFIX_COLORS
├── components/
│   ├── primitives/      # Presentational building blocks (GlassPanel, HoloButton, …)
│   ├── graph/           # Graph3D sub-modules (buildGlowNode, forces, animationLoop, …)
│   ├── launcher/        # AgentLauncher sub-modules (types, LauncherShell, FormHelpers, …)
│   ├── backlog/         # BacklogPanel sub-modules (BacklogRows, AddItemForm, styles)
│   ├── Graph3D.tsx      # Three.js scene orchestrator — imports from graph/*
│   ├── HUD.tsx          # Top status bar — reads agent/room counts from store
│   ├── SidePanel.tsx    # Container — reads selection, renders DMPanel or RoomPanel
│   ├── DMPanel.tsx      # Agent DM thread + compose
│   └── RoomPanel.tsx    # Room chat + member list + compose
├── store/
│   └── bus.ts           # Zustand store — single source of truth for all WS state
├── lib/
│   └── ws.ts            # WebSocket client — connect, reconnect, on(), send()
├── index.css            # Tailwind + @theme tokens + global animation keyframes
└── main.tsx             # Entry — ErrorBoundary wraps App

apps/api/src/
├── index.ts             # Hono server entry — HTTP + WS upgrade
├── watcher.ts           # Polls agent-coord-mcp store, diffs, emits BusEvents
└── router.ts            # REST routes (/api/messages, /api/logs)

packages/shared/src/
└── index.ts             # BusEvent union type + snapshot interfaces
```

### File Naming Conventions

- **Components**: `PascalCase.tsx` — e.g., `Graph3D.tsx`, `RoomPanel.tsx`
- **Utilities / lib**: `camelCase.ts` — e.g., `ws.ts`, `bus.ts`
- **No barrel exports** in components — import each file directly to keep HMR fast

---

## 📈 Upgrade Paths

### Current State

**What**: Single-host local tool. API reads MCP store by direct file import. No auth. Single WS endpoint.
**Best for**: One operator, one machine, one `agent-coord-mcp` instance.

### Growing → Networked Deployment

**When to upgrade**:

- Team grows beyond one operator
- `agent-coord-mcp` runs on a different host

**Migration effort**: Medium (~2 days)
**Strategy**: Replace direct file import in `watcher.ts` with HTTP calls to `agent-coord-mcp`'s API. Add shared-secret token to WS handshake. Docker Compose wraps both services.

### Maturity → Multi-Bus / Federation

**When to upgrade**:

- Need to monitor multiple independent `agent-coord-mcp` instances in one view

**Migration effort**: High (~2 weeks)
**Strategy**: `apps/api` becomes a fan-in multiplexer. `packages/shared` adds a `busId` discriminator to all events.

---

## ✅ Best Practices

### 1. Array Selectors Must Use `useShallow`

```tsx
// DO: Stable reference via shallow comparison
const msgs = useBusStore(useShallow((s) => roomMessages(s, roomId)));

// DON'T: Inline filter returns new array every render → infinite re-render loop
const msgs = useBusStore((s) => roomMessages(s, roomId));
```

### 2. Three.js Objects Must Use the Deduplicated `three` Import

```tsx
// DO: Import from 'three' — Vite dedupe ensures this is the same instance as 3d-force-graph
import * as THREE from "three";

// DON'T: Import from the bundled copy inside 3d-force-graph or three-render-objects
// There is no public path to that copy — this serves as a reminder not to fight the dedup
```

### 3. All Backend Logging via `getLogger()`, Never `console.*`

```ts
// DO:
const logger = getLogger();
logger.info("ws", "client connected", { clientId });

// DON'T: console.log leaks unstructured output and bypasses the unified log file
```

---

## 🔗 Related Documents

- **[[DECISIONS|Decisions Log]]** - Detailed ADRs for every major architectural choice
- **[[TECH_STACK|Tech Stack]]** - Technology choices with versions, rationale, and upgrade risks
- **[[CURRENT_FOCUS|Current Focus]]** - What's actively being worked on
- **[[DESIGN_SYSTEM|Design System]]** - Holographic visual language and component patterns
- **[[prd|PRD]]** - Original product requirements
- **`theme/tokens.ts`** - Canonical colour/font/spacing constants (see Design System Layer above)
