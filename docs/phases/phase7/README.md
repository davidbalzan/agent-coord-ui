---
title: "Phase 7: Full Interactive Terminal (xterm.js)"
tags: [agent-coord-ui/phase]
aliases: ["Phase 7"]
---

# Phase 7: Full Interactive Terminal (xterm.js)

**Status**: 🟡 In Progress
**Priority**: 🟢 Medium — highest-impact remaining feature; makes the in-UI terminal actually interactive.
**Branch**: `feat/phase7-xterm-terminal`

---

## 🎯 Goal

Replace the ANSI-snapshot + `send-keys` terminal with a real **PTY-backed `xterm.js`** emulator so cursor keys, tab-completion, `Ctrl+C`, and Claude Code's interactive TUI all work from the browser.

**Current state** (Phase 3): `FloatingTerminal.tsx` renders a `<pre>` of `capture-pane -e` ANSI snapshots (`pane_output` events) and injects text via `pane_send_keys` → `tmux send-keys`. Colours render, but there is no PTY — no arrow keys, tab-complete, Ctrl+C, or live spinner/prompt.

---

## 🏗️ Architecture Decision

**Approach: `node-pty` spawning `tmux attach-session` (read-write), one PTY per open terminal view, raw bytes piped bidirectionally over the existing WS, rendered by `xterm.js`.** (Matches the roadmap deliverable.)

Why this over alternatives:

- The agents already live in **tmux panes** (`tmux.ts createPane`). Attaching with a real PTY gives true interactivity for free — tmux + the child program handle escape sequences, the TUI, signals. `node-pty` spawning a fresh shell would _not_ connect to the agent's pane; the snapshot/`send-keys` path is what we're replacing precisely because it isn't a PTY.
- `pipe-pane` + `send-keys` can't carry raw input fidelity (arrow keys, Ctrl+\*) — rejected.

**Flow per open terminal:**

1. Client opens a terminal for `paneId` → sends `pty_attach { paneId, cols, rows }`.
2. Server (loopback-only) spawns `node-pty` running `tmux attach-session -t <session>` then selects the target window/pane; PTY sized to `cols×rows`.
3. `pty.onData` → `pty_data { paneId, data }` on **that connection only** (not broadcast).
4. `xterm.onData` (keystrokes) → `pty_input { paneId, data }` → `pty.write(data)`.
5. Resize: xterm `FitAddon` → `pty_resize { cols, rows }` → `pty.resize(cols, rows)`.
6. `pty_detach` / ws close → kill the PTY (`tmux detach-client` then dispose).

**Protocol** (already added, `packages/shared/src/types/bus.ts`): `PtyAttach/Input/Resize/Detach` (client→server, `PtyClientPayload`) and `PtyData/Exit` (server→client, `PtyServerEvent`). Keyed by `paneId` so one connection can drive multiple terminals.

**Security**: a PTY attach = full interactive shell on the tmux session. The server MUST gate `pty_*` on `clientIsLoopback` (same as `spawn_agent`/`teardown_agent` in `ws.ts`).

**Known v1 constraints** (acceptable for the local single-operator cockpit; revisit in Phase 8 multi-operator):

- tmux clients attached to the same session share the active window/pane — two terminals on the _same session_ can fight over focus. Fine for one operator viewing one pane at a time.
- `xterm.js` + addons add ~250–300 KB gzipped to the bundle (the "~3 MB" in the roadmap is uncompressed/over-stated) — lazy-load `FloatingTerminal` so it's off the initial path.

---

## 📋 Task Breakdown

### Task 1 — Server PTY bridge (`apps/api`) · CRITICAL · no deps

- Add `node-pty` dependency; validate the native build in this environment first (if it won't build, fall back to `tmux attach` via a raw child_process pipe and flag it).
- New `apps/api/src/pty.ts`: `PtyBridge` keyed by `(connection, paneId)` → `IPty`. `attach(paneId, cols, rows, onData, onExit)`, `write`, `resize`, `kill`. Resolve `session`/`window`/`pane` from `paneId` ("session:window.pane"); spawn `tmux attach-session -t <session> \; select-window -t <window> \; select-pane -t <pane>`.
- Wire into `ws.ts`: handle `pty_attach`/`pty_input`/`pty_resize`/`pty_detach`, **loopback-gated**; per-connection `Map<paneId, IPty>`; clean up all on `ws.on("close")`.

### Task 2 — `xterm.js` frontend (`apps/web`) · CRITICAL · dep: protocol (done)

- Add `@xterm/xterm` + `@xterm/addon-fit`. Lazy-load.
- In `FloatingTerminal.tsx`, replace the `<pre>` + input row with an `xterm.js` `Terminal`. On open: `pty_attach`; `term.onData` → `pty_input`; store/WS `pty_data` → `term.write`. Dispose + `pty_detach` on close.
- Keep the store's `pty_data`/`pty_exit` handling per-connection (these are NOT bus broadcast events).

### Task 3 — Resize sync, fallback, polish · HIGH · deps: T1+T2

- `ResizeObserver`/`FitAddon` on the container → `pty_resize`.
- **Graceful fallback**: when no PTY session is active (attach failed / non-loopback), keep the read-only ANSI snapshot `<pre>` preview.
- NEXUS theming for xterm (colours/font), `pty_exit` handling (show "session ended", offer reattach), tests for `pty.ts` paneId→tmux-target parsing.

---

## ✅ Success Criteria

- [ ] Arrow keys, tab-complete, `Ctrl+C`, and Claude Code's live TUI work in a browser terminal.
- [ ] Resize keeps the remote PTY in sync (no wrapping artifacts).
- [ ] `pty_*` is loopback-gated; non-local connections get the read-only fallback.
- [ ] `pnpm -r typecheck` + web build + all tests green; `FloatingTerminal` lazy-loaded.

---

## ⚠️ Risks

| Risk                                 | Mitigation                                                                                           |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `node-pty` native build fails in env | Validate build in Task 1 BEFORE parallelizing; fallback to raw `child_process` pipe of `tmux attach` |
| Shared-session focus fights (tmux)   | v1 = single operator, one pane at a time; document; revisit Phase 8                                  |
| Bundle bloat                         | Lazy-load `FloatingTerminal` + xterm; keep off initial path                                          |
| PTY leak on disconnect               | Kill all PTYs on `ws.on("close")` + `pty_detach`; `tmux detach-client`                               |

## ⏭️ Next

Phase 8: Networked & Multi-Operator. See [[PRODUCTION_ROADMAP]].
