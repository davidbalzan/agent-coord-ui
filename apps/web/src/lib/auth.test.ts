import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getToken,
  setToken,
  clearToken,
  isUnauthorized,
  notifyUnauthorized,
  onUnauthorized,
  authedFetch,
  login,
  fetchAuthStatus,
} from "./auth.js";

describe("web auth", () => {
  beforeEach(() => {
    // The test runner's localStorage is a no-op without a backing file, so
    // install an in-memory implementation for deterministic round-trips.
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, String(v)),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
      key: () => null,
      length: 0,
    });
    // reset the module-level unauthorized flag, then start clean
    setToken("seed");
    clearToken();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("stores and clears the token", () => {
    expect(getToken()).toBeNull();
    setToken("abc.def.ghi");
    expect(getToken()).toBe("abc.def.ghi");
    clearToken();
    expect(getToken()).toBeNull();
  });

  it("authedFetch attaches the bearer header when a token is set", async () => {
    setToken("tok123");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));
    await authedFetch("/api/agents/presets", { method: "POST" });
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(headers.get("Authorization")).toBe("Bearer tok123");
  });

  it("authedFetch omits the header when no token", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));
    await authedFetch("/api/agents/presets");
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(headers.get("Authorization")).toBeNull();
  });

  it("authedFetch notifies + clears token on 401", async () => {
    setToken("stale");
    let fired = false;
    const off = onUnauthorized(() => (fired = true));
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 401 })
    );
    await authedFetch("/api/backlogs/x/queue", { method: "PUT" });
    expect(fired).toBe(true);
    expect(isUnauthorized()).toBe(true);
    expect(getToken()).toBeNull();
    off();
  });

  it("login stores the returned token on success", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ token: "fresh.jwt" }), { status: 200 })
    );
    const result = await login("pw");
    expect(result.ok).toBe(true);
    expect(getToken()).toBe("fresh.jwt");
  });

  it("login surfaces the server error on failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "invalid credentials" }), {
        status: 401,
      })
    );
    const result = await login("wrong");
    expect(result).toEqual({ ok: false, error: "invalid credentials" });
    expect(getToken()).toBeNull();
  });

  it("fetchAuthStatus defaults to not-required when unreachable", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("down"));
    expect(await fetchAuthStatus()).toEqual({ authRequired: false });
  });

  it("notifyUnauthorized flips the flag and clears the token", () => {
    setToken("x");
    notifyUnauthorized();
    expect(isUnauthorized()).toBe(true);
    expect(getToken()).toBeNull();
  });
});
