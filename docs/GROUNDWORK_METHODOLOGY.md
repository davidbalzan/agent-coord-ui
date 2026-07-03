---
title: "Groundwork Methodology"
tags: [groundwork/core]
aliases: ["Methodology"]
---

# Groundwork Methodology

A documentation-driven approach to building software projects with AI assistance. This document serves as a prompt/template to bootstrap new projects with a structured, phase-based development methodology.

---

## 🎯 Philosophy

**Groundwork** is about maintaining momentum while building complex software with AI assistance. The key principles:

1. **Documentation as Code** - Plans are living documents with checkboxes that track progress
2. **Phase-Based Development** - Break overwhelming projects into digestible phases
3. **Progressive Disclosure** - Each phase folder contains increasing detail levels
4. **AI-Friendly Structure** - Clear hierarchy helps AI assistants maintain context
5. **Iterative Planning** - Plans evolve as you learn more about the domain

---

## 📁 Monorepo Project Structure

This approach uses a **monorepo structure** with separate packages for client and server, unified by shared documentation and tooling at the root level.

```
project-root/
├── README.md                    # Quick start, setup, overview
├── package.json                 # Root package.json (workspace config)
├── pnpm-workspace.yaml          # Workspace definition (or npm/yarn equivalent)
│
├── apps/
│   ├── web/                     # Frontend application
│   │   ├── package.json        # Client dependencies
│   │   ├── src/
│   │   │   ├── components/     # UI components
│   │   │   ├── features/       # Feature modules (domain logic + UI)
│   │   │   ├── pages/          # Route pages
│   │   │   ├── api/            # API client / WebSocket handlers
│   │   │   ├── store.ts        # State management
│   │   │   └── main.tsx        # Entry point
│   │   ├── public/             # Static assets
│   │   └── index.html
│   │
│   └── api/                     # Backend application
│       ├── package.json        # Server dependencies
│       ├── src/
│       │   ├── routes/          # REST route handlers
│       │   ├── features/        # Feature modules (business logic)
│       │   ├── middleware/      # Request middleware
│       │   ├── services/        # Shared services
│       │   ├── auth/            # Authentication logic
│       │   ├── config/          # Configuration management
│       │   ├── utils/           # Utility functions
│       │   └── index.ts         # Entry point
│       ├── migrations/          # (optional) DB migrations — added by /add-data-layer
│       └── drizzle.config.ts    # (optional) ORM config — added by /add-data-layer
│
├── packages/
│   └── shared/                  # Shared utilities and types
│       ├── package.json
│       └── src/
│           └── index.ts
│
└── docs/                        # Project documentation
    ├── README.md               # Documentation index & navigation
    ├── PRODUCTION_ROADMAP.md   # High-level roadmap with all phases
    ├── TECH_STACK.md           # Technology choices & versions
    ├── ARCHITECTURE_GUIDE.md   # System architecture & decisions
    │
    └── phases/                 # Detailed implementation plans
        ├── README.md          # Phase overview & progress tracking
        ├── phase1/
        │   ├── README.md      # Phase overview, deliverables, timeline
        │   └── PHASE1_TASKS.md # Detailed tasks with checkboxes
        ├── phase2/
        │   ├── README.md
        │   └── PHASE2_TASKS.md
        └── ... (phases 3-N)
```

### Why Monorepo?

- **Shared tooling** - Single ESLint, TypeScript, and Prettier config
- **Atomic commits** - Frontend and backend changes in one commit
- **Simplified dependencies** - Shared types, protocols, and utilities
- **Unified documentation** - One `docs/` folder covers the whole system
- **Easier refactoring** - Cross-package changes are easier to coordinate

### Package Boundaries

| Package            | Responsibility                         | Dependencies                |
| ------------------ | -------------------------------------- | --------------------------- |
| `apps/web/`        | UI, user interactions, state           | API client, shared types    |
| `apps/api/`        | Business logic, data persistence, auth | Database, external services |
| `packages/shared/` | Shared utilities, types, constants     | None                        |
| `docs/`            | Documentation only                     | N/A                         |

### Feature-Based Organization

Both `apps/web/` and `apps/api/` use a **feature-based** organization pattern inside their `features/` directories. Each feature is a self-contained module:

```
features/
├── wallet/                  # Wallet feature
│   ├── WalletDisplay.tsx   # (client) UI component
│   ├── walletSlice.ts      # (client) State management
│   ├── walletRoutes.ts     # (server) API routes
│   ├── walletService.ts    # (server) Business logic
│   └── walletTypes.ts      # Shared types
│
├── leaderboard/            # Leaderboard feature
│   ├── Leaderboard.tsx
│   ├── leaderboardRoutes.ts
│   └── ...
│
└── [feature-name]/         # Pattern repeats
```

**Benefits**:

- **Colocation** - Related code lives together
- **Discoverability** - Easy to find all code for a feature
- **Modularity** - Features can be developed/tested in isolation
- **Scalability** - Add new features without touching existing code

---

## 📋 Core Document Types

### 1. Production Roadmap ([[PRODUCTION_ROADMAP]])

**Purpose**: The master document that provides a bird's-eye view of the entire journey from POC to production. This is the first document stakeholders read.

**Key Sections Explained**:

