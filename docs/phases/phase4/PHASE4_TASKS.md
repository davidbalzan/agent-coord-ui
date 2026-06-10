---
title: "Phase 4 Tasks"
tags: [agent-coord-ui/phase, agent-coord-ui/tasks]
aliases: ["Phase 4 Tasks"]
---

# agent-coord-ui — Phase 4: Agent Provisioning & Terminal Groups

## Overview

Make the web UI able to **spawn, configure, and register agents** instead of the operator
doing it by hand in tmux. The full manual ritual today is: split a pane → run `claude` →
`/model <id>` → `/coordinator` or `/coord-worker --id=<name> …`. Phase 4 automates that as a
server-driven, readiness-gated sequence triggered from a launcher in the UI, plus named
terminal groups and clean teardown.

This builds directly on infrastructure already shipped in Phases 2–3 — the goal is to _extend_
`tmux.ts`/`ws.ts`, not invent new transport.

## 🔍 Implementation Audit Summary

**CRITICAL FINDINGS**: The hard plumbing already exists. `apps/api/src/tmux.ts` shells out to
tmux via `execAsync` and already has `listPanes`, `capturePane`, `capturePaneAnsi`, and
`sendKeys` (which converts `\n` to Enter presses). `ws.ts` already routes `pane_send_keys` and
`pane_request_output`. So spawning is mostly **sequencing existing primitives** + adding pane
_creation_ + **readiness detection** (the one genuinely hard part).

### 📊 Components to Implement

- **Server primitives**: pane create (`split-window`/`new-window`/`new-session`) + `kill-pane` in `tmux.ts`
- **Readiness detection**: `waitForPrompt(paneId, matcher, timeoutMs)` polling `capturePane`
- **Provisioner**: a sequenced state machine (`provisioner.ts`) — create → wait → launch → wait → model → wait → skill → confirm
- **Presets**: typed model + JSON persistence (`presets.ts`, `~/agent-coord/presets.json`)
- **Protocol**: `spawn_agent` / `teardown_agent` WS messages, `spawn_progress` events, preset CRUD (REST)
- **UI**: `AgentLauncher.tsx`, `PresetEditor.tsx`, store wiring, teardown control, terminal-group grouping
- **Supporting**: shared types in `@coord-ui/shared`; loopback security gate

### ⚠️ Impact Assessment

- **Readiness races**: blind sequential `send-keys` drops input → half-configured agents. Mitigated by `waitForPrompt` gates.
- **Shell injection**: preset fields flow into `exec`/`send-keys` → validate + escape.
- **Process launch from web**: real attack surface → loopback-only gate, local-only until Phase 6 auth.
- **Architecture Impact**: introduces the first _write/control_ path from UI → host processes; previously read + send-keys only.

### 📈 Scale

- **6 Major Tasks** (T1–T6) → ⚪ **0 COMPLETE**, **6 REMAINING**
- **~30 sub-steps** → **0 COMPLETED**, **~30 REMAINING**
- **~1–2 weeks** estimated → **~1–2 weeks REMAINING**
- **2 sprints** from CRITICAL (server core) to MEDIUM (groups, polish)

## 🎯 Target Architecture

### Structure

```
apps/api/src/
├── tmux.ts            # + createPane(kind, target) → paneId, killPane(), waitForPrompt()
├── provisioner.ts     # NEW — spawn/teardown state machine, emits progress events
├── presets.ts         # NEW — load/save AgentPreset[] from ~/agent-coord/presets.json
├── routes/agents.ts   # NEW — REST: preset CRUD
└── ws.ts              # + route spawn_agent / teardown_agent; forward spawn_progress

packages/shared/
└── (index)            # + AgentPreset, SpawnAgentPayload, TeardownAgentPayload,
                        #   SpawnProgressEvent, TerminalGroup; extend BusEvent

apps/web/src/
├── components/AgentLauncher.tsx   # NEW — preset picker, name, target, Launch + progress
├── components/PresetEditor.tsx    # NEW — preset CRUD UI
└── store/bus.ts                   # + spawnProgress state, presets
```

### Integration Pattern

- **Provisioner owns the sequence**; `ws.ts` only routes messages to it and forwards its progress events. Same separation as the existing watcher/ws split.
- **Readiness-gated steps**: every `send-keys` is preceded by a `waitForPrompt` on a step-specific matcher. No blind timed sends.
- **Registration confirmation**: success is defined by the agent appearing in the coord bus (transport file under `~/agent-coord/transports/` and/or `list_agents`), not by "we sent the keys".
- **Presets as compression**: a preset fully specifies model/role/lane/rooms/launch-cmd so the UI action is one click.

### Architecture Principles

1. **Reuse, don't reinvent** — extend `tmux.ts`; do not add a second tmux abstraction.
2. **Never assert from send-keys alone** — confirm via captured output and bus registration.
3. **Fail loud, clean up** — a failed spawn surfaces an error and removes/flags its pane.
4. **Injection-safe by construction** — validate preset fields; escape everything reaching a shell.
5. **Local-only until authed** — loopback gate; networked exposure is Phase 6.

