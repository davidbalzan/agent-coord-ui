// Client-side auth: holds the operator JWT, exchanges the shared password for
// it, and decorates privileged HTTP requests. The token is also passed to the
// WS handshake via subprotocol (see ws.ts).

const TOKEN_KEY = "coord-auth-token";

let unauthorized = false;
const listeners = new Set<() => void>();

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // storage unavailable — token lives for this page session only
  }
  unauthorized = false;
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

export function isUnauthorized(): boolean {
  return unauthorized;
}

/** Called when the server rejects our token (HTTP 401 or WS close 1008). */
export function notifyUnauthorized(): void {
  unauthorized = true;
  clearToken();
  for (const l of listeners) l();
}

export function onUnauthorized(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export interface AuthStatus {
  authRequired: boolean;
}

/** Whether the server enforces auth. Defaults to not-required if unreachable
 *  (the server is the source of truth; a transient failure shouldn't lock the UI). */
export async function fetchAuthStatus(): Promise<AuthStatus> {
  try {
    const res = await fetch("/api/auth/status");
    if (!res.ok) return { authRequired: false };
    return (await res.json()) as AuthStatus;
  } catch {
    return { authRequired: false };
  }
}

export type LoginResult = { ok: true } | { ok: false; error: string };

export async function login(password: string): Promise<LoginResult> {
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      const { token } = (await res.json()) as { token: string };
      setToken(token);
      return { ok: true };
    }
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    return { ok: false, error: body.error ?? `login failed (${res.status})` };
  } catch {
    return { ok: false, error: "network error — is the API reachable?" };
  }
}

/** fetch() that attaches the bearer token and surfaces 401 as an unauthorized
 *  event so the UI can re-prompt for login. Use for privileged writes. */
export async function authedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(input, { ...init, headers });
  if (res.status === 401) notifyUnauthorized();
  return res;
}