#### Current State Assessment

Be brutally honest about where you are. This creates urgency and justifies the work.

```markdown
## Current State Assessment

### ✅ What We Have (POC Level)

- 6 working games (Slots, Wheel, Pigman, Blackjack, High/Low, Roulette)
- Basic wallet system (balance, transactions)
- WebSocket and REST APIs
- Interactive API documentation

### ⚠️ What's Missing for Production

- Authentication & authorization
- Rate limiting & abuse prevention
- Error handling & monitoring
- Security hardening
- Multi-tenancy support
```

#### Phase Breakdown

Each phase gets a summary with **specific deliverables** (not vague goals):

````markdown
## Phase 2: Authentication & Authorization

**Goal:** Implement flexible authentication supporting multiple providers
**Duration:** 3-4 weeks

### 2.1 Authentication Architecture

[Include ASCII diagrams showing the flow]

### 2.2 Implementation Tasks

- [ ] JWT validation middleware (support multiple issuers)
- [ ] Claims-based authorization middleware
- [ ] Role definition system (player, admin, operator, super-admin)
- [ ] Tenant isolation middleware

### 2.3 Authorization Roles & Permissions

```typescript
enum Role {
  PLAYER = "player", // Play games, view own data
  MODERATOR = "moderator", // Ban users, view reports
  OPERATOR = "operator", // Configure games, view analytics
  ADMIN = "admin", // Full access to tenant
}
```
````

````

#### Implementation Priority Matrix
The roadmap must clearly communicate **dependencies** and **blocking items**:

```markdown
## Implementation Priority Matrix

| Phase | Priority | Blocking? | Complexity | Duration |
|-------|----------|-----------|------------|----------|
| Phase 1: API Endpoints | 🔴 HIGH | Yes | Medium | 2-3 weeks |
| Phase 2: Auth | 🔴 HIGH | Yes | High | 3-4 weeks |
| Phase 3: Security | 🔴 HIGH | Yes | Medium | 2 weeks |
| Phase 4: Monitoring | 🟡 MEDIUM | No | Medium | 2 weeks |
| Phase 5: Performance | 🟡 MEDIUM | No | High | 2-3 weeks |
````

#### Quick Wins Section

Identify things that can be done **immediately** to show progress:

```markdown
## Quick Wins (Can Start Immediately)

1. **Enhanced Wallet Endpoints** (1 week)
   - Transaction history with filtering
   - Wallet summary endpoints
2. **Input Validation** (3 days)
   - Add Zod schemas to all endpoints
3. **Error Handling** (3 days)
   - Standardize error responses
   - Add structured logging
```

#### Success Metrics

Define what "done" looks like with **measurable criteria**:

```markdown
## Success Metrics

**Technical:**

- ✅ 99.9% uptime
- ✅ <200ms p95 API latency
- ✅ Support 10,000 concurrent users
- ✅ 0 critical security vulnerabilities

**Business:**

- ✅ 5+ tenants onboarded
- ✅ <24h tenant onboarding time
- ✅ Self-service documentation coverage >80%
```

---

### 2. Tech Stack (`TECH_STACK.md`)

**Purpose**: Project-level narrative of the technology choices and why they were made. **Version numbers are NOT restated here** — they live in exactly one place, [[STACK_MAP]], so they can never drift. `TECH_STACK.md` links to it.

**Key Sections**:

```markdown
# Project - Complete Tech Stack

## 📋 Overview

A **monorepo-based platform** built with modern web technologies.
For pinned versions and upgrade targets, see [[STACK_MAP]] (single source of truth).

## 🎨 Frontend (apps/web/)

- **React** — component UI with concurrent rendering
- **Vite** — dev server + build (HMR, ESM-native)
- **TypeScript** — strict mode across all packages
- **Tailwind CSS** — utility-first styling with design tokens

## 🖥️ Backend (apps/api/)

- **Node.js** — server runtime via `@hono/node-server`
- **Hono** — lightweight, Web-Standards web framework
- **Zod** — runtime validation at the edges

## 🗄️ Persistence (optional)

The starter ships **no database** by default — it is intentionally generic.
Add one when a feature needs it via `/add-data-layer` (Drizzle ORM + PostgreSQL
by default). Once adopted, its versions move into [[STACK_MAP]].

## 📦 Infrastructure

- **pnpm** — monorepo workspaces
- **Turborepo** — build orchestration + caching
- Local: Frontend `http://localhost:5173` · Backend `http://localhost:3000`

## 📈 Versions

See [[STACK_MAP]] — the canonical table of pinned versions, latest-stable targets,
and which files to touch when bumping each dependency.
```

> **Why no versions here?** Restating "Vite 6.x" in five documents guarantees four of
> them go stale. [[STACK_MAP]] is the only place a version number appears.

---

### 3. Architecture Guide (`ARCHITECTURE_GUIDE.md`)

**Purpose**: Documents **why** architectural decisions were made, not just what they are. Critical for onboarding and maintaining consistency.

**Key Sections**:

```markdown
# Project - Architecture Guide