## 📋 Implementation Tasks

### Sprint 1: Server Primitives & Provisioner (CRITICAL/HIGH)

#### [ ] Task 1: tmux pane lifecycle primitives

**Priority**: CRITICAL
**Package**: `apps/api/src/tmux.ts`, `apps/api/src/tmux.test.ts`
**Dependencies**: None

**Sub-Steps**:

- [ ] 1.1: `createPane(opts)` supporting `split-window` (split a target), `new-window` (new window in a session), and `new-session` (new group); use `-P -F '#{pane_id}'` to capture and return the new pane id
- [ ] 1.2: `killPane(paneId)` wrapping `tmux kill-pane -t`
- [ ] 1.3: Optional `cwd` support so a pane starts in a given repo path
- [ ] 1.4: Harden shell escaping for all interpolated args (target, cwd)
- [ ] 1.5: Extend `tmux.test.ts` — mock `exec`, assert correct commands issued and pane id parsed
- [ ] 1.6: Make sure everything builds and `pnpm check` passes

**Deliverables**: pane create/destroy primitives returning real pane ids, unit-tested.

#### [ ] Task 2: Prompt-readiness detection

**Priority**: CRITICAL
**Package**: `apps/api/src/tmux.ts`, tests
**Dependencies**: Task 1

**Sub-Steps**:

