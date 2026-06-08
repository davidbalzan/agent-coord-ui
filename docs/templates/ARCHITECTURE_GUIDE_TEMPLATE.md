---
title: "Architecture Guide Template"
tags: [agent-coord-ui/template]
aliases: ["Architecture Template"]
---

# [Project Name] - Architecture Guide

> Documents **why** architectural decisions were made, not just what they are. This is the primary reference for AI agents and developers to understand the system's design philosophy and make consistent decisions.

---

## 🏗️ Current Architecture Overview

```
[ASCII diagram showing system components and primary data flow.
Replace this with your actual architecture. Example:]

┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend   │ ──▶ │   API Layer  │ ──▶ │   Database   │
│  ([Framework │ ◀── │ ([Framework  │ ◀── │ ([Database   │
│   + Version])│     │  + Version]) │     │  + Version]) │
└──────────────┘     └──────────────┘     └──────────────┘
       │                    │
       │              ┌─────┴──────┐
       │              │  Shared    │
       └──────────────│  Package   │
                      │  (Types &  │
                      │  Utilities)│
                      └────────────┘
```

### Key Components

- **[Component Name, e.g., "Web Frontend"]**: [Purpose, responsibility boundaries, and what it owns. Describe what requests it handles, what data it manages, and what it delegates to other components. E.g., "Handles all user interaction, client-side routing, form validation, and API communication. Does NOT handle business logic or data persistence."]
- **[Component Name, e.g., "API Server"]**: [Purpose, responsibility boundaries. E.g., "Handles request validation, authentication, business logic orchestration, and database operations. Serves as the single gateway to persistent data."]
- **[Component Name, e.g., "Shared Package"]**: [Purpose. E.g., "Provides TypeScript types, constants, and utility functions shared between frontend and backend. Ensures type safety across the API boundary."]

### Communication Patterns

- **Frontend ↔ API**: [Protocol and format — e.g., "REST over HTTPS, JSON payloads, typed with shared ApiResponse<T> wrapper"]
- **API ↔ Database**: [Access pattern — e.g., "ORM with query builder, connection pooling, prepared statements"]
- **Cross-Package**: [How packages communicate — e.g., "TypeScript project references with workspace: protocol, no runtime dependency on build artifacts"]

---

## 🤔 Why [Major Decision — e.g., "Monorepo with Turborepo"]?

> Document the reasoning behind each significant architectural choice. Repeat this section for each major decision.

### The Problem We're Solving

[Describe the specific problem or need that led to this decision. Be concrete about pain points. E.g., "Frontend and backend share many types and utilities. Without a monorepo, we'd need to publish packages to npm, manage versioning, and deal with synchronization issues during development."]

### Alternatives Considered

1. **[Alternative 1, e.g., "Separate Repositories"]**
   - **Pros**: [What this alternative does well — e.g., "Independent deployment, clear ownership boundaries"]
   - **Cons**: [Why we rejected it — e.g., "Type synchronization nightmare, slow development feedback loop, package publishing overhead"]
   - **Rejected because**: [The decisive factor — e.g., "Development velocity loss outweighs deployment flexibility at our current scale"]

2. **[Alternative 2, e.g., "Nx Monorepo"]**
   - **Pros**: [What this does well — e.g., "More features, computation caching, affected detection"]
   - **Cons**: [Why we rejected it — e.g., "Heavier configuration, steeper learning curve, more opinionated"]
   - **Rejected because**: [Decisive factor — e.g., "Turborepo covers our needs with significantly less configuration overhead"]

### Why Current Approach is Better

#### [Pattern/Approach Name — e.g., "Turborepo Workspaces"]

- [Concrete benefit with evidence — e.g., "Shared types via workspace: protocol eliminates type drift between frontend and backend"]
- [Concrete benefit — e.g., "Incremental builds with content-hash caching reduce CI time from ~5min to ~30s for unchanged packages"]
- [Concrete benefit — e.g., "Single PR for cross-cutting changes: a type change propagates to all consumers immediately"]