## Current Architecture Overview
```

[ASCII diagram of system components]

````

## Why [Decision X]?

### Problems [Alternative] Creates
1. **Problem 1**
   - Code example showing the issue

2. **Problem 2**
   - Performance/maintenance implications

## Why Current Approach is Better

### [Pattern Name]
- ✅ Benefit 1
- ✅ Benefit 2
- ✅ Benefit 3

```tsx
// Code example showing the preferred pattern
````

## Related Documents

- **[[DECISIONS|Decisions Log]]** - Detailed ADRs for major choices
- **[[WORKSTREAMS|Workstreams]]** - Live state of parallel work streams

## Upgrade Paths

### Phase 1: Current State ✅ (Now)

**What:** Current approach
**Best for:** Current scale
**Effort:** None - already implemented

### Phase 2: Growing Complexity → [Next Approach]

**When to upgrade:**

- Trigger condition 1
- Trigger condition 2

**Migration effort:** Low/Medium/High (X days)

## Decision Matrix

| Need              | Solution   | Effort   | When     |
| ----------------- | ---------- | -------- | -------- |
| Quick prototype   | Current    | ⭐       | Now ✓    |
| Prevent conflicts | Next level | ⭐⭐     | Growth   |
| External sharing  | Advanced   | ⭐⭐⭐⭐ | Maturity |

## Best Practices

### 1. Pattern Name

```tsx
// DO: Good example
// DON'T: Bad example
```

## Performance Implications

### Current Approach

```
Bundle Size: Xkb
Runtime: Optimal
```

````

---

### 3a. Domain Context (`CONTEXT.md`)

**Purpose**: The project's **ubiquitous language** — a glossary of canonical domain terms
(each with the synonyms to `_Avoid_`), kept free of implementation detail. For systems
with multiple bounded contexts, a `CONTEXT-MAP.md` lists the contexts and their
relationships, with a `CONTEXT.md` beside each context's code.

Built and sharpened with `/domain-model` (run during `/kickstart` Stage 3 and whenever
terminology is being decided). Read at `/start-session` so the assistant uses your terms,
and consulted by `/plan-phase` when naming tasks and types. Precise shared vocabulary up
front keeps architecture, types, and phases consistent.

---

### 4. Workstreams (`WORKSTREAMS.md`)

**Purpose**: The live state of every parallel stream of work — the swarm-native
replacement for a single "current focus". With multiple agents (or people) working
at once there is no one "current" task; there are several concurrent streams, each
with an owner, a branch/worktree, and a status. Working solo is just the one-row case.

It is the live counterpart to the [[QUEUE]]:

- **`QUEUE.md`** = the *inbound* queue — what to pick up next.
- **`WORKSTREAMS.md`** = the *live* state — what is in flight right now.
- **`DONE.md`** = the *completion log* — what shipped, append-only.

**Key Sections**:

```markdown
# Workstreams

## Active Streams

| Stream         | Owner / Agent | Branch · Worktree            | Status         | Blocker | Last note          |
| -------------- | ------------- | ---------------------------- | -------------- | ------- | ------------------ |
| Phase 2 · Auth | agent-api     | `feat/phase2-auth` · wt-auth | 🚧 In Progress | None    | RBAC next          |
| Bugfix · logs  | agent-infra   | `fix/log-rotation` · wt-log  | 🔍 In Review   | None    | PR open            |

## Recently Closed

- ✅ Phase 1 · Foundation — agent-api · merged YYYY-MM-DD
```

**Usage**:

- Update with `/update-workstreams` whenever a stream starts, progresses, or closes.
- One row per live stream; closed streams move to `Recently Closed`.
- Record branch + worktree so any agent can resume the exact context.

---

### 4a. Multi-agent seam

Groundwork works **solo out of the box** — a single-row `WORKSTREAMS.md`, no coordinator,
no extra machinery. The multi-agent seam is an **optional upgrade**: when you want a
swarm, Groundwork hands off cleanly to an **external coordinator** via a file contract
split by writer: `QUEUE.md` (inbound) → `WORKSTREAMS.md` (live) → `DONE.md` (completion
log). It never bundles or depends on the orchestration layer.

```
            ┌─────────────┐   pulls next   ┌──────────────┐   writes live   ┌────────────────┐
/plan-phase │  QUEUE.md   │ ─────────────▶ │ Coordinator  │ ──────────────▶ │ WORKSTREAMS.md │
  + human   │  (inbound)  │                │  + workers   │ ──appends──▶ DONE.md (log)       │
            └─────────────┘                └──────────────┘                 └────────────────┘
```

- **`QUEUE.md`** — written by `/plan-phase` and the human, and nobody else. Each phase is
  one queue item.
- The coordinator pulls the next unblocked item, opens a stream, and updates
  **`WORKSTREAMS.md`** as work progresses — the same file `/update-workstreams` writes.
  On completion it appends one line to **`DONE.md`** (its only write in the queue seam) —
  one writer per *file*, so concurrent edits never contend.
- The coordinator's protocol (rooms, worktrees, messaging) stays **out** of Groundwork.
  The only coupling is these files — so the methodology is portable across any
  orchestration layer (or none).

**Dependency direction (one-way):** the coordinator depends on Groundwork's seam, **not
the reverse**. Groundwork has no knowledge of any coordinator and runs fully without one.