- [ ] 2.1: `waitForPrompt(paneId, matcher, { timeoutMs, intervalMs=400 })` polling `capturePane` until `matcher(tail)` is true or timeout
- [ ] 2.2: Built-in matchers: shell-ready (`$`/`%`/`❯` at line end), and an agent-ready matcher (Claude input box / banner)
- [ ] 2.3: On timeout, return captured tail for diagnostics (don't throw bare)
- [ ] 2.4: Unit tests with a scripted `capturePane` sequence (not-ready → ready)
- [ ] 2.5: `pnpm check` passes

**Deliverables**: reliable, testable readiness gate — the linchpin of the phase.

#### [ ] Task 3: Presets + sequenced provisioner

**Priority**: HIGH
**Package**: `packages/shared`, `apps/api/src/presets.ts`, `apps/api/src/provisioner.ts`
**Dependencies**: Tasks 1, 2

**Sub-Steps**:

- [ ] 3.1: `AgentPreset` type in `@coord-ui/shared` (id, label, model, role `coordinator|worker`, lane, rooms, repoPath, launchCmd, skillInvocation template)
- [ ] 3.2: `presets.ts` — load/save `AgentPreset[]` from `~/agent-coord/presets.json` (create with sensible defaults if missing)
- [ ] 3.3: `provisioner.ts` `spawnAgent(req)` state machine: createPane → waitForPrompt(shell) → send launchCmd → waitForPrompt(agent) → send `/model <id>` → waitForPrompt(agent) → send skill invocation (`/coordinator …` or `/coord-worker …`) → confirm registration
- [ ] 3.4: Registration confirmation — poll transport dir / agent list for the new agentId (timeout + error)
- [ ] 3.5: Name-collision pre-check against current agents
- [ ] 3.6: `teardownAgent(agentId)` — best-effort graceful stop, then `killPane`, then ensure unregistered
- [ ] 3.7: Emit a `SpawnProgressEvent` at each step (creating / launching / configuring / joining / done / error)
- [ ] 3.8: Unit tests for the state machine with mocked tmux + readiness
- [ ] 3.9: `pnpm check` passes

**Deliverables**: a server function that takes a preset + name and produces a registered agent, with progress + teardown.

**🔄 Rollback Plan**:

- **Revert trigger**: provisioner spawns unkillable/orphaned panes or mis-registers agents
- **Rollback steps**: `git revert` the provisioner wiring; manual `tmux kill-pane` for any orphans
- **Notification**: report in `#coordui` to the coordinator

### Sprint 2: Protocol, UI & Groups (HIGH/MEDIUM)

#### [ ] Task 4: WS/REST protocol + bus integration

**Priority**: HIGH
**Package**: `packages/shared`, `apps/api/src/ws.ts`, `apps/api/src/routes/agents.ts`
**Dependencies**: Task 3

**Sub-Steps**:

- [ ] 4.1: Shared payloads — `SpawnAgentPayload`, `TeardownAgentPayload`; extend `BusEvent` with `spawn_progress`
- [ ] 4.2: Route `spawn_agent` / `teardown_agent` in `ws.ts` → provisioner; forward `spawn_progress` to the client
- [ ] 4.3: `routes/agents.ts` — REST preset CRUD (GET/POST/PUT/DELETE)
- [ ] 4.4: **Loopback gate** — refuse spawn/teardown/preset-write from non-loopback origins
- [ ] 4.5: `pnpm check` passes

**Deliverables**: spawn/teardown over WS with live progress; preset CRUD over REST; security gate.

#### [ ] Task 5: Agent Launcher + Preset Editor UI

**Priority**: HIGH
**Package**: `apps/web/src`
**Dependencies**: Task 4

**Sub-Steps**:

- [ ] 5.1: `AgentLauncher.tsx` — preset picker, name input (with collision hint), target selector (split window / new window / new group), Launch button
- [ ] 5.2: Live progress display driven by `spawn_progress` (stepper or log), success/error states
- [ ] 5.3: `bus.ts` store additions — presets list, in-flight spawn progress
- [ ] 5.4: `PresetEditor.tsx` — create/edit/delete presets against the REST API
- [ ] 5.5: Per-agent teardown control (with confirm)
- [ ] 5.6: Entry point in HUD / control row, styled to the NEXUS aesthetic
- [ ] 5.7: `pnpm check` passes

**Deliverables**: operator can spawn and tear down agents and manage presets entirely from the browser.

#### [ ] Task 6: Terminal groups + hardening & docs

**Priority**: MEDIUM
**Package**: `apps/web/src`, `apps/api/src`, `docs/`
**Dependencies**: Task 5

**Sub-Steps**:

- [ ] 6.1: Model tmux windows/sessions as named **terminal groups**; expose create/name
- [ ] 6.2: Reflect group membership in the graph (visual grouping / labels)
- [ ] 6.3: End-to-end injection-safety review of every preset field reaching a shell
- [ ] 6.4: Orphan-pane cleanup verification on simulated spawn failure
- [ ] 6.5: Update [[PRODUCTION_ROADMAP]] status + `docs/DECISIONS.md` (ADR for UI-driven provisioning + local-only gate)
- [ ] 6.6: Final `pnpm check` + manual end-to-end verification (spawn a real coordinator/worker from the UI)

**🎯 SUCCESS CRITERIA**: spawning an agent from the UI yields a registered bus agent with the right model/name/rooms; groups are visible; teardown is clean; no injection or orphan paths remain.

## 🎯 Success Criteria

### Functional Requirements

- [ ] One-click spawn → registered agent on the bus with correct model, name, role, rooms
- [ ] Failed spawn surfaces a clear error and cleans up / flags the pane
- [ ] Teardown gracefully stops the agent and removes its pane
- [ ] Named terminal groups can be created and spawned into

### Quality Requirements

- [ ] `pnpm check` green across all packages
- [ ] Provisioner state machine + tmux primitives unit-tested (mocked `exec`)
- [ ] No unescaped preset value reaches `exec` / `send-keys`

### Architecture Requirements

- [ ] All request/response/event shapes in `@coord-ui/shared`
- [ ] Provisioning isolated in `provisioner.ts`; `ws.ts` only routes
- [ ] Provisioning endpoints loopback-gated and documented local-only

## 📅 Estimated Timeline

**Sprint 1 (Server core)**: 3–5 days — Tasks 1–3 (primitives, readiness, provisioner). Readiness detection dominates.

**Sprint 2 (Protocol, UI, groups)**: 3–5 days — Tasks 4–6.

**Total Estimated Time**: ~1–2 weeks → **~1–2 weeks REMAINING**
**Total Sub-Steps**: ~30 → **0 COMPLETED**, **~30 REMAINING**

## 🚀 Progress

1. ⚪ **Task 1 (tmux primitives)** — not started
2. ⚪ **Task 2 (readiness detection)** — not started
3. ⚪ **Task 3 (presets + provisioner)** — not started
4. ⚪ **Task 4 (protocol + bus)** — not started
5. ⚪ **Task 5 (launcher UI)** — not started
6. ⚪ **Task 6 (groups + hardening)** — not started

## 🎯 CURRENT STATUS: 0/6 Major Tasks Complete (0% Progress)

**🚧 CURRENT WORK**: Awaiting kickoff. Recommended first slice for `coord-ui-worker`: **Task 1 + Task 2** (tmux primitives + readiness detection) on a feature branch — they are the foundation and the highest-risk part, and are self-contained/testable.

**🎯 NEXT**: Task 3 (provisioner) once the primitives + readiness gate are merged and tested.

## 🔄 Rollback & Contingency Plans

### High-Risk Tasks Identified

| Task                       | Risk Level | Rollback Complexity | Backup Required                                    |
| -------------------------- | ---------- | ------------------- | -------------------------------------------------- |
| Task 3 (provisioner)       | 🔴 High    | Medium              | ❌ Code only — manual `tmux kill-pane` for orphans |
| Task 4 (control endpoints) | 🟡 Medium  | Low                 | ❌ Code only                                       |

### Emergency Rollback Procedure

1. **Stop** spawning.
2. **Assess** orphaned panes: `tmux list-panes -a`.
3. **Rollback**: `git revert` the provisioner/endpoint commits.
4. **Clean up** orphans: `tmux kill-pane -t <id>`.
5. **Verify** the bus has no stale/half-registered agents (`list_agents`, `prune`).

---

## 📝 Notes

- Readiness detection is the make-or-break; implement and test Tasks 1–2 before anything else.
- The `coordinator` / `coord-worker` skills must exist in the target repo for the launch sequence to invoke them.
- Keep this independent of the xterm.js work (Phase 5) — `send-keys` + `capture-pane` is sufficient here.
- Treat UI-driven process launch as a conscious local-only decision until Phase 6 auth lands; never expose it on a network without a token.
