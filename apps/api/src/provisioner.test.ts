import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  AgentPreset,
  SpawnAgentRequest,
  SpawnProgressEvent,
} from "@coord-ui/shared";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const {
  createPaneMock,
  killPaneMock,
  waitForPromptMock,
  sendKeysMock,
  readFileMock,
} = vi.hoisted(() => ({
  createPaneMock: vi.fn<() => Promise<string>>(),
  killPaneMock: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  waitForPromptMock: vi.fn<() => Promise<{ ready: boolean; tail: string[] }>>(),
  sendKeysMock: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  readFileMock: vi.fn<(path: string, enc: string) => Promise<string>>(),
}));

vi.mock("./tmux.js", () => ({
  createPane: createPaneMock,
  killPane: killPaneMock,
  waitForPrompt: waitForPromptMock,
  sendKeys: sendKeysMock,
  SHELL_READY_MATCHER: (lines: string[]) =>
    lines.some((l) => /[$%❯]\s*$/.test(l.trimEnd())),
  AGENT_READY_MATCHER: (lines: string[]) =>
    lines.some((l) =>
      /Human:|Esc to interrupt|✻ Initializ|╭─+╮|claude>/i.test(l)
    ),
}));

vi.mock("node:fs/promises", () => ({
  readFile: readFileMock,
}));

vi.mock("./logger.js", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const { spawnAgent, teardownAgent } = await import("./provisioner.js");

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const PRESET: AgentPreset = {
  id: "worker-default",
  label: "Worker",
  model: "claude-sonnet-4-6",
  role: "worker",
  lane: "repo-owner",
  launchCmd: "claude",
  skillInvocation: "/coord-worker --id={agentId} --lane={lane}",
};

const REQ: SpawnAgentRequest = {
  presetId: "worker-default",
  agentId: "test-worker",
  paneKind: "split-window",
  paneTarget: "main:0",
};

/** Collect emitted SpawnProgressEvents from spawnAgent/teardownAgent. */
function collectEmit(): {
  events: SpawnProgressEvent[];
  emit: (e: SpawnProgressEvent) => void;
} {
  const events: SpawnProgressEvent[] = [];
  return { events, emit: (e) => events.push(e) };
}

// ─── Setup helpers ────────────────────────────────────────────────────────────

function mockHappyPath() {
  // No existing transport file → no collision
  readFileMock.mockRejectedValue(
    Object.assign(new Error("ENOENT"), { code: "ENOENT" })
  );
  createPaneMock.mockResolvedValue("%7");
  // Shell ready, then agent ready ×3, then transport confirms registration
  waitForPromptMock
    .mockResolvedValueOnce({ ready: true, tail: ["$ "] }) // shell
    .mockResolvedValueOnce({ ready: true, tail: ["Human:"] }) // after launch
    .mockResolvedValueOnce({ ready: true, tail: ["Human:"] }) // after /model
    .mockResolvedValueOnce({ ready: true, tail: ["Human:"] }); // after skill
  // Registration poll: first call still ENOENT, second returns transport JSON
  readFileMock
    .mockRejectedValueOnce(
      Object.assign(new Error("ENOENT"), { code: "ENOENT" })
    )
    .mockResolvedValueOnce(JSON.stringify({ agentId: "test-worker" }));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  killPaneMock.mockResolvedValue(undefined);
  sendKeysMock.mockResolvedValue(undefined);
});

describe("spawnAgent — happy path", () => {
  it("returns pane id on successful spawn", async () => {
    mockHappyPath();
    const { emit, events } = collectEmit();
    const result = await spawnAgent(PRESET, REQ, emit);
    expect(result.paneId).toBe("%7");
    expect(events.at(-1)?.step).toBe("done");
  });

  it("emits steps in order: creating → launching → configuring → joining → confirming → done", async () => {
    mockHappyPath();
    const { emit, events } = collectEmit();
    await spawnAgent(PRESET, REQ, emit);
    const steps = events.map((e) => e.step);
    expect(steps).toEqual([
      "creating",
      "launching",
      "configuring",
      "joining",
      "confirming",
      "done",
    ]);
  });

  it("sends launch command to the pane", async () => {
    mockHappyPath();
    const { emit } = collectEmit();
    await spawnAgent(PRESET, REQ, emit);
    expect(sendKeysMock).toHaveBeenCalledWith("%7", "claude\n");
  });

  it("sends /model command after agent ready", async () => {
    mockHappyPath();
    const { emit } = collectEmit();
    await spawnAgent(PRESET, REQ, emit);
    expect(sendKeysMock).toHaveBeenCalledWith(
      "%7",
      "/model claude-sonnet-4-6\n"
    );
  });

  it("resolves skill invocation template with agentId and lane", async () => {
    mockHappyPath();
    const { emit } = collectEmit();
    await spawnAgent(PRESET, REQ, emit);
    expect(sendKeysMock).toHaveBeenCalledWith(
      "%7",
      "/coord-worker --id=test-worker --lane=repo-owner\n"
    );
  });

  it("passes cwd from preset.repoPath to createPane", async () => {
    mockHappyPath();
    const { emit } = collectEmit();
    const presetWithRepo = { ...PRESET, repoPath: "/home/user/project" };
    await spawnAgent(presetWithRepo, REQ, emit);
    expect(createPaneMock).toHaveBeenCalledWith(
      expect.objectContaining({ cwd: "/home/user/project" })
    );
  });
});

