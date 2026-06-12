import { SignJWT, jwtVerify } from "jose";
import { createHash, timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { Context, Next } from "hono";
import type { HttpBindings } from "@hono/node-server";
import { env } from "./env.js";
import { logger } from "./logger.js";

// ─── Loopback gate (defense-in-depth, kept as an extra layer under auth) ────────

export function isLoopback(addr: string | undefined): boolean {
  return (
    addr === "127.0.0.1" ||
    addr === "::1" ||
    addr === "::ffff:127.0.0.1" ||
    addr === "localhost"
  );
}

// ─── JWT (HS256 via jose — no custom crypto) ────────────────────────────────────

const ISSUER = "agent-coord-ui";
const AUDIENCE = "agent-coord-ui-operator";
const ALG = "HS256";

/** Auth is enforced only when both the signing secret and operator password are
 *  configured. Unconfigured → falls back to loopback-only (pre-Phase-8 behaviour)
 *  with a loud warning. Set AUTH_JWT_SECRET + AUTH_PASSWORD to enforce. */
export function authConfigured(): boolean {
  return Boolean(env.AUTH_JWT_SECRET && env.AUTH_PASSWORD);
}

function secretKey(): Uint8Array {
  if (!env.AUTH_JWT_SECRET) throw new Error("AUTH_JWT_SECRET not set");
  return new TextEncoder().encode(env.AUTH_JWT_SECRET);
}

export async function issueToken(sub = "operator"): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: ALG })
    .setSubject(sub)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(env.AUTH_TOKEN_TTL)
    .sign(secretKey());
}

/** Verify a token. Returns the subject on success, null on any failure.
 *  `algorithms` is pinned to HS256 to block alg-confusion attacks. */
export async function verifyToken(
  token: string | undefined
): Promise<{ sub: string } | null> {
  if (!token || !env.AUTH_JWT_SECRET) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: [ALG],
    });
    return { sub: String(payload.sub ?? "operator") };
  } catch {
    return null;
  }
}

/** Constant-time password comparison against AUTH_PASSWORD. Both inputs are
 *  SHA-256'd to fixed-length 32-byte digests first, so the comparison is
 *  constant-time AND leaks nothing about the password length via timing. */
export function passwordMatches(input: unknown): boolean {
  if (!env.AUTH_PASSWORD || typeof input !== "string") return false;
  const a = createHash("sha256").update(input).digest();
  const b = createHash("sha256").update(env.AUTH_PASSWORD).digest();
  return timingSafeEqual(a, b);
}

// ─── Shared authorization decision (HTTP + WS) ──────────────────────────────────

export type AuthDecision =
  | { ok: true; sub: string | null }
  | { ok: false; status: 401 | 403 | 503; error: string };

/** The single source of truth for "may this caller perform a privileged op?".
 *  Order: loopback layer → configured-check → JWT verify. */
export async function authorize(
  addr: string | undefined,
  token: string | undefined
): Promise<AuthDecision> {
  if (env.AUTH_REQUIRE_LOOPBACK && !isLoopback(addr)) {
    return { ok: false, status: 403, error: "Local access only" };
  }
  if (!authConfigured()) {
    // Unconfigured: preserve pre-Phase-8 loopback-only behaviour, loudly.
    logger.warn(
      "AUTH NOT CONFIGURED — privileged ops gated by loopback only. Set AUTH_JWT_SECRET + AUTH_PASSWORD to enforce auth."
    );
    return { ok: true, sub: null };
  }
  const claims = await verifyToken(token);
  if (!claims) return { ok: false, status: 401, error: "unauthorized" };
  return { ok: true, sub: claims.sub };
}

// ─── HTTP middleware ────────────────────────────────────────────────────────────

function bearer(c: Context): string | undefined {
  const h = c.req.header("authorization");
  return h?.startsWith("Bearer ") ? h.slice(7) : undefined;
}

/** Gate a privileged HTTP route. Replaces the old per-file requireLoopback. */
export async function requireAuth(
  c: Context<{ Bindings: HttpBindings }>,
  next: Next
) {
  const addr = c.env?.incoming?.socket?.remoteAddress;
  const decision = await authorize(addr, bearer(c));
  if (!decision.ok) {
    logger.warn(
      { addr, status: decision.status },
      "rejected privileged request"
    );
    return c.json({ error: decision.error }, decision.status);
  }
  return next();
}

// ─── WS handshake helpers ───────────────────────────────────────────────────────

export const WS_AUTH_PROTOCOL = "coord-auth";

/** Extract the JWT from the Sec-WebSocket-Protocol header. The browser sends
 *  `new WebSocket(url, ["coord-auth", "<jwt>"])` → header "coord-auth, <jwt>".
 *  Avoids putting the token in the URL (which would leak into access logs). */
export function parseWsToken(
  protocolHeader: string | undefined
): string | undefined {
  if (!protocolHeader) return undefined;
  const parts = protocolHeader.split(",").map((p) => p.trim());
  const idx = parts.indexOf(WS_AUTH_PROTOCOL);
  if (idx === -1) return undefined;
  return parts[idx + 1];
}

/** Authorize a WS upgrade. Returns the auth decision for the connection. */
export function authorizeWs(req: IncomingMessage): Promise<AuthDecision> {
  const token = parseWsToken(req.headers["sec-websocket-protocol"]);
  return authorize(req.socket.remoteAddress, token);
}
