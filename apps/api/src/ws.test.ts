import { describe, it, expect, vi } from "vitest";

// Mock heavy deps before importing ws.js
vi.mock("ws", () => ({ WebSocketServer: vi.fn(), WebSocket: { OPEN: 1 } }));
vi.mock("./watcher.js", () => ({
  busWatcher: { fullState: vi.fn(), subscribe: vi.fn(() => vi.fn()) },
}));
vi.mock("./tmux.js", () => ({
  sendKeys: vi.fn(),
  capturePane: vi.fn(),
  capturePaneAnsi: vi.fn(),
  tmuxWatcher: { panes: [] },
}));
vi.mock("./provisioner.js", () => ({
  spawnAgent: vi.fn(),
  teardownAgent: vi.fn(),
}));
vi.mock("./presets.js", () => ({ loadPresets: vi.fn() }));
vi.mock("./routes/agents.js", () => ({
  isLoopback: (addr: string | undefined) =>
    addr === "127.0.0.1" || addr === "::1" || addr === "::ffff:127.0.0.1",
  agentRoutes: {},
}));
vi.mock("./logger.js", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock("node:fs/promises", () => ({
  appendFile: vi.fn(),
  mkdir: vi.fn(),
}));
vi.mock("node:crypto", () => ({ randomUUID: () => "test-uuid" }));

const { isValidAgentId } = await import("./ws.js");

describe("isValidAgentId", () => {
  it("accepts alphanumeric ids", () =>
    expect(isValidAgentId("myagent123")).toBe(true));
  it("accepts ids with hyphens", () =>
    expect(isValidAgentId("coord-ui-worker")).toBe(true));
  it("accepts ids with underscores", () =>
    expect(isValidAgentId("my_agent")).toBe(true));
  it("rejects ids with spaces", () =>
    expect(isValidAgentId("my agent")).toBe(false));
  it("rejects ids with semicolons", () =>
    expect(isValidAgentId("agent;bad")).toBe(false));
  it("rejects ids with shell metacharacters", () =>
    expect(isValidAgentId("agent$(cmd)")).toBe(false));
  it("rejects empty string", () => expect(isValidAgentId("")).toBe(false));
  it("rejects ids longer than 64 chars", () =>
    expect(isValidAgentId("a".repeat(65))).toBe(false));
  it("accepts ids exactly 64 chars", () =>
    expect(isValidAgentId("a".repeat(64))).toBe(true));
  it("rejects undefined", () => expect(isValidAgentId(undefined)).toBe(false));
});
