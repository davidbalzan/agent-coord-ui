---
title: "Phase 6: UI Componentization & Design System"
tags: [agent-coord-ui/phase]
aliases: ["Phase 6"]
---

# Phase 6: UI Componentization & Design System

**Duration**: 1–2 weeks — incremental, behavior-preserving; pace set by safe small PRs, not raw effort.
**Status**: ⚪ Not Started
**Priority**: 🟡 High — the web app is ~9.5k LOC with heavy duplication; refactoring now (during a feature lull) pays off in maintainability, consistency, and readability before more features pile on.

---

## 📋 Phase Overview

**Goal**: Extract a small design-system layer (tokens + primitive components) and split the mega-files, with **zero behavior change** — so files are readable whole, the NEXUS look is defined once, and feature work gets faster + less bug-prone.

**Current State**: ~9,473 LOC across `apps/web/src/components` + store. `Graph3D.tsx` is 1,645 lines; BacklogPanel 852, AgentLauncher 750, FloatingTerminal 610, HUD 566, InboxPanel 549, NodeRadialMenu 515, ActivityLog 486. Duplication: glass surface inlined in 6 files, `holo-btn` in 6, the prefix→severity colour map copy-pasted in **4 files** (drift risk — already caused panel-color inconsistencies), `Share Tech Mono` inlined in **18 files** (no font token). Repeated whack-a-mole on the glass effect this week is a direct symptom.

**Target State**: A `theme/` tokens module (single source for colours/fonts/spacing + the canonical severity map) and a handful of primitive components (`GlassPanel`, `HoloButton`, `SeverityBadge`, `PulsingDot`, `SectionLabel`, `CornerBrackets`) consumed everywhere; `Graph3D.tsx` split into focused `graph/*` modules with a thin orchestrator. Every change behavior-preserving and gate-verified.

---

## 📊 Quick Stats

- **Sprints**: 2 (Design system / primitives, then mega-file splits)
- **Major Tasks**: 6 — each independently reviewable + revertible
- **New Files**: `theme/tokens.ts` + ~6 primitive components + ~5 `graph/*` modules
- **Modified Files**: most components (swap inline styles → primitives) — many files, small diffs each
- **Behavior change**: **NONE** — pure refactor; verified by gate + visual spot-check per PR
- **Test Coverage Target**: keep all existing tests green; add tests for any extracted pure helpers (severity map, etc.)

---

## 🎯 Key Deliverables

### Sprint 1: Design System & Primitives (behavior-preserving)

> Define the look once; swap duplication for primitives. Lowest-risk, highest-dedup first.

- ⚪ **`theme/tokens.ts`** — colours (cyan, status, the ONE canonical prefix→severity map), fonts (Orbitron, Share Tech Mono), spacing. Replace the 4× duplicated severity maps + 18× inline font. (Tokens-first: highest payoff, also a correctness win — no more colour drift.)
- ⚪ **`<GlassPanel>`** — the `rgba(0,8,22,x)` + backdrop-blur + cyan border + corner-brackets surface. One place to get frosted glass right. Swap the 6 inline copies.
- ⚪ **`<HoloButton>`, `<SeverityBadge>`, `<PulsingDot>`, `<SectionLabel>`, `<CornerBrackets>`** — extract + replace usages.

### Sprint 2: Mega-File Splits (behavior-preserving)

> Make the big files readable whole.

- ⚪ **Split `Graph3D.tsx` (1,645 → thin orchestrator)** → `graph/buildGlowNode.ts`, `graph/forces.ts`, `graph/animationLoop.ts`, `graph/interactions.ts` (focus/radial), `graph/backlogNodes.ts`.
- ⚪ **Lighter splits** for BacklogPanel / AgentLauncher (extract sub-panels / helpers) where it improves readability without churn.

---

## ✅ Success Criteria

### Functional Requirements

- [ ] **No visible behavior change** — every screen/interaction looks and works exactly as before each PR (verified by visual spot-check)
- [ ] The NEXUS look (colours/fonts/glass/badges) is defined once and consumed by all components
- [ ] `Graph3D.tsx` and other 800+ line files are split into focused modules readable whole

### Quality Requirements

- [ ] `pnpm typecheck` + web build + all tests green on every PR
- [ ] Each PR is a small, behavior-preserving slice (one primitive or one split) — revertible in isolation
- [ ] Extracted pure helpers (severity map, etc.) unit-tested; no duplicated colour/font literals remain in swapped files

### Architecture Requirements

- [ ] Tokens are the single source of truth — no inline hex/font in refactored components
- [ ] Primitives are presentational + reusable; no business logic leaks in
- [ ] `Graph3D` orchestrator imports `graph/*` modules; glow/force/animation/interaction behavior identical

---

## ⚠️ Risks & Mitigation

| Risk                                                                                 | Impact    | Likelihood | Mitigation                                                                                                                          |
| ------------------------------------------------------------------------------------ | --------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Concurrent feature work collides** — refactors touch shared files (6–18 each)      | 🔴 High   | 🔴 High    | **Soft feature freeze** during the phase; refactor PRs get merge priority; partition workers by file                                |
| **"No-behavior-change" refactor subtly shifts rendering** (glass, spacing, layering) | 🟡 Medium | 🟡 Medium  | Behavior-preserving discipline; **visual spot-check per PR** (not just the gate); small slices so a regression is easy to localize  |
| **Big-bang refactor** becomes an unreviewable mega-PR                                | 🟡 Medium | 🟡 Medium  | One primitive / one split per PR; never bundle                                                                                      |
| **Graph3D split breaks the RAF loop / force closures**                               | 🔴 High   | 🟡 Medium  | Split `Graph3D` LAST, after primitives; preserve closures/refs; gate + manual graph check (layout, glow, focus, radial menu intact) |
| **Two workers both editing shared files**                                            | 🟡 Medium | 🟡 Medium  | Partition by file (primitives+panels vs graph/\*); serialize merges; rebase second                                                  |

---

## 🔗 Dependencies

- **Required**: feature stream calm enough for a soft freeze (it is). All current features merged (Phase 5 + backlog + cockpit done).
- **Blocks**: nothing hard, but makes Phase 7 (xterm.js) and future UI work cheaper.
- **Coordinate**: a soft feature freeze with David for the phase duration; new feature requests queue until it lands (or interleave with explicit care).

---

## ⏭️ Next Phase

After completion → Phase 7: Full Interactive Terminal (xterm.js) · Phase 8: Networked & Multi-Operator. See [[PRODUCTION_ROADMAP]].
