import { describe, it, expect, beforeAll, vi } from "vitest";
import { SignJWT } from "jose";

// env.ts parses process.env at import time, so secrets must be set before the
// dynamic import of ./auth.js below.
const SECRET = "test-secret-at-least-32-chars-long-xx";
const PASSWORD = "correct-horse-battery-staple";

describe("auth (configured)", () => {
  let auth: typeof import("./auth.js");

  beforeAll(async () => {
    process.env.AUTH_JWT_SECRET = SECRET;
    process.env.AUTH_PASSWORD = PASSWORD;
    auth = await import("./auth.js");
  });

  it("authConfigured is true when both secrets set", () => {
    expect(auth.authConfigured()).toBe(true);
  });

  it("round-trips a signed token", async () => {
    const token = await auth.issueToken();
    expect(await auth.verifyToken(token)).toEqual({ sub: "operator" });
  });

  it("rejects a tampered token", async () => {
    const token = await auth.issueToken();
    const tampered = token.slice(0, -3) + "AAA";
    expect(await auth.verifyToken(tampered)).toBeNull();
  });

  it("rejects a token signed with a different secret (no alg confusion)", async () => {
    const otherKey = new TextEncoder().encode(
      "a-totally-different-secret-32+chars"
    );
    const forged = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("operator")
      .setIssuer("agent-coord-ui")
      .setAudience("agent-coord-ui-operator")
      .setIssuedAt()
      .setExpirationTime("12h")
      .sign(otherKey);
    expect(await auth.verifyToken(forged)).toBeNull();
  });

  it("rejects undefined / empty tokens", async () => {
    expect(await auth.verifyToken(undefined)).toBeNull();
    expect(await auth.verifyToken("")).toBeNull();
  });

  it("passwordMatches is constant-time-correct", () => {
    expect(auth.passwordMatches(PASSWORD)).toBe(true);
    expect(auth.passwordMatches("wrong")).toBe(false);
    expect(auth.passwordMatches(PASSWORD + "x")).toBe(false);
    expect(auth.passwordMatches(123 as unknown)).toBe(false);
  });

  it("parseWsToken extracts the JWT from the subprotocol header", () => {
    expect(auth.parseWsToken("coord-auth, abc.def.ghi")).toBe("abc.def.ghi");
    expect(auth.parseWsToken("coord-auth")).toBeUndefined();
    expect(auth.parseWsToken(undefined)).toBeUndefined();
    expect(auth.parseWsToken("other-proto")).toBeUndefined();
  });

  it("parseWsToken fails closed on reordered / malformed subprotocol lists", async () => {
    // Positional parse: anything that isn't "coord-auth, <token>" yields no
    // token → authorize() returns 401 (fail-closed), never an auth bypass.
    expect(auth.parseWsToken("abc.def.ghi, coord-auth")).toBeUndefined();
    expect(auth.parseWsToken(", coord-auth")).toBeUndefined();
    expect(
      await auth.authorize("127.0.0.1", auth.parseWsToken("coord-auth"))
    ).toMatchObject({
      ok: false,
      status: 401,
    });
  });

  it("authorize: loopback + valid token → ok", async () => {
    const token = await auth.issueToken();
    expect(await auth.authorize("127.0.0.1", token)).toEqual({
      ok: true,
      sub: "operator",
    });
  });

  it("authorize: missing token → 401", async () => {
    expect(await auth.authorize("127.0.0.1", undefined)).toMatchObject({
      ok: false,
      status: 401,
    });
  });

  it("authorize: non-loopback → 403 before token check", async () => {
    const token = await auth.issueToken();
    expect(await auth.authorize("10.0.0.5", token)).toMatchObject({
      ok: false,
      status: 403,
    });
  });
});

describe("auth (unconfigured)", () => {
  it("falls back to loopback-only with no token", async () => {
    vi.resetModules();
    delete process.env.AUTH_JWT_SECRET;
    delete process.env.AUTH_PASSWORD;
    delete process.env.AUTH_REQUIRE_LOOPBACK;
    const fresh = await import("./auth.js");
    expect(fresh.authConfigured()).toBe(false);
    expect(await fresh.authorize("127.0.0.1", undefined)).toMatchObject({
      ok: true,
    });
    expect(await fresh.authorize("10.0.0.5", undefined)).toMatchObject({
      ok: false,
      status: 403,
    });
  });
});

describe("auth (require-loopback disabled — Phase 9 network mode)", () => {
  it("allows a valid token from a non-loopback address, still rejects no token", async () => {
    vi.resetModules();
    process.env.AUTH_JWT_SECRET = SECRET;
    process.env.AUTH_PASSWORD = PASSWORD;
    process.env.AUTH_REQUIRE_LOOPBACK = "false";
    const fresh = await import("./auth.js");
    const token = await fresh.issueToken();
    expect(await fresh.authorize("10.0.0.5", token)).toMatchObject({
      ok: true,
    });
    expect(await fresh.authorize("10.0.0.5", undefined)).toMatchObject({
      ok: false,
      status: 401,
    });
    delete process.env.AUTH_REQUIRE_LOOPBACK;
  });
});