**Reference coordinator:** **`coord-mcp`** — an MCP-based coordination server (rooms +
worktree isolation over a shared bus) — is the reference implementation of this seam. It
reads `QUEUE.md` and writes `WORKSTREAMS.md` + `DONE.md`, and is an **optional layer that
builds on a Groundwork-initialised project**. MCP keeps it harness-agnostic (works across
Claude Code, Cursor, etc.), the same principle as Groundwork itself. Any other orchestrator
that honours the file contract drops in just as well.

**The board lives in `WORKSTREAMS.md`.** Under a coordinator, `WORKSTREAMS.md` *is* the
single board: the core (`## Active Streams` + `## Recently Closed`) that `/update-workstreams`
writes, plus coordinator-only extension sections after a fence (Open PRs, Cutover Gates, Needs
David, Risks, Rooms, Decisions Recorded). `/update-workstreams` and `groundwork status` parse
only the core and preserve the extensions verbatim. There is no separate board file.

**Repo shape ↔ bus topology.** A **monorepo** runs **one** coordination bus over a single
worktree space — the simplest setup for a swarm, and why agents work better here (shared
context, atomic cross-package changes). **Split repos** are supported, but you assign a
`coord-mcp` bus **per module/repo**, which is more to coordinate and makes cross-repo
changes harder. Prefer a monorepo for agentic work; reach for split repos only when module
boundaries genuinely demand separate repos.

---

### 4b. Testing philosophy (spec-first, minimal tests)

Groundwork is **spec-first, not test-first** — by deliberate choice, not omission. Rigor
lives in the **docs/spec** (PRD, ARCHITECTURE_GUIDE, CONTEXT, phase tasks), and the spec is
the artifact you invest in. Heavy test suites are treated as optional, not default.

**Why minimal tests:**

- Capable systems ship this way — the spec + a running app you actually exercise covers
  most correctness.
- Tests are **context/token weight**: an agent reloads them on every pass. Tests you can
  live without are negative value. Spend the effort speccing instead.

**Why it holds in a swarm:** a coordinated swarm self-QAs. Specialised agents own
**drift management** — they review changes against the spec and each other's work — which
substitutes for the regression net a test suite would otherwise provide *within* the swarm.

**⚠️ Where tests still earn their keep — human handover.** The model above relies on the
spec discipline *and* the swarm's QA layer. Hand the project to **other humans who engineer
differently** — less agentic, more manual — and neither safety net applies for them:
silent regressions surface. Before/at a human handover, add a thin **tripwire** — `build` +
`typecheck` pass, plus a handful of **smoke/integration tests on the critical paths only**
(not coverage targets, not unit tests everywhere). Tests as insurance on what would hurt if
it broke, not as a discipline.

**Verification is the bottleneck, not building.** With agents, *adding* a feature is cheap —
so cheap that they over-produce. *Trusting* one is not: every feature still needs a gate,
and for now that gate is human. Two rules follow:

- **Build only what was requested/specced.** Unrequested features are a liability — they add
  review burden without delivering requested value. Surface ideas as suggestions; don't
  silently ship them.
- **"Done" means human-gated, not just implemented.** Keep scope tight so the review queue
  stays manageable — the limiting resource is reviewer time, not agent output.

**Future improvement:** revisit a thin automated verify layer (smoke + build gate in the
work loop) as model/token costs fall — the context-bloat objection weakens as inference gets
cheaper, and some gating can shift from humans to swarm QA. Tracked as a deliberate "later,"
not an oversight.

---

### 5. Decisions Log (`DECISIONS.md`)

**Purpose**: Architectural Decision Records (ADRs) that capture the "why" behind significant technical choices. Invaluable for onboarding and preventing repeated debates.

**Key Sections**:

```markdown
# Architectural Decision Records

## 📋 Decision Log

| ID      | Decision                  | Status      | Date       |
| ------- | ------------------------- | ----------- | ---------- |
| ADR-001 | Use Hono over Express     | ✅ Accepted | 2026-01-12 |
| ADR-002 | PostgreSQL for primary DB | ✅ Accepted | 2026-01-13 |

---

## ADR-001: Use Hono over Express

**Status**: ✅ Accepted
**Date**: 2026-01-12
**Deciders**: Engineering team

### Context

Need to choose a web framework for the API server.

### Decision

Use **Hono** for its TypeScript-first design and OpenAPI integration.

### Consequences

**Positive:**

- Type-safe routing out of the box
- Built-in OpenAPI generation
- Lightweight (~14kb)

**Negative:**

- Smaller ecosystem than Express
- Team needs to learn new patterns

### Alternatives Considered

| Alternative | Why Not                                |
| ----------- | -------------------------------------- |
| Express     | Legacy patterns, no native TypeScript  |
| Fastify     | More complex, less OpenAPI integration |
```

**When to Write an ADR**:

- Choosing between technologies
- Defining architectural patterns
- Security or compliance decisions
- Any decision a new team member would question

**Key Rule**: ADRs are immutable. If a decision changes, mark old as "Superseded" and create new ADR.

---

### 6. Design System (`DESIGN_SYSTEM.md`)

**Purpose**: Visual language reference for consistent UI. Essential for AI when generating frontend code.

**Key Sections**:

