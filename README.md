# agent-coord-ui

> Holographic 3D command centre for [agent-coord-mcp](https://github.com/davidbalzan/agent-coord-mcp). Watch every agent, room, and message flow in real time — click any node to chat directly with an agent or room.

## What it does

- **3D force-directed graph** — agents as glowing spheres, rooms as nodes, tmux panes as terminals; message particles flow along edges in real time
- **Live DM & room chat** — click a node to open a side panel; send messages directly to agents or broadcast to a room
- **Markdown rendering** — chat messages render as markdown with `@mention` highlighting (known agents in cyan, unknown in purple)
- **tmux integration** — pane nodes show the agent's current working directory; spatially adjacent panes are linked by split direction (horizontal/vertical)
- **Status colours** — green (active < 60 s), amber (idle < 5 min), red (stale); driven by heartbeat + pane output activity
- **Particle animations** — particles travel along edges on new messages; DM edges have a constant slow ambient pulse

## Architecture

```
apps/
  api/        Hono + WebSocket server — watches the agent-coord-mcp file store,
              diffs on every poll and pushes BusEvents to all clients
  web/        React 19 + Vite — 3d-force-graph / Three.js canvas, Zustand store
packages/
  shared/     TypeScript types shared between api and web
```

The API polls `~/agent-coord/` (or `$AGENT_COORD_DIR`) every second and on `fs.watch` events. It broadcasts:

| Event                         | When                      |
| ----------------------------- | ------------------------- |
| `full_state`                  | on WebSocket connect      |
| `agent_join / leave / update` | agents.json changes       |
| `room_update`                 | rooms.json changes        |
| `message`                     | new line in any `.jsonl`  |
| `pane_update / remove`        | tmux pane content changes |

## Quick start

```bash
git clone https://github.com/davidbalzan/agent-coord-ui
cd agent-coord-ui
pnpm install

# Defaults to ~/agent-coord — override if needed
export AGENT_COORD_DIR=~/.agent-coord

pnpm dev        # api on :3001, web on :5173
```

Requires [agent-coord-mcp](https://github.com/davidbalzan/agent-coord-mcp) to be running so agents are registered in `~/agent-coord/agents.json`.

## Message store layout

The API reads from the same flat-file store that `agent-coord-mcp` writes:

```
~/agent-coord/
  agents.json          registered agents + heartbeats
  rooms.json           room metadata + member lists
  room.jsonl           "general" channel messages
  rooms/<name>.jsonl   named channel messages
  inbox/<agent>.jsonl  DMs addressed to <agent>
```

Sending a message from the UI appends a JSONL record to the appropriate file; the watcher picks it up on the next diff cycle (< 1 s).

## Logs

The API uses [pino](https://github.com/pinojs/pino) and writes structured NDJSON to `logs/api.log`.

```bash
tail -f logs/api.log
```

`LOG_LEVEL` (default `info`) controls verbosity.
