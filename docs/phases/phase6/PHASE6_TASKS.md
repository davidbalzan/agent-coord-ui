---
title: "Phase 6 Tasks"
tags: [agent-coord-ui/phase, agent-coord-ui/tasks]
aliases: ["Phase 6 Tasks"]
---

# agent-coord-ui — Phase 6: UI Componentization & Design System

## Overview

The web app is ~9.5k LOC with heavy duplication and several 500–1,645-line files.
Extract a small design-system layer (tokens + primitives) and split the mega-files,
**behavior-preserving**, so files read whole and the NEXUS look is defined once.

## 🔍 Audit Summary

**CRITICAL FINDINGS** (measured):

- LOC: Graph3D 1645, BacklogPanel 852, AgentLauncher 750, FloatingTerminal 610, HUD 566, InboxPanel 549, NodeRadialMenu 515, store/bus 508, ActivityLog 486.
- Duplication: glass surface inlined in 6 files; `holo-btn` in 6; prefix→severity colour map in **4 files** (drift → inconsistent badges); `Share Tech Mono` inline in **18 files**.
- Symptom: repeated whack-a-mole on the glass effect this week (translucency, blur, contrast across panels) because there's no single GlassPanel/token.

### Principles

1. **Behavior-preserving** — zero visible change; this is a refactor, not a redesign.
2. **Small slices** — one primitive or one split per PR; revertible in isolation; never big-bang.
3. **Tokens are the source of truth** — no inline hex/font literals in refactored files.
4. **Gate + visual** — typecheck/build/tests AND a visual spot-check per PR (a no-behavior-change refactor can still shift rendering).
5. **Primitives are presentational** — no business logic; the graph split preserves closures/refs exactly.

## 🎯 Target Structure

```
apps/web/src/
├── theme/
│   └── tokens.ts            # NEW — colours, status, prefix→severity map, fonts, spacing
├── components/
│   ├── primitives/
│   │   ├── GlassPanel.tsx   # NEW — frosted surface + border + corner brackets
│   │   ├── HoloButton.tsx   # NEW
│   │   ├── SeverityBadge.tsx# NEW — uses token severity map
│   │   ├── PulsingDot.tsx   # NEW — working/activity indicator
│   │   ├── SectionLabel.tsx # NEW
│   │   └── CornerBrackets.tsx# NEW
│   ├── Graph3D.tsx          # → thin orchestrator
│   └── graph/
│       ├── buildGlowNode.ts # NEW (extracted)
│       ├── forces.ts        # NEW (charge/link/boundary config)
│       ├── animationLoop.ts # NEW (RAF: pulse/burst/activity/labels)
│       ├── interactions.ts  # NEW (focus-lock, radial menu wiring)
│       └── backlogNodes.ts  # NEW (backlog node + edge building)
```

## 📋 Implementation Tasks

### Sprint 1: Design System & Primitives

#### [ ] Task 1: theme/tokens.ts (tokens-first)

**Priority**: HIGH · **Package**: apps/web · **Dependencies**: None