```tsx
// Example showing the preferred pattern in action
// [Demonstrate with real code from your project that illustrates why this approach works]
```

---

## 📁 Directory Structure

```
[Replace with your actual project structure. Annotate each directory
with its purpose, what files belong there, and what does NOT belong there.]

apps/
├── [app-1]/src/
│   ├── components/        # [Shared UI components — reusable across features, no business logic]
│   ├── features/          # [Feature modules — self-contained, domain-specific functionality]
│   │   └── [feature]/     # [Each feature owns its components, hooks, types, and tests]
│   ├── pages/             # [Route pages — thin wrappers that compose features and layout]
│   ├── hooks/             # [Shared hooks — cross-feature, generic React hooks only]
│   └── lib/               # [Utilities — API client, formatters, helpers with no React dependency]
│
├── [app-2]/src/
│   ├── routes/            # [Route handlers — request parsing, response formatting, delegation to services]
│   ├── middleware/         # [Request middleware — auth, validation, logging, error handling]
│   ├── services/          # [Business logic — pure functions/classes, no HTTP/framework dependency]
│   └── config/            # [Configuration — environment parsing, feature flags, constants]
│
packages/
├── [package-1]/src/       # [Shared types, constants, utilities — no runtime framework dependency]
└── [package-2]/src/       # [UI component library — framework-dependent but app-independent]
```

### Feature-Based Organization

> Both frontend and backend use **feature-based** organization. Each feature is self-contained with its own components, logic, types, and tests. This reduces coupling and makes it easy to understand, modify, or remove a feature.

```
features/
├── [feature-name]/
│   ├── components/        # (frontend) UI components specific to this feature
│   ├── hooks/             # (frontend) Custom hooks for this feature's data/state
│   ├── routes/            # (backend) Route handlers for this feature's endpoints
│   ├── services/          # (backend) Business logic for this feature's domain
│   ├── types.ts           # Types shared within this feature (exported via barrel if needed cross-feature)
│   └── __tests__/         # Tests co-located with the feature they test
```

### File Naming Conventions

- **Components**: `PascalCase.tsx` — [E.g., "UserProfile.tsx, DashboardCard.tsx"]
- **Hooks**: `camelCase.ts` with `use` prefix — [E.g., "useAuth.ts, useDebounce.ts"]
- **Services**: `camelCase.ts` — [E.g., "userService.ts, authService.ts"]
- **Types**: `camelCase.ts` — [E.g., "types.ts, api.ts, common.ts"]
- **Tests**: `[filename].test.ts(x)` — [Co-located with source file]
- **Constants**: `UPPER_SNAKE_CASE` exports in `camelCase.ts` files

---

## 🔗 Related Documents

- **[[DECISIONS|Decisions Log]]** - Detailed ADRs for every major architectural choice
- **[[TECH_STACK|Tech Stack]]** - Technology choices with versions, rationale, and upgrade risks
- **[[CURRENT_FOCUS|Current Focus]]** - What's actively being worked on and current phase
- **[[DESIGN_SYSTEM|Design System]]** - Visual language and component patterns (if frontend)

---

## 📈 Upgrade Paths

> Document when and how to evolve the architecture as the project grows. This prevents premature optimization while ensuring a clear migration path.

### Current State (Now)

**What**: [Current approach — e.g., "Simple REST API with direct database queries, React SPA with client-side routing"]
**Best for**: [Scale/use case this works for — e.g., "< 10k users, < 50 API endpoints, single dev team"]
**Effort**: None — already implemented

### Growing Complexity → [Next Approach, e.g., "Service Layer Extraction"]

**When to upgrade** (trigger conditions):

- [Measurable trigger — e.g., "API response time p95 exceeds 500ms under normal load"]
- [Measurable trigger — e.g., "More than 3 developers working on the same service simultaneously"]
- [Measurable trigger — e.g., "Feature development velocity drops below 1 feature/sprint due to coupling"]