describe("spawnAgent — failure paths", () => {
  it("throws and emits error when shell is not ready, then kills pane", async () => {
    readFileMock.mockRejectedValue(
      Object.assign(new Error("ENOENT"), { code: "ENOENT" })
    );
    createPaneMock.mockResolvedValue("%7");
    waitForPromptMock.mockResolvedValue({ ready: false, tail: ["loading..."] });

    const { emit, events } = collectEmit();
    await expect(spawnAgent(PRESET, REQ, emit)).rejects.toThrow(
      "Shell not ready"
    );
    expect(events.find((e) => e.step === "error")).toBeDefined();
    expect(killPaneMock).toHaveBeenCalledWith("%7");
  });

  it("throws and kills pane when agent not ready after launch", async () => {
    readFileMock.mockRejectedValue(
      Object.assign(new Error("ENOENT"), { code: "ENOENT" })
    );
    createPaneMock.mockResolvedValue("%7");
    waitForPromptMock
      .mockResolvedValueOnce({ ready: true, tail: ["$ "] }) // shell ok
      .mockResolvedValue({ ready: false, tail: [] }); // agent never ready

    const { emit } = collectEmit();
    await expect(spawnAgent(PRESET, REQ, emit)).rejects.toThrow(
      "Agent not ready after launch"
    );
    expect(killPaneMock).toHaveBeenCalledWith("%7");
  });

  it("throws and kills pane when registration times out", async () => {
    // readFile: no collision at start, then always ENOENT (never registers)
    readFileMock.mockRejectedValue(
      Object.assign(new Error("ENOENT"), { code: "ENOENT" })
    );
    createPaneMock.mockResolvedValue("%7");
    waitForPromptMock.mockResolvedValue({ ready: true, tail: ["Human:"] });

    const { emit, events } = collectEmit();
    await expect(
      spawnAgent(PRESET, REQ, emit, { registrationTimeoutMs: 200 })
    ).rejects.toThrow("did not appear in transport dir");
    expect(events.find((e) => e.step === "error")).toBeDefined();
    expect(killPaneMock).toHaveBeenCalledWith("%7");
  });

  it("throws without creating a pane when name collision detected", async () => {
    // Transport file exists → collision
    readFileMock.mockResolvedValue(JSON.stringify({ agentId: "test-worker" }));

    const { emit } = collectEmit();
    await expect(spawnAgent(PRESET, REQ, emit)).rejects.toThrow(
      "already registered"
    );
    expect(createPaneMock).not.toHaveBeenCalled();
    expect(killPaneMock).not.toHaveBeenCalled();
  });
});

describe("teardownAgent", () => {
  it("sends /quit then kills the pane", async () => {
    const { emit, events } = collectEmit();
    await teardownAgent("test-worker", "%7", emit, { gracefulWaitMs: 0 });
    expect(sendKeysMock).toHaveBeenCalledWith("%7", "/quit\n");
    expect(killPaneMock).toHaveBeenCalledWith("%7");
    expect(events.at(-1)?.step).toBe("done");
  });

  it("does not throw if sendKeys fails (pane already gone)", async () => {
    sendKeysMock.mockRejectedValue(new Error("no such pane"));
    killPaneMock.mockRejectedValue(new Error("no such pane"));
    const { emit } = collectEmit();
    await expect(
      teardownAgent("test-worker", "%7", emit, { gracefulWaitMs: 0 })
    ).resolves.toBeUndefined();
  });
});
