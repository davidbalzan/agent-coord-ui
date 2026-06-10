import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { readFileMock, writeFileMock, mkdirMock } = vi.hoisted(() => ({
  readFileMock: vi.fn<(path: string, enc: string) => Promise<string>>(),
  writeFileMock: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  mkdirMock: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
}));

vi.mock("node:fs/promises", () => ({
  readFile: readFileMock,
  writeFile: writeFileMock,
  mkdir: mkdirMock,
}));

vi.mock("./logger.js", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const { loadPresets, savePresets, DEFAULT_PRESETS } =
  await import("./presets.js");

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  writeFileMock.mockResolvedValue(undefined);
  mkdirMock.mockResolvedValue(undefined);
});

describe("loadPresets", () => {
  it("returns parsed presets when file exists", async () => {
    const custom = [
      {
        id: "my-preset",
        label: "My Preset",
        model: "claude-opus-4-8",
        role: "coordinator" as const,
        launchCmd: "claude",
        skillInvocation: "/coordinator --id={agentId}",
      },
    ];
    readFileMock.mockResolvedValue(JSON.stringify(custom));
    const presets = await loadPresets();
    expect(presets).toEqual(custom);
  });

  it("returns defaults when file does not exist (ENOENT)", async () => {
    readFileMock.mockRejectedValue(
      Object.assign(new Error("ENOENT"), { code: "ENOENT" })
    );
    const presets = await loadPresets();
    expect(presets).toEqual(DEFAULT_PRESETS);
  });

  it("returns defaults when file contains invalid JSON", async () => {
    readFileMock.mockResolvedValue("not json {");
    const presets = await loadPresets();
    expect(presets).toEqual(DEFAULT_PRESETS);
  });

  it("returns defaults when file contains non-array JSON", async () => {
    readFileMock.mockResolvedValue(JSON.stringify({ bad: true }));
    const presets = await loadPresets();
    expect(presets).toEqual(DEFAULT_PRESETS);
  });
});

describe("savePresets", () => {
  it("writes JSON to the presets file", async () => {
    const presets = DEFAULT_PRESETS;
    await savePresets(presets);
    expect(writeFileMock).toHaveBeenCalledOnce();
    const [, content] = writeFileMock.mock.calls[0] as unknown as [
      string,
      string,
    ];
    expect(JSON.parse(content)).toEqual(presets);
  });

  it("creates the parent directory before writing", async () => {
    await savePresets([]);
    expect(mkdirMock).toHaveBeenCalledWith(
      expect.stringContaining("agent-coord"),
      { recursive: true }
    );
    expect(mkdirMock.mock.invocationCallOrder[0]).toBeLessThan(
      writeFileMock.mock.invocationCallOrder[0]!
    );
  });
});

describe("DEFAULT_PRESETS", () => {
  it("includes a coordinator preset", () => {
    expect(DEFAULT_PRESETS.find((p) => p.role === "coordinator")).toBeDefined();
  });

  it("includes a worker preset", () => {
    expect(DEFAULT_PRESETS.find((p) => p.role === "worker")).toBeDefined();
  });

  it("all presets have required fields", () => {
    for (const p of DEFAULT_PRESETS) {
      expect(p.id).toBeTruthy();
      expect(p.launchCmd).toBeTruthy();
      expect(p.skillInvocation).toBeTruthy();
      expect(p.model).toBeTruthy();
    }
  });
});
