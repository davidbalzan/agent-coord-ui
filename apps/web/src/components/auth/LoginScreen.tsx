import { useState, useCallback, type FormEvent } from "react";
import { login } from "../../lib/auth.js";
import {
  FONT_MONO,
  FONT_DISPLAY,
  COLOR_CYAN,
  COLOR_BG,
  COLOR_RED,
} from "../../theme/tokens.js";

interface Props {
  /** Called after a successful login (token is already stored). */
  onSuccess: () => void;
}

export function LoginScreen({ onSuccess }: Props) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!password || busy) return;
      setBusy(true);
      setError(null);
      const result = await login(password);
      setBusy(false);
      if (result.ok) {
        setPassword("");
        onSuccess();
      } else {
        setError(result.error);
      }
    },
    [password, busy, onSuccess]
  );

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: COLOR_BG,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000,
      }}
    >
      <form
        onSubmit={submit}
        style={{
          width: 360,
          maxWidth: "90vw",
          padding: "32px 28px",
          background: "rgba(0,8,22,0.97)",
          border: `1px solid ${COLOR_CYAN}`,
          borderRadius: 4,
          boxShadow: `0 0 40px rgba(0,212,255,0.25)`,
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 18,
            letterSpacing: 2,
            color: COLOR_CYAN,
            textTransform: "uppercase",
          }}
        >
          Authenticate
        </div>
        <div style={{ fontFamily: FONT_MONO, fontSize: 12, opacity: 0.6 }}>
          Operator access required.
        </div>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="operator password"
          style={{
            fontFamily: FONT_MONO,
            fontSize: 14,
            padding: "10px 12px",
            background: "rgba(0,0,0,0.4)",
            border: `1px solid ${COLOR_CYAN}`,
            borderRadius: 3,
            color: COLOR_CYAN,
            outline: "none",
          }}
        />
        {error && (
          <div
            role="alert"
            style={{ fontFamily: FONT_MONO, fontSize: 12, color: COLOR_RED }}
          >
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={busy || !password}
          style={{
            fontFamily: FONT_MONO,
            fontSize: 13,
            padding: "10px 12px",
            background: busy ? "rgba(0,212,255,0.1)" : "rgba(0,212,255,0.15)",
            border: `1px solid ${COLOR_CYAN}`,
            borderRadius: 3,
            color: COLOR_CYAN,
            cursor: busy || !password ? "default" : "pointer",
            textTransform: "uppercase",
            letterSpacing: 1,
            opacity: !password ? 0.5 : 1,
          }}
        >
          {busy ? "authenticating…" : "enter"}
        </button>
      </form>
    </div>
  );
}