```markdown
# Project - Design System

## Color Palette

### Primary Colors

- **Primary**: `#3b82f6` - Main actions, buttons
- **Primary Dark**: `#1e40af` - Hover states
- **Primary Light**: `#dbeafe` - Backgrounds

### Status Colors

- **Success**: `#10b981` (Green) - Positive feedback
- **Warning**: `#f59e0b` (Amber) - Cautions
- **Error**: `#ef4444` (Red) - Errors, destructive

### Neutral Scale
```

50 #f9fafb (Page background)
100 #f3f4f6 (Alt background)
200 #e5e7eb (Borders)
500 #6b7280 (Secondary text)
900 #111827 (Primary text)

````

## Typography

### Font Stack

```css
--font-primary: "Inter", sans-serif;
```

### Type Scale

- **Display**: 24px - Page headings
- **Title**: 18px - Section headings
- **Body**: 14px - Main content
- **Caption**: 12px - Meta info

## Components

### Cards

```css
background: #ffffff;
border: 1px solid #e5e7eb;
border-radius: 12px;
box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
```

### Buttons

```tsx
// Primary
className =
  "bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700";

// Secondary
className = "bg-gray-100 text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-200";
```

## Spacing Scale

```
1   4px
2   8px
4   16px
6   24px
8   32px
```

## Accessibility

### Contrast Ratios

- Normal text: Minimum 4.5:1
- Large text: Minimum 3:1

### Focus States

- 2px focus ring on all interactive elements

````

---

### 7. Phases Overview (`phases/README.md`)

**Purpose**: Track overall phase progress, provide navigation, and summarize each phase.

**Structure**:
```markdown
# Production Readiness Phases

## 📂 Phase Organization
Each phase has its own folder with:
- [[README]] - Phase overview and quick reference
- `PHASE[N]_TASKS.md` - Detailed task breakdown with checklists

## 🗺️ Roadmap Overview
| Phase | Focus Area | Duration | Status |
|-------|-----------|----------|--------|
| [Phase 1](./phase1/) | [Description] | X weeks | 🚧 Ready to Start |

## 📋 Phase Summaries

### Phase 1: [Name] (X weeks)
**Goal**: [One-liner goal]

**Key Deliverables**:
- Deliverable 1
- Deliverable 2

