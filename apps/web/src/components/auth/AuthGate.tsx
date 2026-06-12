import { useEffect, useState, type ReactNode } from "react";
import {
  fetchAuthStatus,
  getToken,
  isUnauthorized,
  onUnauthorized,
} from "../../lib/auth.js";
import { busSocket } from "../../lib/ws.js";
import { LoginScreen } from "./LoginScreen.js";
import { FONT_MONO, COLOR_CYAN, COLOR_BG } from "../../theme/tokens.js";

type Phase = "loading" | "authed" | "login";

/** Gates the app behind login when the server enforces auth. When auth is not
 *  required (server unconfigured), renders children immediately. The WS auto-
 *  connects at module load using any stored token; on login we reconnect with
 *  the fresh token, and on a 401/1008 we drop back to the login screen. */
export function AuthGate({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>("loading");

  useEffect(() => {
    let active = true;

    fetchAuthStatus().then((status) => {
      if (!active) return;
      if (!status.authRequired) {
        setPhase("authed");
        return;
      }
      // Auth required: optimistically trust a stored token (the WS/HTTP layer
      // will bounce us back here via onUnauthorized if it's stale or expired).
      setPhase(getToken() && !isUnauthorized() ? "authed" : "login");
    });

    const off = onUnauthorized(() => active && setPhase("login"));
    return () => {
      active = false;
      off();
    };
  }, []);

  if (phase === "loading") {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: COLOR_BG,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: FONT_MONO,
          fontSize: 13,
          color: COLOR_CYAN,
          opacity: 0.7,
          letterSpacing: 1,
        }}
      >
        connecting…
      </div>
    );
  }

  if (phase === "login") {
    return (
      <LoginScreen
        onSuccess={() => {
          busSocket.connect(); // reconnect with the freshly stored token
          setPhase("authed");
        }}
      />
    );
  }

  return <>{children}</>;
}
