---
title: "Phase 4: Agent Provisioning & Terminal Groups"
tags: [agent-coord-ui/phase]
aliases: ["Phase 4"]
---

# Phase 4: Agent Provisioning & Terminal Groups (from the UI)

**Duration**: 1–2 weeks — readiness-detection state machine is the bulk of the effort; tmux primitives and UI are straightforward wiring.
**Status**: ⚪ Not Started
**Priority**: 🟡 High — removes the biggest piece of manual operator toil (hand-spawning every agent in tmux), and reuses infrastructure that already exists.

---

## 📋 Phase Overview

**Goal**: Spawn, configure, and register a fully set-up agent from the web UI — replacing the manual ritual of splitting a tmux pane, launching the agent, setting the model, and asking it to join chat under a chosen name.

**Current State**: Operator does it all by hand: partition a tmux pane → start the agent (`claude`) → `/model <id>` → invoke `/coordinator` or `/coord-worker` with a chosen id. The web UI is read-only over the graph plus a per-pane send-keys terminal — it observes panes/agents but cannot create them.

**Target State**: A launcher in the web UI where the operator picks a preset (model, role/skill, lane, rooms, launch command), names the agent, and clicks Launch. The server creates the tmux pane, drives the launch sequence with prompt-readiness detection, and confirms the agent registered on the coord bus. Agents can be grouped into named terminal groups (tmux windows/sessions), and torn down cleanly from the UI.

---

## 📊 Quick Stats

- **Sprints**: 2 (Server primitives & provisioner, then UI & groups)
- **Major Tasks**: 6 — each independently reviewable
- **New Files**: ~6 (`provisioner.ts`, `presets.ts`, `routes/agents.ts`, `AgentLauncher.tsx`, `PresetEditor.tsx`, shared types)
- **Modified Files**: ~5 (`tmux.ts`, `ws.ts`, `shared` index, `bus.ts`, a HUD/control entry point)
- **Database Changes**: None — presets persist as a JSON file under `~/agent-coord/`
- **Test Coverage Target**: Unit tests for the provisioner state machine and the new tmux primitives (extend `tmux.test.ts`)
- **Performance Target**: Spawn → registered-on-bus within ~10s under normal conditions; readiness polls at ≤500ms cadence

---

## 🎯 Key Deliverables

### Sprint 1: Server Primitives & Provisioner (Week 1)

> Make the server able to create a pane and drive an agent to a registered state, reliably.

- ⚪ **tmux lifecycle primitives** — `split-window` / `new-window` / `new-session` returning the new pane id; `kill-pane`. Verified by creating a pane from a test and asserting it appears in `list-panes`.
- ⚪ **Prompt-readiness detection** — `waitForPrompt(paneId, matcher, timeoutMs)` polling `capturePane` until the shell/agent is ready for input. Verified against a real shell and a launched agent.
- ⚪ **Agent presets** — typed preset model + load/save from `~/agent-coord/presets.json`. Verified by round-tripping presets through the store.
- ⚪ **Sequenced provisioner** — state machine that runs create → wait → launch → wait → `/model` → wait → skill-invoke → confirm-registered, emitting progress at each step. Verified by spawning a real agent end-to-end.

### Sprint 2: Protocol, UI & Groups (Week 2)

> Expose provisioning over the bus and give the operator the launcher + group management.

- ⚪ **WS/REST protocol** — `spawn_agent` / `teardown_agent` messages + `spawn_progress` events; preset CRUD. Verified from the browser network panel.
- ⚪ **Agent Launcher UI** — pick preset, set name, choose target (split existing window / new window / new group), Launch with live progress. Verified by spawning an agent from the browser.
- ⚪ **Preset editor** — create/edit/delete presets in the UI.
- ⚪ **Terminal groups** — model tmux windows/sessions as named groups, create/name them, reflect grouping in the graph. Teardown control per agent.
- ⚪ **Security gate** — provisioning endpoints refuse non-loopback origins; documented as a local-only capability pending Phase 6 auth.

---

## ✅ Success Criteria

> All criteria must be met before this phase is considered complete.

### Functional Requirements

