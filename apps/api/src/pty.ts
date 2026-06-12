import { spawn, type IPty } from "node-pty";

export interface ParsedPaneId {
  session: string;
  window: string;
  pane: string;
  paneId: string;
}

export interface PtyHandle {
  paneId: string;
  write(data: string): void;
  resize(cols: number, rows: number): void;
  kill(): void;
}

const PANE_ID_RE = /^([^:]+):(\d+)\.(\d+)$/;

export function parsePaneId(paneId: string): ParsedPaneId {
  const match = PANE_ID_RE.exec(paneId);
  if (!match) {
    throw new Error(`invalid paneId "${paneId}"`);
  }

  const [, session, window, pane] = match;
  return {
    session: session!,
    window: window!,
    pane: pane!,
    paneId,
  };
}

export function tmuxAttachArgs(parsed: ParsedPaneId): string[] {
  return [
    "attach-session",
    "-t",
    parsed.session,
    ";",
    "select-window",
    "-t",
    `${parsed.session}:${parsed.window}`,
    ";",
    "select-pane",
    "-t",
    parsed.paneId,
  ];
}

export class PtyManager {
  attach(
    paneId: string,
    cols: number,
    rows: number,
    onData: (data: string) => void,
    onExit: (error?: string) => void
  ): PtyHandle {
    const parsed = parsePaneId(paneId);
    const pty = spawn("tmux", tmuxAttachArgs(parsed), {
      name: "xterm-256color",
      cols,
      rows,
      env: process.env,
    });

    let killed = false;
    pty.onData(onData);
    pty.onExit(({ exitCode, signal }) => {
      if (killed || exitCode === 0) {
        onExit();
        return;
      }

      const detail =
        signal !== undefined && signal !== 0
          ? `signal ${signal}`
          : `exit code ${exitCode}`;
      onExit(`pty exited with ${detail}`);
    });

    return new NodePtyHandle(paneId, pty, () => {
      killed = true;
    });
  }
}

class NodePtyHandle implements PtyHandle {
  constructor(
    readonly paneId: string,
    private readonly pty: IPty,
    private readonly markKilled: () => void
  ) {}

  write(data: string): void {
    this.pty.write(data);
  }

  resize(cols: number, rows: number): void {
    this.pty.resize(cols, rows);
  }

  kill(): void {
    this.markKilled();
    this.pty.kill();
  }
}
