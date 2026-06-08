---
title: "Phase README Template"
tags: [agent-coord-ui/template]
aliases: []
---

# Phase [N]: [Phase Name]

**Duration**: [X] weeks — [Brief justification for estimate, e.g., "3 sprints based on task complexity analysis"]
**Status**: [🟢 Complete / 🟡 In Progress / ⚪ Not Started / 🔴 Blocked]
**Priority**: [🔴 Critical / 🟡 High / 🟢 Medium] — [Context for priority, e.g., "Foundation phase — blocks all subsequent phases"]

---

## 📋 Phase Overview

**Goal**: [One-liner measurable outcome — e.g., "Users can authenticate, access protected routes, and see a functional dashboard with real data from the database"]

**Current State**: [Where things stand before this phase begins — describe existing functionality, infrastructure, and quality level. E.g., "Project scaffolding exists with monorepo, basic API health endpoint, React starter shell. No auth, no database, no real features."]

**Target State**: [Where things should be after this phase completes — describe the delta in concrete terms. E.g., "Full auth flow (signup/login/logout/refresh), PostgreSQL with migrations, 5 core API endpoints, dashboard page consuming real data. Test coverage > 70% for new code."]

---

## 📊 Quick Stats

- **Sprints**: [N] ([Sprint names — e.g., "Setup, Core, Integration"])
- **Major Tasks**: [N] — [Brief description of task scope, e.g., "Each task represents a standalone deliverable that can be reviewed independently"]
- **New Files**: ~[N] files (~[N] lines) — [Estimated scope, e.g., "Based on similar features in comparable projects"]
- **Modified Files**: ~[N] files — [What existing files will change, e.g., "Mostly route registrations and type exports"]
- **Database Changes**: [Description if applicable — e.g., "3 new tables (users, sessions, profiles) with migration scripts" or "None — this phase is frontend-only"]
- **Test Coverage Target**: [N]%+ — [Scope of coverage, e.g., "Unit tests for all services, integration tests for API endpoints"]
- **Performance Target**: [Metric and target — e.g., "Auth endpoints respond < 100ms p95" or "Dashboard loads < 2s on 3G"]

---

## 🎯 Key Deliverables

### Sprint 1: [Sprint Name — e.g., "Setup & Foundation"] (Week [X])

> [Sprint goal — one sentence describing what this sprint achieves]

- [🟢 Complete / 🟡 In Progress / ⚪ Pending / 🔴 Blocked] **[Deliverable name]** — [What this delivers and how to verify it, e.g., "Database schema with migration scripts. Verified by running migrations on clean database and seeding test data."]
- [Status] **[Deliverable name]** — [What this delivers and verification method]
- [Status] **[Deliverable name]** — [What this delivers and verification method]

### Sprint 2: [Sprint Name — e.g., "Core Implementation"] (Week [X])

> [Sprint goal]

- [Status] **[Deliverable name]** — [Description and verification]
- [Status] **[Deliverable name]** — [Description and verification]

### Sprint 3: [Sprint Name — e.g., "Integration & Testing"] (Week [X]-[Y])

> [Sprint goal]

- [Status] **[Deliverable name]** — [Description and verification]
- [Status] **[Deliverable name]** — [Description and verification]

---

## ✅ Success Criteria

> All criteria must be met before this phase is considered complete. Use these as a checklist during phase review.

### Functional Requirements

- [ ] [Requirement with testable condition — e.g., "User can sign up with email/password, receives confirmation, and can log in with those credentials"]
- [ ] [Requirement with testable condition — e.g., "Protected API endpoints return 401 for unauthenticated requests and 200 with valid JWT"]
- [ ] [Requirement with testable condition — e.g., "Dashboard page loads and displays real data from the database within 2 seconds"]

### Quality Requirements

- [ ] [Quality gate with measurable threshold — e.g., "Test coverage >= 70% for all new code (measured by coverage tool)"]
- [ ] [Quality gate — e.g., "Zero TypeScript errors: `pnpm typecheck` passes across all packages"]
- [ ] [Quality gate — e.g., "Zero linting errors: `pnpm lint` passes with no warnings"]
- [ ] [Quality gate — e.g., "All API endpoints return proper error responses (not 500s) for invalid input"]

### Architecture Requirements

- [ ] [Architecture validation — e.g., "All new code follows feature-based organization as defined in ARCHITECTURE_GUIDE.md"]
- [ ] [Architecture validation — e.g., "No direct database access from route handlers — all queries go through service layer"]
- [ ] [Architecture validation — e.g., "Shared types used for all API request/response types — no inline type definitions"]

---

## ⚠️ Risks & Mitigation

| Risk                                                                    | Impact                                                                                         | Likelihood                     | Mitigation Strategy                                                                                                                |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| [Specific risk — e.g., "Database schema needs revision mid-phase"]      | [🔴 High / 🟡 Medium / 🟢 Low — explain impact, e.g., "Cascading changes to API and frontend"] | [🔴 High / 🟡 Medium / 🟢 Low] | [Concrete mitigation — e.g., "Start with minimal schema, use migrations for all changes, avoid premature optimization of queries"] |
| [Specific risk — e.g., "Third-party auth library has breaking changes"] | [Impact and explanation]                                                                       | [Likelihood]                   | [Mitigation — e.g., "Pin dependency version, test upgrade path before adopting, have fallback auth implementation"]                |
| [Specific risk — e.g., "Scope creep from discovered requirements"]      | [Impact and explanation]                                                                       | [Likelihood]                   | [Mitigation — e.g., "Strict scope boundary: anything not in deliverables list goes to Phase N+1 backlog"]                          |

---

## 🔗 Dependencies

- **Blocks**: [What this phase unblocks — e.g., "Phase 2 (Core Features) — cannot build authenticated features without auth system from this phase"]
- **Required (must have)**: [What must be done before this phase can start — e.g., "Project scaffolding: monorepo, build system, and dev environment must be functional" or "None — this is the first phase"]
- **Optional (nice to have)**: [Nice-to-have prerequisites that improve efficiency — e.g., "CI/CD pipeline: not required but speeds up validation" or "Design mockups: can start with wireframes and refine later"]

### External Dependencies

- [External dependency — e.g., "Database provisioning: PostgreSQL instance must be available (Docker Compose handles this locally)"]
- [External dependency — e.g., "API keys: any third-party service credentials must be obtained and added to .env"]

---

## 🚀 Getting Started

```bash
# 1. Ensure you're on the correct branch
git checkout -b feature/phase[N]-[name]

# 2. Review the detailed task plan (generated by /plan-phase)
# This file contains the step-by-step breakdown with checkboxes
cat docs/phases/phase[N]/PHASE[N]_TASKS.md

# 3. Check current focus
cat CURRENT_FOCUS.md

# 4. Start with Task 1 (tasks are ordered by dependency — follow the sequence)
# Each task has sub-steps; complete all sub-steps before marking the task done
# Run tests after each task: [test command, e.g., "pnpm test"]
# Verify types after each task: [typecheck command, e.g., "pnpm typecheck"]
```

### Before Starting Checklist

- [ ] Read this README fully — understand the goal, deliverables, and success criteria
- [ ] Read the detailed task plan (PHASE[N]\_TASKS.md) — understand the full scope
- [ ] Ensure all **Required** dependencies are met
- [ ] Confirm development environment is working (`pnpm dev` starts without errors)
- [ ] Review relevant ADRs in [[DECISIONS]] that affect this phase

---

## ⏭️ Next Phase

After completion: → [Phase N+1: [Name]](../phase[N+1]/) — [Brief description of what the next phase covers and how this phase enables it]
