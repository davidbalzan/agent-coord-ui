import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'node:http';
import type { BusEvent, SendMessagePayload } from '@coord-ui/shared';
import { busWatcher } from './watcher.js';
import { logger } from './logger.js';

export function attachWss(server: import('node:http').Server) {
  const wss = new WebSocketServer({ server });

  wss.on('connection', async (ws: WebSocket, _req: IncomingMessage) => {
    logger.info('ws client connected');

    // Send full state on connect
    const state = await busWatcher.fullState();
    send(ws, { type: 'full_state', ...state });

    // Forward bus events to this client
    const unsub = busWatcher.subscribe((event) => send(ws, event));

    ws.on('message', (raw) => {
      try {
        const payload = JSON.parse(raw.toString()) as { type: string } & Record<string, unknown>;
        if (payload.type === 'send_message') {
          handleSend(payload as unknown as SendMessagePayload).catch((err) =>
            logger.error({ err }, 'send_message error'),
          );
        }
      } catch {
        // malformed — ignore
      }
    });

    ws.on('close', () => {
      unsub();
      logger.info('ws client disconnected');
    });
  });

  return wss;
}

function send(ws: WebSocket, data: BusEvent | Record<string, unknown>) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

// Stub — wire to agent-coord-mcp HTTP API or store in M4
async function handleSend(_payload: SendMessagePayload) {
  logger.warn('handleSend not yet implemented');
}
