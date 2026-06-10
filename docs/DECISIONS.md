---
title: "Architectural Decisions"
tags: [agent-coord-ui/reference]
aliases: ["DECISIONS", "ADR", "Decision Log"]
---

# Architectural Decision Records (ADRs)

> **Document the "why" behind significant technical decisions.**

ADRs capture context that's easy to forget: why we chose X over Y, what constraints existed, and what trade-offs we accepted. Future team members (and AI assistants) will thank you.

---

## Decision Log

| ID      | Decision                                                                                        | Status   | Date       |
| ------- | ----------------------------------------------------------------------------------------------- | -------- | ---------- |
| ADR-001 | [Monorepo with Turborepo](#adr-001-monorepo-with-turborepo)                                     | Accepted | 2026-02-20 |
| ADR-002 | [React + Vite for Frontend](#adr-002-react--vite-for-frontend)                                  | Accepted | 2026-02-20 |
| ADR-003 | [Node.js + Hono for Backend](#adr-003-nodejs--hono-for-backend)                                 | Accepted | 2026-02-20 |
| ADR-004 | [3d-force-graph for 3D Visualisation](#adr-004-3d-force-graph-for-3d-visualisation)             | Accepted | 2026-06-08 |
| ADR-005 | [WebSocket over SSE for Bus Events](#adr-005-websocket-over-sse-for-bus-events)                 | Accepted | 2026-06-08 |
| ADR-006 | [Three.js Dedup via Vite resolve.dedupe](#adr-006-threejs-dedup-via-vite-resolvededupe)         | Accepted | 2026-06-08 |
| ADR-007 | [Holographic Aesthetic — NEXUS Theme](#adr-007-holographic-aesthetic--nexus-theme)              | Accepted | 2026-06-08 |
| ADR-008 | [useShallow for Array Selectors in Zustand](#adr-008-useshallow-for-array-selectors-in-zustand) | Accepted | 2026-06-08 |
| ADR-009 | [UI-Driven Agent Provisioning via tmux](#adr-009-ui-driven-agent-provisioning-via-tmux)         | Accepted | 2026-06-10 |
| ADR-010 | [Local-Only Loopback Gate for Provisioning](#adr-010-local-only-loopback-gate-for-provisioning) | Accepted | 2026-06-10 |

---

## ADR-001: Monorepo with Turborepo

**Status**: Accepted
**Date**: 2026-02-20

### Context

We need to manage frontend, backend, and shared packages in a cohesive way across the project.

### Decision

Use Turborepo with pnpm workspaces for monorepo management.

### Consequences

**Positive:**

- Shared TypeScript types between frontend and backend
- Parallel builds and caching speed up CI
- Single repository simplifies dependency management
- pnpm provides efficient disk usage with symlinks

**Negative:**

- Need to configure Turborepo pipeline
- All team members work in same repo
- Shared packages require careful versioning

### Alternatives Considered

| Alternative    | Pros                               | Cons                            | Why Not                    |
| -------------- | ---------------------------------- | ------------------------------- | -------------------------- |
| Nx             | More features, powerful generators | Steeper learning curve, heavier | Overkill for most projects |
| Lerna          | Familiar, established              | Legacy, less active development | Outdated patterns          |
| Separate repos | Independent deployments            | Friction for shared code        | Coordination overhead      |

---

## ADR-002: React + Vite for Frontend

**Status**: Accepted
**Date**: 2026-02-20

### Context

Need a frontend framework with fast iteration and a mature ecosystem.

### Decision

Use React 19 with Vite as the build tool and Tailwind CSS 4 for styling.

### Consequences

**Positive:**

- React's component model and ecosystem maturity
- Vite provides fast HMR essential for UI development
- Tailwind 4 with CSS-first config and design tokens
- Wide library support and team familiarity

**Negative:**

- Bundle size consideration for production
- Tailwind 4 is relatively new (CSS-based config)

### Alternatives Considered

| Alternative | Pros                      | Cons                                   | Why Not                            |
| ----------- | ------------------------- | -------------------------------------- | ---------------------------------- |
| Next.js     | Full-stack, SSR           | SSR not always needed, adds complexity | Over-engineered for many use cases |
| Vue + Vite  | Great DX, smaller bundle  | Smaller ecosystem                      | Fewer libraries available          |
| Svelte      | Compiled, minimal runtime | Less mature ecosystem                  | Library ecosystem not ready        |

---

## ADR-003: Node.js + Hono for Backend

**Status**: Accepted
**Date**: 2026-02-20

### Context

Need a fast, lightweight backend framework with excellent TypeScript support.

### Decision

Use Node.js runtime with Hono web framework.

### Consequences

**Positive:**

- Hono is lightweight, Web Standards-based (~14kb)
- TypeScript-first with excellent types
- Built-in middleware (CORS, logger, Zod validation)
- Portable across runtimes (Node, Bun, Deno, Cloudflare Workers)

**Negative:**

- Smaller ecosystem than Express
- Team needs to learn Hono patterns

### Alternatives Considered

| Alternative | Pros                     | Cons                                  | Why Not                            |
| ----------- | ------------------------ | ------------------------------------- | ---------------------------------- |
| Express     | Huge ecosystem, familiar | Legacy patterns, no native TypeScript | Dated patterns                     |
| Fastify     | Fast, good TS support    | More complex plugin system            | Heavier than needed                |
| Bun + Hono  | Better performance       | Bun still evolving, edge cases        | Node.js more stable for production |

---

---

## ADR-004: 3d-force-graph for 3D Visualisation

**Status**: Accepted
**Date**: 2026-06-08

### Context

Need to render a live force-directed graph of 50–200 nodes in 3D with real-time updates, custom node rendering, and click interaction — without writing a Three.js physics engine from scratch.

### Decision

Use `3d-force-graph` (vasturiano) — a Three.js wrapper that provides the force simulation, camera, and renderer out of the box. Customise node rendering via `nodeThreeObject`.

### Consequences

**Positive:**

- Zero-config force layout handles node separation automatically
- `nodeThreeObject` gives full Three.js access for custom glow geometry
- `linkDirectionalParticles` provides message flow animation at no extra cost
- Handles 100+ nodes performantly

**Negative:**

- Bundles its own Three.js internally (`three-render-objects`) — requires version alignment and Vite dedup (see ADR-006)
- Cannot easily use `EffectComposer` / `UnrealBloomPass` without overriding the internal renderer

### Alternatives Considered

| Alternative            | Pros             | Cons                                      | Why Not                      |
| ---------------------- | ---------------- | ----------------------------------------- | ---------------------------- |
| react-force-graph (2D) | Simpler          | No depth — loses the holographic 3D feel  | PRD explicitly requires 3D   |
| Raw Three.js           | Full control     | Weeks of force-simulation and camera work | Reinventing a solved problem |
| Cytoscape.js           | Mature graph lib | 2D canvas only                            | No 3D support                |

---

## ADR-005: WebSocket over SSE for Bus Events

**Status**: Accepted
**Date**: 2026-06-08

### Context

The UI must receive live graph updates from the API and also send messages (DM and room post) back. Need to decide on the communication protocol.

### Decision

Use native browser WebSocket for both directions over a single persistent connection.

### Consequences

**Positive:**

- Single connection handles both incoming events and outgoing sends
- Auto-reconnect on close is simple to implement (`ws.onclose → setTimeout(connect, 2000)`)
- No need for a separate REST call to post messages

**Negative:**

- Slightly more complex server setup than SSE
- Binary framing overhead (negligible for JSON messages)

### Alternatives Considered

| Alternative                 | Pros                 | Cons                                                | Why Not                                       |
| --------------------------- | -------------------- | --------------------------------------------------- | --------------------------------------------- |
| SSE (receive) + REST (send) | Simpler receive path | Two transport layers to manage; more complex client | Coupling two mechanisms adds brittleness      |
| Long polling                | No WS infra needed   | High latency, many idle requests                    | Unacceptable for near-real-time graph updates |

---

## ADR-006: Three.js Dedup via Vite resolve.dedupe

**Status**: Accepted
**Date**: 2026-06-08

### Context

`3d-force-graph` bundles `three` internally via `three-render-objects`. Importing `three` directly in `Graph3D.tsx` creates a second instance. Two Three.js instances cause the renderer to reject external geometry/materials with `Cannot read properties of undefined (reading 'setFromMatrixPosition')`.

### Decision

1. Pin `three` to `^0.184.0` in `apps/web/package.json` (matching `three-render-objects@1.42.0` peer dep)
2. Add `resolve: { dedupe: ['three'] }` to `vite.config.ts`

This forces all imports of `three` — including those from inside `three-render-objects` — to resolve to the single version installed in the project.

### Consequences

**Positive:**

- Eliminates the "Multiple instances of Three.js" warning
- Custom `THREE.Group` / `THREE.Mesh` objects work correctly in the 3d-force-graph scene
- Single source of truth for Three.js version

**Negative:**

- `three` version must stay aligned with `three-render-objects` peer dep — upgrading one requires checking the other

### Constraint

**Do not remove `resolve.dedupe: ['three']` from `vite.config.ts`.** Doing so will re-introduce the crash.

---

## ADR-007: Holographic Aesthetic — NEXUS Theme

**Status**: Accepted
**Date**: 2026-06-08

### Context

The UI is an operator tool for monitoring AI agents — it benefits from a visual language that communicates precision, liveness, and technical authority. A generic light/dark dashboard aesthetic would feel inappropriate for a sci-fi command centre.

### Decision

Adopt a holographic HUD aesthetic: near-black deep navy background (`#000913`), electric cyan (`#00d4ff`) as the system glow accent, amber/green/red for agent status semantics. Fonts: Orbitron (display), Share Tech Mono (data), Exo 2 (body). Angular clip-path components, scanline CRT overlay, additive-blended node halos.

All third-party branded code-name references removed. System name: **NEXUS**.

### Consequences

**Positive:**

- Immediately communicates the tool's purpose and register
- Status encoding via colour + glow is more legible than text alone at a glance
- Memorable and distinct from generic dashboards

**Negative:**

- Low-contrast backgrounds require careful accessibility consideration for any future public-facing use
- Font choices (Orbitron) reduce readability at paragraph sizes — body text uses Exo 2 instead

---

## ADR-008: useShallow for Array Selectors in Zustand

**Status**: Accepted
**Date**: 2026-06-08

### Context

`roomMessages` and `dmMessages` are selector functions that call `.filter()` on the messages array. Every call returns a new array reference. Zustand v5 uses `Object.is` equality by default — a new array reference on every render triggers a re-render, which re-evaluates the selector, which returns a new array... causing `Maximum update depth exceeded`.

### Decision

Wrap all array-returning selectors with `useShallow` from `zustand/react/shallow`:

```tsx
import { useShallow } from "zustand/react/shallow";
const msgs = useBusStore(useShallow((s) => roomMessages(s, roomId)));
```

`useShallow` does element-by-element comparison, so Zustand only re-renders when the array contents actually change.

### Rule

**Any selector that returns an array or derived object must use `useShallow`.** Plain primitive or stable-reference selectors (`s.rooms[id]`, `s.selection`) do not need it.

---

## ADR-009: UI-Driven Agent Provisioning via tmux

**Status**: Accepted
**Date**: 2026-06-10

### Context

Spawning a new agent requires a fixed multi-step ritual: open a tmux pane, run `claude`, wait for the prompt, send `/model <model>`, wait again, invoke the skill with the right flags, and confirm the agent registered on the coord bus. With multiple agent roles (coordinator, worker, infra) this is toil-heavy and error-prone — a mis-timed `send-keys` silently misconfigures the agent.

The project already had `sendKeys`, `capturePane`, and `listPanes` in `tmux.ts`. The main missing piece was reliable prompt-readiness detection so each step could gate on output before proceeding.

### Decision

Implement a server-side provisioner (`apps/api/src/provisioner.ts`) that sequences the full spawn ritual: `createPane` → `waitForPrompt` (shell ready) → `sendKeys(launchCmd)` → `waitForPrompt` (agent ready) → `sendKeys(/model)` → `waitForPrompt` → `sendKeys(skillInvocation)` → `waitForPrompt` → poll transport dir for bus registration. Each step emits a `spawn_progress` event to the WebSocket client so the browser shows a live step-bar.

Agent presets (`AgentPreset`) encode all per-role configuration (model, launchCmd, skillInvocation template, lane, rooms, repoPath) and are persisted to `~/agent-coord/presets.json`. The `AgentLauncher` React component provides the operator UI; `PresetEditor` handles CRUD via REST.

Terminal groups map 1:1 to tmux sessions. The `TerminalGroup` type in `@coord-ui/shared` lets the launcher enumerate existing sessions and lets Graph3D label pane nodes by group.

### Consequences

**Positive:**

- Eliminates the manual spawn ritual; one click provisions a fully configured, registered agent
- `waitForPrompt` gates prevent timing bugs — each step only fires after the previous one is confirmed ready
- Pane orphan cleanup: `killPane` is always called in the error path, preventing stale tmux panes
- All preset fields reaching a shell are validated server-side (`launchCmd`, `skillInvocation`, `repoPath`, `lane`, `rooms`)

**Negative:**

- Provisioner depends on `capturePane` output matching hardcoded patterns (`SHELL_READY_MATCHER`, `AGENT_READY_MATCHER`) — model prompt changes could break detection
- Spawn sequence is sequential and slow (~15–30 s end-to-end) — acceptable for manual use but not for bulk spawning
- Transport-dir polling for registration is a filesystem side-channel; a proper bus `join` event would be cleaner

### Alternatives Considered

| Alternative                     | Pros                                  | Cons                                                                | Why Not                                                   |
| ------------------------------- | ------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------- |
| Shell script per preset         | Simple, auditable                     | Still manual toil; no progress feedback; no UI integration          | Doesn't eliminate the ritual                              |
| Direct PTY spawn (node-pty)     | Faster, more reliable ready detection | Complex lifecycle; no tmux session persistence after server restart | Requires Phase 5 work; tmux is already in place           |
| MCP tool invocation from server | Clean abstraction                     | MCP server not available on the API process                         | MCP only attached to the Claude Code process, not the API |

---

## ADR-010: Local-Only Loopback Gate for Provisioning Endpoints

**Status**: Accepted
**Date**: 2026-06-10

### Context

The provisioning API (`POST/PUT/DELETE /api/agents/presets`, `spawn_agent`/`teardown_agent` WS messages) can execute shell commands on the host machine via tmux. Without access control, any process or browser tab that can reach the API server could spawn arbitrary agents or run crafted `skillInvocation` templates.

Phase 6 is planned to add shared-secret token auth for networked deployments. For Phase 4 the API is local-only (run on the operator's laptop) and auth machinery adds complexity with no current benefit.

### Decision

Accept `spawn_agent`, `teardown_agent`, and preset-write operations only from connections whose remote IP is a loopback address (`127.0.0.1`, `::1`, `::ffff:127.0.0.1`, `localhost`). This check is enforced in two places:

1. **HTTP** (`requireLoopback` middleware in `apps/api/src/routes/agents.ts`): rejects with 403 for non-loopback callers of `POST/PUT/DELETE /api/agents/presets`
2. **WebSocket** (`apps/api/src/ws.ts`): `clientIsLoopback` flag set on connection; `spawn_agent` and `teardown_agent` messages from non-loopback clients receive an error `spawn_progress` response and are not processed

Preset reads (`GET /api/agents/presets`) remain open — they are read-only and contain no credentials.

### Consequences

**Positive:**

- Zero-config protection against accidental network exposure while keeping local UX smooth
- The gate is trivially verifiable: same `isLoopback()` utility shared by HTTP and WS handlers
- No token management or login flows needed for the expected single-operator local use case

**Negative:**

- Does not protect against attacks from other processes on the same machine (local privilege escalation)
- Must be replaced before Phase 6 networking or the API is unsafe on any shared/networked machine
- Vite dev proxy is also loopback (`localhost:3000`) so the loopback check passes transparently in dev — no environment-specific code needed, but this means the gate is not exercised in a meaningful way during development

### Alternatives Considered

| Alternative                           | Pros                                   | Cons                                                           | Why Not                                          |
| ------------------------------------- | -------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------ |
| Shared-secret header token            | Protects against other local processes | Requires token distribution/storage; more complex client setup | Planned for Phase 6; premature for local-only v1 |
| OS-level firewall (no app-level gate) | Simpler code                           | Not portable; not testable in unit tests                       | App-level check is simpler to test and document  |
| No gate                               | No code                                | Any process on any machine can spawn agents                    | Unacceptable even for local-only dev             |

---

## ADR Template

```markdown
## ADR-XXX: [Title]

**Status**: Proposed | Accepted | Rejected | Superseded by ADR-XXX
**Date**: YYYY-MM-DD

### Context

What is the issue that we're seeing that is motivating this decision?

### Decision

What is the change that we're proposing and/or doing?

### Consequences

**Positive:**

- Benefit 1

**Negative:**

- Trade-off 1

### Alternatives Considered

| Alternative | Pros | Cons | Why Not |
| ----------- | ---- | ---- | ------- |
| Option A    | ...  | ...  | ...     |
```