- [ ] 1.1 Create theme/tokens.ts: colour tokens (cyan #00d4ff, status active/idle/stale, room/agent), the ONE canonical prefix→severity colour map (DAVID_DECISION/BLOCKER/RISK/DONE/AGENT_ACTION/FYI), font tokens (Orbitron, Share Tech Mono), spacing scale.
- [ ] 1.2 Replace the 4 duplicated severity maps (InboxPanel, NotificationLayer, DecisionCard, ActivityLog) with the token map.
- [ ] 1.3 Replace inline `Share Tech Mono`/Orbitron strings with font tokens across files (incremental; can be its own follow-up if large).
- [ ] 1.4 Unit-test the severity map / any pure token helper.
- [ ] 1.5 typecheck + web build + tests green; visual: badge colours unchanged everywhere.
      **Deliverable**: one source of truth for the NEXUS palette/fonts; severity drift eliminated.

#### [ ] Task 2: <GlassPanel> primitive

**Priority**: HIGH · **Package**: apps/web · **Dependencies**: Task 1

- [ ] 2.1 GlassPanel.tsx: props for opacity/blur variant, border, corner-brackets, size; defaults = the canonical frosted surface (rgba(0,8,22,x) + blur + cyan border).
- [ ] 2.2 Swap the 6 inline glass surfaces (SidePanel, InboxPanel, ActivityLog detail, StatusTicker, AgentLauncher, BacklogPanel) to GlassPanel — preserving each one's exact current look.
- [ ] 2.3 typecheck + build + tests green; visual: each panel looks identical pre/post.
      **Deliverable**: frosted glass defined once (ends the per-panel whack-a-mole).

#### [ ] Task 3: small primitives (HoloButton, SeverityBadge, PulsingDot, SectionLabel, CornerBrackets)

**Priority**: MEDIUM · **Package**: apps/web · **Dependencies**: Tasks 1–2

- [ ] 3.1 Extract each as a presentational primitive (use tokens).
- [ ] 3.2 Replace usages (holo-btn ×6, severity badges, the working/burst dots, eyebrow labels, corner brackets).
- [ ] 3.3 typecheck + build + tests green; visual spot-check.
      **Deliverable**: the repeated small bits live once.

### Sprint 2: Mega-File Splits

#### [ ] Task 4: split Graph3D.tsx (HIGH RISK — do after primitives)

**Priority**: HIGH · **Package**: apps/web · **Dependencies**: Tasks 1–3

- [ ] 4.1 Extract graph/buildGlowNode.ts (node builders + setters), preserving the composed render() state.
- [ ] 4.2 Extract graph/forces.ts (charge/link/boundary config) and graph/backlogNodes.ts.
- [ ] 4.3 Extract graph/animationLoop.ts (RAF: pulse/burst/activity glow/labels) — preserve refs/closures EXACTLY.
- [ ] 4.4 Extract graph/interactions.ts (focus-lock, radial menu, fit) — preserve handlers.
- [ ] 4.5 Graph3D.tsx becomes the thin orchestrator wiring them.
- [ ] 4.6 typecheck + build + tests green; MANUAL graph check: layout, glow/blink, decaying activity, focus-lock, radial menu, backlog nodes, coordinator markers, notification anchoring — all identical.
      **🔄 Rollback**: pure-refactor commits; revert the split commit if any graph behavior changes.
      **Deliverable**: Graph3D readable whole as a thin orchestrator + focused modules.

#### [ ] Task 5: lighter splits (BacklogPanel, AgentLauncher)

**Priority**: MEDIUM · **Package**: apps/web · **Dependencies**: Tasks 1–3

- [ ] 5.1 Extract self-contained sub-panels / helpers where it improves readability without churn (e.g. BacklogPanel queue-editor; AgentLauncher preset/target sections).
- [ ] 5.2 typecheck + build + tests green; visual spot-check.
      **Deliverable**: the next-biggest files readable.

#### [ ] Task 6: sweep + docs

**Priority**: LOW · **Package**: apps/web, docs · **Dependencies**: Tasks 1–5

- [ ] 6.1 Grep for remaining inline hex/font/glass duplication; mop up.
- [ ] 6.2 Brief note in ARCHITECTURE_GUIDE: tokens + primitives convention (use them, don't re-inline).
- [ ] 6.3 Final gate + full visual pass.
      **Deliverable**: convention documented so it doesn't regress.

## 🎯 Success Criteria

### Functional

- [ ] No visible behavior change at any step
- [ ] NEXUS look defined once, consumed everywhere
- [ ] Graph3D + 800+ line files split into readable modules

### Quality

- [ ] typecheck + build + tests green every PR; visual spot-check every PR
- [ ] Each PR small + behavior-preserving + revertible
- [ ] No duplicated colour/font/glass literals in refactored files

### Architecture

- [ ] Tokens = single source of truth
- [ ] Primitives presentational + reused
- [ ] Graph behavior identical post-split

## 📅 Timeline

- **Sprint 1 (tokens + primitives)**: ~4–6 days (Tasks 1–3)
- **Sprint 2 (splits)**: ~4–6 days (Tasks 4–6)
- **Total**: ~1–2 weeks, paced by safe small PRs

## 🚀 Progress

1. ⚪ Task 1 (tokens) — **recommended first slice** (lowest risk, highest dedup + correctness)
2. ⚪ Task 2 (GlassPanel)
3. ⚪ Task 3 (small primitives)
4. ⚪ Task 4 (Graph3D split — last/highest-risk)
5. ⚪ Task 5 (lighter splits)
6. ⚪ Task 6 (sweep + docs)

## 🎯 CURRENT STATUS: 0/6 — awaiting kickoff (tokens first). Soft feature-freeze recommended for the duration.

## 📝 Notes

- Partition the two workers by FILE to avoid collisions: one on tokens+primitives+panel swaps, one on the graph/\* split. Serialize merges; rebase second.
- This is the phase where "verify against real / visual spot-check" matters most — a green gate does NOT prove the pixels are unchanged.
- Soft feature freeze: queue new feature requests during the phase, or interleave with explicit care + rebase.
