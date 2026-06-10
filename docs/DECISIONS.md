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