**Success Criteria**: [How we know it's done]

---
[Repeat for each phase]

## 📊 Progress Tracking
- **Completed Phases**: 0/N
- **Current Phase**: Phase 1
- **Overall Progress**: 0%

## 📝 Documentation Standards
Each phase follows the same structure:
- Clear overview with goals and deliverables
- Detailed task breakdown with checkboxes
- Code examples and implementation patterns
- Testing requirements
- Success criteria
````

---

### 8. Individual Phase README (`phases/phaseN/README.md`)

**Purpose**: Quick reference for a specific phase. Used for sprint planning, stakeholder updates, and onboarding new team members to a phase.

**Key Sections Explained**:

````markdown
# Phase 2: Authentication & Authorization

**Duration**: 3-4 weeks  
**Status**: 🚧 IN PROGRESS  
**Priority**: 🔴 CRITICAL - Blocking for production

---

## 🎯 Phase Overview

**Goal**: Implement flexible authentication supporting external providers with full RBAC.

**Current State**: No authentication - all endpoints publicly accessible  
**Target State**: JWT-based auth with role-based access control and tenant isolation

---

## 📊 Quick Stats

- **Sprints**: 3 (Foundation, RBAC, Multi-Tenancy)
- **Major Tasks**: 10
- **New Files**: ~25 files (~3,500 lines)
- **Database Changes**: 4 new tables + 5 modified
- **Test Coverage Target**: 80%+
- **Performance Target**: Auth latency <20ms p95

---

## 🎯 Key Deliverables

### Sprint 1: Auth Foundation (Week 1)

- ✅ JWT verification middleware
- ✅ Claims extraction
- ✅ WebSocket authentication

### Sprint 2: Authorization & RBAC (Week 2)

- ✅ Role-based access control
- ✅ Permission enforcement
- ✅ Audit logging

### Sprint 3: Multi-Tenancy (Week 3-4)

- ✅ Tenant isolation
- 🚧 Rate limiting
- ⏳ API key authentication

---

## ✅ Success Criteria

### Functional Requirements

- [ ] All API endpoints require valid authentication
- [ ] WebSocket connections require authentication
- [ ] Role-based access control (RBAC) enforced
- [ ] Admin endpoints restricted to admin/operator roles
- [ ] Players can only access their own data
- [ ] Multi-tenancy with complete data isolation

### Security Requirements

- [ ] JWT signature verification using JWKS
- [ ] Token expiration checking
- [ ] Tenant isolation verified (no cross-tenant access)
- [ ] API keys stored as hashed values
- [ ] Error messages don't leak sensitive info

### Quality Requirements

- [ ] 80%+ test coverage for auth code
- [ ] Auth latency <20ms p95
- [ ] All endpoints documented with required permissions
- [ ] Zero breaking changes to existing game logic

---

## ⚠️ Risks & Mitigation

| Risk                          | Impact      | Likelihood | Mitigation                                     |
| ----------------------------- | ----------- | ---------- | ---------------------------------------------- |
| Token refresh race conditions | 🟡 Medium   | 🟡 Medium  | Queue requests during refresh                  |
| Cross-tenant data leakage     | 🔴 Critical | 🟢 Low     | Database-level tenant filters, security review |
| Performance degradation       | 🟡 Medium   | 🟡 Medium  | Cache JWKS keys, optimize middleware           |
| Integration complexity        | 🟡 Medium   | 🔴 High    | Incremental rollout, feature flags             |

---

## 🔗 Dependencies

- **Blocks**: Phase 3 (Security), Phase 4 (Monitoring)
- **Required**: Phase 1 (API Endpoints) - COMPLETE
- **Optional**: Redis (for rate limiting - can add later)

---

## 🚀 Getting Started

```bash
# 1. Create development branch
git checkout -b feature/phase2-auth

# 2. Review the detailed task plan
cat docs/phases/phase2/PHASE2_TASKS.md

# 3. Start with Task 1 (Auth Types)
# Follow sub-steps in the task document
```
````

---

## 🎯 Next Phase

After completion: → [Phase 3: Security Hardening](../phase3/)

````

---

### 9. Phase Tasks (`phases/phaseN/PHASEN_TASKS.md`)

**Purpose**: The most detailed document. This is where AI and developers spend most of their time. Each task must be specific enough that someone unfamiliar with the codebase can execute it.

**Key Sections Explained**:

#### Header with Real-Time Status
Always include current progress prominently at the top:

```markdown
# Phase 2: Authentication & Authorization - Implementation Plan

**Duration:** 3-4 weeks
**Status:** 🚧 IN PROGRESS (Sprint 3 - Task 8 complete)
**Priority:** 🔴 HIGH - Blocking for production
**Last Updated:** 2025-10-24

### 📈 Current Progress
- ✅ Sprint 1 (Auth Foundation): 100% complete (4/4 tasks)
- ✅ Sprint 2 (Authorization & RBAC): 100% complete (3/3 tasks)
- 🚧 Sprint 3 (Multi-Tenancy): 75% complete (3/4 tasks done)

**Components Implemented:** 9.75 / 10 (97.5%)
**Lines Added:** +3,450 / ~3,500
**Branch:** `feature/phase2-auth-multitenant`
````

#### 🔍 Audit Summary with Risk Assessment

**This is critical.** Before writing tasks, you must audit the current state and identify risks:

```markdown
## 🔍 Authentication Audit Summary

**CRITICAL FINDINGS**: Currently **NO authentication or authorization** exists.

### 📊 Security Gaps Identified:

- **No Authentication**: All API endpoints are publicly accessible
- **No Authorization**: No role-based access control (RBAC)
- **No Tenant Isolation**: Single-tenant architecture
- **Direct playerId Access**: Any client can impersonate any player
- **Admin Endpoints Exposed**: `/api/wallet/freeze` has no protection

### ⚠️ Impact Assessment:

- **Critical Security Risk**: Anyone can access/modify any player's data
- **No Production Readiness**: Cannot deploy without authentication
- **Compliance Risk**: GDPR/privacy violations without access controls
- **Business Risk**: Cannot support multiple tenants/customers
- **Fraud Risk**: No protection against player impersonation

### 📈 Scale of Work:

- **10 Major Tasks** (Tasks 1-10) → ✅ **7 COMPLETE**, **3 REMAINING**
- **45+ Sub-Steps** → ✅ **38 COMPLETED**, **7+ REMAINING**
- **3-4 Weeks** estimated → **~1 Week REMAINING**
```

#### 🎯 Target Architecture

Include **diagrams** (ASCII is fine) showing the end state:

```markdown
## 🎯 Target Architecture

### Authentication Flow
```

┌─────────────────────────────────────────────────────────┐
│ External Auth Provider │
│ • OAuth2 / OpenID Connect │
│ • Custom JWT issuer │
└────────────────┬────────────────────────────────────────┘
│ Issues JWT token
▼
┌─────────────────────────────────────────────────────────┐
│ Game1 API Server (Middleware) │
│ ┌──────────────────────────────────────────────────┐ │
│ │ 1. JWT Verification Middleware │ │
│ │ • Validate signature (JWKS) │ │
│ │ • Check expiration │ │
│ └──────────────┬───────────────────────────────────┘ │
│ ▼ │
│ ┌──────────────────────────────────────────────────┐ │
│ │ 2. Authorization Middleware │ │
│ │ • Check required permissions │ │
│ │ • Enforce tenant isolation │ │
│ └───────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────┘

```

### Directory Structure (New)
```

apps/api/src/auth/
├── middleware/
│ ├── jwtAuth.ts # JWT verification
│ ├── requireAuth.ts # Enforce authentication
│ └── requireRole.ts # Role-based authorization
├── providers/
│ ├── JwtProvider.ts # JWT-based auth provider
│ └── ApiKeyProvider.ts # API key provider
├── types.ts # Auth type definitions
└── roles.ts # Role definitions

```

```

#### 📋 Task Structure with Completion Tracking

Each task should be **comprehensive** with sub-steps and completion notes:

```markdown
## 📋 Implementation Tasks

### Sprint 1: Authentication Foundation (Week 1)

#### ✅ Task 1: Auth Configuration & Types

**Priority**: 🔴 CRITICAL  
**Complexity**: 🟢 EASY  
**Package**: `apps/api/src/auth/`  
**Dependencies**: None
**Status**: ✅ COMPLETE

**Sub-Steps**:

- [x] 1.1: Create `auth/types.ts` with TypeScript interfaces
- [x] 1.2: Create `auth/roles.ts` with role and permission enums
- [x] 1.3: Create `auth/config.ts` for auth configuration
- [x] 1.4: Add environment variables to `.env.example`
- [x] 1.5: Document auth configuration in README

**Deliverables**:

- ✅ `auth/types.ts` (167 lines) - AuthUser, AuthClaims, AuthProvider
- ✅ `auth/roles.ts` (220 lines) - 5 roles, 21 permissions
- ✅ `auth/config.ts` (190 lines) - Multi-mode config

**✅ COMPLETION NOTES**:

- All TypeScript types properly defined with full JSDoc
- RBAC system: 5 roles (Player→Super Admin), 21 permissions
- Multi-mode auth: Production, Development, Disabled
- Total: 577 lines of production-ready code
- Commit: 408bae6

---

#### 🚧 Task 8: Multi-Tenancy Implementation

**Priority**: 🔴 CRITICAL  
**Complexity**: 🔴 HARD  
**Package**: `server/src/`  
**Dependencies**: Tasks 1-6
**Status**: 🚧 IN PROGRESS (Sessions 1-3 Complete)

**Implementation Strategy**: Phased approach with 4 sessions:

- ✅ **Session 1**: Schema & Foundation (Complete)
- ✅ **Session 2**: Query Updates (Complete)
- ✅ **Session 3**: Advanced Features (Complete)
- ⏳ **Session 4**: Testing & Polish (Remaining)

**Sub-Steps**:

- [x] 8.1: Create tenants table
- [x] 8.2: Add `tenant_id` to all existing tables
- [x] 8.3: Create database migration for tenant columns
- [x] 8.4: Create tenant isolation helpers
- [x] 8.5: Update all Drizzle queries to include `tenant_id` filter
- [x] 8.6: Add tenant context to WebSocket connections
- [x] 8.7: Implement tenant management API
- [ ] 8.8: Write multi-tenancy tests (Session 4)
- [ ] 8.9: Performance test with multiple tenants (Session 4)

**Known Issues**:

1. **Scalar Lock Icon Missing**: Only 7 of 29 endpoints have `security`
   - Fix: Add global security to OpenAPI root
2. **WebSocket Tenant Context**: Currently using hardcoded 'default'
   - Fix: Extract tenantId from JWT in WebSocket auth

**Session 3 Deliverables**:

- ✅ `server/src/api/tenants.ts` - Tenant management API (223 lines)
- ✅ `docs/TENANT_SECURITY_ANALYSIS.md` (152 lines)
- ✅ Updated 29 API endpoints with tenant filtering
```

---

## ⚠️ Risk Identification & Mitigation

**Risk management is embedded throughout the task documents.** Here's how:

### Risk Categories to Track

```markdown
### ⚠️ Risk Assessment

| Risk                             | Impact      | Likelihood | Mitigation                                          |
| -------------------------------- | ----------- | ---------- | --------------------------------------------------- |
| Database performance degradation | 🔴 High     | 🟡 Medium  | Add indexes on tenant_id, test with large datasets  |
| Breaking changes to API          | 🔴 High     | 🟢 Low     | Version API, comprehensive testing, backward compat |
| Scope creep                      | 🟡 Medium   | 🔴 High    | Stick to defined endpoints, defer nice-to-haves     |
| Testing time underestimated      | 🟡 Medium   | 🟡 Medium  | Write tests in parallel with implementation         |
| Security bypass vulnerability    | 🔴 Critical | 🟢 Low     | Penetration testing, security review                |
```

### Risk Indicators in Task Status

Use status indicators to flag risky tasks:

```markdown
#### Task 4: WebSocket Authentication

**Priority**: 🔴 CRITICAL  
**Complexity**: 🔴 HARD ← Red = high risk
**Risk Flag**: ⚠️ Integration complexity with existing game handlers
```

### Known Issues Section

Every task in progress should document discovered issues:

```markdown
**Known Issues**:

1. **Token Refresh Race Condition** ⚠️
   - Problem: Concurrent requests during refresh cause 401s
   - Workaround: Queue requests during refresh
   - Fix ETA: Task 9
2. **Memory Leak in Auth Cache** 🟡
   - Problem: JWKS cache not invalidating properly
   - Impact: ~2MB/hour growth
   - Fix: Add TTL cleanup in Task 10
```

### Security Considerations Section

For security-critical phases, include explicit guidance:

```markdown
### Security Considerations

- **Never log tokens** in plain text
- **Use secure random** for API key generation
- **Hash API keys** before storage (bcrypt or argon2)
- **Rotate JWKS keys** periodically
- **Set proper CORS** per tenant
- **Use HTTPS** in production (enforce)
- **Implement token refresh** coordination
```

### Migration & Compatibility Notes

Document how changes affect existing functionality:

```markdown
### Compatibility Notes

- Maintain REST API contract (no breaking changes)
- WebSocket protocol unchanged (auth in connection, not messages)
- Game logic unchanged (replace hardcoded playerId with auth user)
- Frontend changes minimal (add Authorization header, handle 401)

### Migration Strategy

- **Phase 2.1** (Week 1): Add auth middleware as optional
- **Phase 2.2** (Week 2-3): Enable on new endpoints first
- **Phase 2.3** (Week 4): Full enforcement, remove optional mode
```

---

## 🚀 Getting Started Checklist

When bootstrapping a new project:

### 1. Create Monorepo Structure

```bash
# Create package structure
mkdir -p apps/web/src/{components,features,pages,api}
mkdir -p apps/api/src/{routes,features,middleware,services,auth,config,utils}
mkdir -p packages/shared/src
mkdir -p docs/phases/phase{1,2,3,4,5}/

# Initialize workspaces
npm init -y
# Edit package.json to add workspaces or pnpm-workspace.yaml
```

### 2. Create Core Documents

- [ ] [[README]] - Project overview, quick start
- [ ] [[WORKSTREAMS]] - Live state of parallel work streams (AI session handoffs)
- [ ] [[QUEUE]] - Inbound task queue (feeds an external coordinator)
- [ ] [[DONE]] - Completion log (append-only, executor-written)
- [ ] [[TECH_STACK]] - Technology choices (versions live in [[STACK_MAP]])
- [ ] [[STACK_MAP]] - Single source of truth for versions
- [ ] [[ARCHITECTURE_GUIDE]] - Why decisions were made, patterns
- [ ] [[DECISIONS]] - Architectural Decision Records (ADRs)
- [ ] [[DESIGN_SYSTEM]] - Colors, typography, components
- [ ] [[PRODUCTION_ROADMAP]] - High-level roadmap
- [ ] `docs/phases/README.md` - Phase overview

### 3. Define Your Phases

Identify 4-8 major phases based on:

- **Foundation** - Core infrastructure, basic features
- **Security** - Auth, validation, hardening
- **Quality** - Testing, monitoring, observability
- **Scale** - Performance, caching, optimization
- **Operations** - DevOps, deployment, backups
- **Experience** - DX, documentation, SDKs
- **Compliance** - Legal, regulatory, auditing

### 4. Create Phase Documents

For each phase:

- [ ] `docs/phases/phaseN/README.md` - Overview
- [ ] `docs/phases/phaseN/PHASEN_TASKS.md` - Detailed tasks

### 5. Start Phase 1

- [ ] Audit current state of the codebase
- [ ] Generate detailed task breakdown with checkboxes
- [ ] Begin implementation with checkbox tracking

---

## 🔄 Workflow

### Daily Development Flow

1. Open current `PHASEN_TASKS.md`
2. Find next unchecked task
3. Implement with AI assistance
4. Check off completed sub-tasks
5. Update status section
6. Commit with descriptive message

### Phase Completion Flow

1. Verify all checkboxes in `PHASEN_TASKS.md`
2. Update phase README status
3. Update `phases/README.md` progress
4. Update [[PRODUCTION_ROADMAP]] status
5. Create branch for next phase
6. Begin next phase planning

### Adding New Phases

1. Copy existing phase folder structure
2. Audit the codebase for the new phase's scope
3. Generate comprehensive task breakdown with AI assistance
4. Update roadmap and phase README

---

## 💡 Best Practices

### For Documentation

- **Use emojis** for visual scanning (✅ 🚧 ⏳ 🎯 ⚠️)
- **Keep checkboxes granular** - Each should be ~1-4 hours of work
- **Update status sections** - Future you will thank you
- **Link between documents** - Navigation matters

### For AI Collaboration

- **Seed context** - AI reads your docs to understand the project
- **Reference task IDs** - "Working on Task 3.2" gives clear context
- **Keep tasks atomic** - AI works better with focused tasks
- **Document decisions** - Add notes about why, not just what

### For Progress Tracking

- **Daily updates** - Check boxes as you complete them
- **Phase boundaries** - Don't blur phases together
- **Celebrate wins** - ✅ COMPLETE feels good

---

## 📊 Status Indicators

Use consistently across all documents:

| Indicator | Meaning           |
| --------- | ----------------- |
| ✅        | Complete          |
| 🚧        | In Progress       |
| ⏳        | Not Started       |
| 🔴        | Critical Priority |
| 🟡        | Medium Priority   |
| 🟢        | Low Priority      |
| ⚠️        | Warning/Risk      |
| 🎯        | Goal/Target       |
| 📋        | Task List         |
| 📊        | Statistics        |
| 📅        | Timeline          |
| 🔗        | Dependencies      |

---

## 🎨 Customization Points

Adapt this template for your domain:

1. **Phase Names** - Match your domain (e.g., "Data Pipeline" instead of "API Endpoints")
2. **Success Metrics** - Define what matters for your project
3. **Risk Categories** - Identify domain-specific risks
4. **Timeline Estimates** - Calibrate to your team velocity
5. **Quality Gates** - Set appropriate coverage/latency targets

---

**This document is your starting point. Fork it, adapt it, and make it yours.**

The goal isn't perfect documentation—it's maintaining momentum while building complex software with AI assistance. Let the checkboxes guide you forward. 🚀
