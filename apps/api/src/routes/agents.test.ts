import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { HttpBindings } from "@hono/node-server";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { loadPresetsMock, savePresetsMock } = vi.hoisted(() => ({
  loadPresetsMock: vi.fn(),
  savePresetsMock: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
}));

vi.mock("../presets.js", () => ({
  loadPresets: loadPresetsMock,
  savePresets: savePresetsMock,
}));

vi.mock("../logger.js", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const { agentRoutes, isLoopback } = await import("./agents.js");

beforeEach(() => vi.clearAllMocks());

// ─── Test app wiring ──────────────────────────────────────────────────────────

const app = new Hono<{ Bindings: HttpBindings }>();
app.route("/api", agentRoutes);

function loopbackEnv(): HttpBindings {
  return {
    incoming: { socket: { remoteAddress: "127.0.0.1" } },
    outgoing: {} as never,
  } as unknown as HttpBindings;
}

function remoteEnv(addr: string): HttpBindings {
  return {
    incoming: { socket: { remoteAddress: addr } },
    outgoing: {} as never,
  } as unknown as HttpBindings;
}

const VALID_PRESET = {
  id: "test-preset",
  label: "Test Preset",
  model: "claude-sonnet-4-6",
  role: "worker" as const,
  launchCmd: "claude",
  skillInvocation: "/coord-worker --id={agentId}",
};

// ─── isLoopback tests ─────────────────────────────────────────────────────────

describe("isLoopback", () => {
  it("accepts 127.0.0.1", () => expect(isLoopback("127.0.0.1")).toBe(true));
  it("accepts ::1", () => expect(isLoopback("::1")).toBe(true));
  it("accepts ::ffff:127.0.0.1", () =>
    expect(isLoopback("::ffff:127.0.0.1")).toBe(true));
  it("accepts localhost", () => expect(isLoopback("localhost")).toBe(true));
  it("rejects external IPv4", () =>
    expect(isLoopback("203.0.113.5")).toBe(false));
  it("rejects external IPv6", () =>
    expect(isLoopback("2001:db8::1")).toBe(false));
  it("rejects undefined", () => expect(isLoopback(undefined)).toBe(false));
});

// ─── GET /api/agents/presets ──────────────────────────────────────────────────

describe("GET /api/agents/presets", () => {
  it("returns presets without loopback requirement", async () => {
    loadPresetsMock.mockResolvedValue([VALID_PRESET]);
    const res = await app.request(
      "/api/agents/presets",
      {},
      remoteEnv("203.0.113.5")
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([VALID_PRESET]);
  });
});

// ─── POST /api/agents/presets ─────────────────────────────────────────────────

describe("POST /api/agents/presets", () => {
  beforeEach(() => {
    loadPresetsMock.mockResolvedValue([]);
    savePresetsMock.mockResolvedValue(undefined);
  });

  it("creates preset from loopback — returns 201", async () => {
    const res = await app.request(
      "/api/agents/presets",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(VALID_PRESET),
      },
      loopbackEnv()
    );
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ id: VALID_PRESET.id });
    expect(savePresetsMock).toHaveBeenCalledOnce();
  });

  it("returns 403 for non-loopback origin", async () => {
    const res = await app.request(
      "/api/agents/presets",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(VALID_PRESET),
      },
      remoteEnv("203.0.113.5")
    );
    expect(res.status).toBe(403);
    expect(savePresetsMock).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid preset body (shell metacharacters in launchCmd)", async () => {
    const res = await app.request(
      "/api/agents/presets",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...VALID_PRESET,
          launchCmd: "claude; rm -rf /",
        }),
      },
      loopbackEnv()
    );
    expect(res.status).toBe(400);
    expect(savePresetsMock).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid agentId characters in preset id", async () => {
    const res = await app.request(
      "/api/agents/presets",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...VALID_PRESET, id: "bad id with spaces!" }),
      },
      loopbackEnv()
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for shell metacharacters in repoPath", async () => {
    const res = await app.request(
      "/api/agents/presets",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...VALID_PRESET,
          repoPath: "/home/user/proj; rm -rf /",
        }),
      },
      loopbackEnv()
    );
    expect(res.status).toBe(400);
    expect(savePresetsMock).not.toHaveBeenCalled();
  });

  it("returns 400 for shell metacharacters in lane", async () => {
    const res = await app.request(
      "/api/agents/presets",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...VALID_PRESET,
          lane: "repo|owner",
        }),
      },
      loopbackEnv()
    );
    expect(res.status).toBe(400);
    expect(savePresetsMock).not.toHaveBeenCalled();
  });

  it("returns 400 for shell metacharacters in rooms entry", async () => {
    const res = await app.request(
      "/api/agents/presets",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...VALID_PRESET,
          rooms: ["general", "bad;room"],
        }),
      },
      loopbackEnv()
    );
    expect(res.status).toBe(400);
    expect(savePresetsMock).not.toHaveBeenCalled();
  });

  it("returns 409 when preset id already exists", async () => {
    loadPresetsMock.mockResolvedValue([VALID_PRESET]);
    const res = await app.request(
      "/api/agents/presets",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(VALID_PRESET),
      },
      loopbackEnv()
    );
    expect(res.status).toBe(409);
  });
});

// ─── PUT /api/agents/presets/:id ──────────────────────────────────────────────

describe("PUT /api/agents/presets/:id", () => {
  beforeEach(() => {
    loadPresetsMock.mockResolvedValue([{ ...VALID_PRESET }]);
    savePresetsMock.mockResolvedValue(undefined);
  });

  it("updates preset from loopback — returns 200", async () => {
    const updated = { ...VALID_PRESET, label: "Updated" };
    const res = await app.request(
      `/api/agents/presets/${VALID_PRESET.id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      },
      loopbackEnv()
    );
    expect(res.status).toBe(200);
    expect(((await res.json()) as { label: string }).label).toBe("Updated");
    expect(savePresetsMock).toHaveBeenCalledOnce();
  });

  it("returns 403 for non-loopback", async () => {
    const res = await app.request(
      `/api/agents/presets/${VALID_PRESET.id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(VALID_PRESET),
      },
      remoteEnv("203.0.113.5")
    );
    expect(res.status).toBe(403);
  });

  it("returns 404 when preset not found", async () => {
    const res = await app.request(
      "/api/agents/presets/nonexistent",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...VALID_PRESET, id: "nonexistent" }),
      },
      loopbackEnv()
    );
    expect(res.status).toBe(404);
  });
});

// ─── DELETE /api/agents/presets/:id ──────────────────────────────────────────

describe("DELETE /api/agents/presets/:id", () => {
  beforeEach(() => {
    loadPresetsMock.mockResolvedValue([{ ...VALID_PRESET }]);
    savePresetsMock.mockResolvedValue(undefined);
  });

  it("deletes preset from loopback — returns 204", async () => {
    const res = await app.request(
      `/api/agents/presets/${VALID_PRESET.id}`,
      { method: "DELETE" },
      loopbackEnv()
    );
    expect(res.status).toBe(204);
    expect(savePresetsMock).toHaveBeenCalledOnce();
  });

  it("returns 403 for non-loopback", async () => {
    const res = await app.request(
      `/api/agents/presets/${VALID_PRESET.id}`,
      { method: "DELETE" },
      remoteEnv("203.0.113.5")
    );
    expect(res.status).toBe(403);
  });

  it("returns 404 when preset not found", async () => {
    const res = await app.request(
      "/api/agents/presets/nonexistent",
      { method: "DELETE" },
      loopbackEnv()
    );
    expect(res.status).toBe(404);
  });
});
