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

| ID      | Decision                                                        | Status   | Date       |
| ------- | --------------------------------------------------------------- | -------- | ---------- |
| ADR-001 | [Monorepo with Turborepo](#adr-001-monorepo-with-turborepo)     | Accepted | 2026-02-20 |
| ADR-002 | [React + Vite for Frontend](#adr-002-react--vite-for-frontend)  | Accepted | 2026-02-20 |
| ADR-003 | [Node.js + Hono for Backend](#adr-003-nodejs--hono-for-backend) | Accepted | 2026-02-20 |

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