- [ ] One click in the UI spawns a new tmux pane, launches the agent, sets the model, and the agent appears registered on the coord bus under the chosen name with the correct role/rooms
- [ ] If any step fails (launch timeout, agent never registers), the UI surfaces a clear error and the partially-created pane is cleaned up or clearly flagged — no silent half-spawned agents
- [ ] Teardown from the UI gracefully stops the agent and removes its pane; the agent disappears from the graph and `list_agents`
- [ ] Operator can create a named terminal group and spawn agents into it

### Quality Requirements

- [ ] `pnpm check` passes (typecheck + lint + tests) across all packages
- [ ] Provisioner state machine and tmux primitives have unit tests (mocked `exec`, mirroring `tmux.test.ts`)
- [ ] All preset fields interpolated into shell commands are injection-safe (no unescaped values reach `tmux send-keys` / `exec`)

### Architecture Requirements

- [ ] All spawn/teardown/preset request & response shapes live in `@coord-ui/shared` — no inline types
- [ ] Provisioning logic isolated in `provisioner.ts`; `ws.ts` only routes
- [ ] Provisioning endpoints are loopback-gated; the capability is documented as local-only

---

## ⚠️ Risks & Mitigation

| Risk                                                                                                          | Impact                                                  | Likelihood | Mitigation                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Readiness races** — `send-keys` fires before the agent TUI is ready, dropping `/model` or the skill command | 🔴 High — half-configured agents, the core failure mode | 🔴 High    | Gate every step on `waitForPrompt` polling `capturePane` for known markers; never blind-`send-keys` in sequence; per-step timeout with surfaced error         |
| **Shell injection** via preset fields (name, repo path, launch cmd) reaching `exec`/`send-keys`               | 🔴 High — arbitrary command execution                   | 🟡 Medium  | Strict validation/allowlist on preset fields; reuse and harden the existing single-quote escaping; prefer arg arrays over string interpolation where possible |
| **Arbitrary process launch from a web UI**                                                                    | 🔴 High if networked                                    | 🟡 Medium  | Loopback-only gate on provisioning endpoints; documented local-only; real auth deferred to Phase 6                                                            |
| **Orphaned panes** when spawn fails mid-sequence                                                              | 🟡 Medium — clutter, confusion                          | 🟡 Medium  | Provisioner tracks the pane it created and kills/flags it on failure; teardown path reused                                                                    |
| **Bus name collisions** — spawning a name already registered                                                  | 🟡 Medium                                               | 🟡 Medium  | Pre-check `list_agents` before spawn; reject or suffix duplicates                                                                                             |
| **tmux version / prompt-format variance** breaks matchers                                                     | 🟡 Medium                                               | 🟡 Medium  | Configurable matcher patterns; fall back to a conservative timeout; log captured output on failure for debugging                                              |

---

## 🔗 Dependencies

- **Blocks**: Smoother multi-agent operation generally; complements (does not require) the xterm.js terminal.
- **Required (must have)**: Existing tmux integration (`apps/api/src/tmux.ts` — `sendKeys`, `capturePane`, `listPanes`, `TmuxWatcher`) and the WS bridge (`ws.ts`). Both are in place from Phases 2–3.
- **Optional (nice to have)**: The xterm.js interactive terminal (now Phase 5) would make readiness detection and post-spawn interaction cleaner, but is not required — plain `send-keys` + `capture-pane` polling is sufficient.

### External Dependencies

- tmux available on the host (already required by the app)
- The `coordinator` / `coord-worker` skills present in the target repo's `.claude/skills/` so the launch sequence can invoke them

---

## 🚀 Getting Started

```bash
# 1. Branch
git checkout -b feature/phase4-agent-provisioning

# 2. Review the detailed task plan
cat docs/phases/phase4/PHASE4_TASKS.md

# 3. Start with Task 1 (tmux primitives) — tasks are dependency-ordered
# 4. Run pnpm check after each task
```

### Before Starting Checklist

- [ ] Read this README and `PHASE4_TASKS.md` fully
- [ ] Confirm `pnpm dev` (web) + `pnpm --filter @coord-ui/api dev` bring the stack up
- [ ] Review [[DECISIONS]] for any ADRs affecting tmux/provisioning
- [ ] Confirm the target repos expose the `coord-worker` / `coordinator` skills

---

## ⏭️ Next Phase

After completion: → Phase 5: Full Interactive Terminal (xterm.js + PTY) — the previous Phase 4, renumbered. See [[PRODUCTION_ROADMAP]].
