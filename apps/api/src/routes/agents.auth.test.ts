import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { Hono } from "hono";
import type { HttpBindings } from "@hono/node-server";

// Route-level integration: with auth CONFIGURED, the privileged preset routes
// must require a valid bearer JWT. env.ts parses process.env at import time, so
// the secrets are set before the dynamic imports in beforeAll. (The sibling
// agents.test.ts covers the unconfigured/loopback fallback path.)

const SECRET = "test-secret-at-least-32-chars-long-xx";
const PASSWORD = "correct-horse-battery-staple";

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

const VALID_PRESET = {
  id: "test-preset",
  label: "Test Preset",
  model: "claude-sonnet-4-6",
  role: "worker" as const,
  launchCmd: "claude",
  skillInvocation: "/coord-worker --id={agentId}",
};

function loopbackEnv(headers: Record<string, string> = {}): HttpBindings {
  return {
    incoming: { socket: { remoteAddress: "127.0.0.1" }, headers },
    outgoing: {} as never,
  } as unknown as HttpBindings;
}

describe("agents routes — JWT auth configured", () => {
  let app: Hono<{ Bindings: HttpBindings }>;
  let token: string;

  beforeAll(async () => {
    process.env.AUTH_JWT_SECRET = SECRET;
    process.env.AUTH_PASSWORD = PASSWORD;
    const { agentRoutes } = await import("./agents.js");
    const { issueToken } = await import("../auth.js");
    token = await issueToken();
    app = new Hono<{ Bindings: HttpBindings }>();
    app.route("/api", agentRoutes);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    loadPresetsMock.mockResolvedValue([]);
    savePresetsMock.mockResolvedValue(undefined);
  });

  function post(headers: Record<string, string>) {
    return app.request(
      "/api/agents/presets",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(VALID_PRESET),
      },
      loopbackEnv()
    );
  }

  it("rejects POST with no token — 401", async () => {
    const res = await post({});
    expect(res.status).toBe(401);
    expect(savePresetsMock).not.toHaveBeenCalled();
  });

  it("rejects POST with a malformed token — 401", async () => {
    const res = await post({ Authorization: "Bearer not.a.real.jwt" });
    expect(res.status).toBe(401);
    expect(savePresetsMock).not.toHaveBeenCalled();
  });

  it("accepts POST with a valid bearer token — 201", async () => {
    const res = await post({ Authorization: `Bearer ${token}` });
    expect(res.status).toBe(201);
    expect(savePresetsMock).toHaveBeenCalledOnce();
  });
});