**Migration effort**: [Low/Medium/High] ([X] days estimated)
**Migration strategy**: [Brief description — e.g., "Extract business logic into service layer, add caching, introduce message queue for async operations"]

### Maturity → [Advanced Approach, e.g., "Microservices / Event-Driven"]

**When to upgrade** (trigger conditions):

- [Measurable trigger — e.g., "Need independent scaling of specific services"]
- [Measurable trigger — e.g., "Multiple teams need autonomous deployment cycles"]

**Migration effort**: [Low/Medium/High] ([X] weeks estimated)

---

## 📋 Decision Matrix

> Quick reference for "what do I use for X?" questions. Links to detailed ADRs for full context.

| Need                              | Current Solution                               | Effort | When to Revisit                                                    | ADR Reference                   |
| --------------------------------- | ---------------------------------------------- | ------ | ------------------------------------------------------------------ | ------------------------------- | --------- |
| [Need — e.g., "State management"] | [Current — e.g., "React Context + useReducer"] | Low    | [Trigger — e.g., "When state logic spans > 5 components"]          | [[DECISIONS#adr-xxx             | ADR-XXX]] |
| [Need — e.g., "API caching"]      | [Current — e.g., "No caching"]                 | Medium | [Trigger — e.g., "When same data fetched > 3 times/session"]       | [ADR link or "Not yet decided"] |
| [Need — e.g., "Search"]           | [Current — e.g., "SQL LIKE queries"]           | High   | [Trigger — e.g., "When full-text search needed or > 100k records"] | [ADR link or "Not yet decided"] |

---

## ✅ Best Practices

> Patterns that all code in this project should follow. AI agents reference this section when generating code.

### 1. [Pattern Name — e.g., "API Response Wrapper"]

```tsx
// DO: Always wrap API responses in the shared ApiResponse<T> type
// This ensures consistent error handling and type safety across the boundary

// DON'T: Return raw data or ad-hoc response shapes
// This breaks client-side type safety and makes error handling inconsistent
```

### 2. [Pattern Name — e.g., "Error Handling"]

```tsx
// DO: Use typed error classes that map to HTTP status codes
// This centralizes error handling and ensures consistent API responses

// DON'T: Throw generic Error() or return status codes directly from services
// Services should not know about HTTP; that's the route handler's job
```

### 3. [Pattern Name — e.g., "Component Composition"]

```tsx
// DO: Compose features from small, focused components with clear props
// This makes components testable, reusable, and easy to understand

// DON'T: Create monolithic components that handle rendering, state, and side effects
// This makes components hard to test, modify, and reason about
```

---

## 📊 Performance Implications

### Current Baselines

```
[Measure and record these after initial implementation. Update as architecture evolves.]

Frontend:
  Bundle Size:     [X]kb gzipped — [How this compares to budget, e.g., "Target: < 200kb"]
  First Paint:     [X]ms — [Measurement conditions, e.g., "3G throttled, Lighthouse"]
  Time to Interactive: [X]ms

Backend:
  API Latency:     [X]ms p50, [X]ms p95 — [For which endpoints, e.g., "Health check baseline"]
  Throughput:      [X] req/s — [Measurement conditions]

Build:
  Full Build:      [X]s — [All packages from clean state]
  Incremental:     [X]s — [Single package change with cache]
  Dev Startup:     [X]s — [Time from pnpm dev to ready]
```

### Monitoring Checklist

- [What to monitor — e.g., "API error rate by endpoint, alert if > 1% over 5 minutes"]
- [What to monitor — e.g., "Database connection pool usage, alert if > 80% utilized"]
- [What to monitor — e.g., "Frontend Core Web Vitals via analytics, review weekly"]
- [What to monitor — e.g., "Dependency vulnerability scan, run daily in CI"]
