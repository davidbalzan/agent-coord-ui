import { z } from "zod";

const envSchema = z.object({
  API_PORT: z.coerce.number().default(3000),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  // ─── Phase 8 auth ──────────────────────────────────────────────────────────
  // Both must be set to enforce JWT auth; otherwise privileged ops fall back to
  // loopback-only (pre-Phase-8 behaviour) with a startup warning.
  AUTH_JWT_SECRET: z
    .string()
    .min(32, "AUTH_JWT_SECRET must be at least 32 chars")
    .optional(),
  AUTH_PASSWORD: z.string().min(1).optional(),
  AUTH_TOKEN_TTL: z.string().default("12h"),
  // Keep loopback as a hard extra layer (recommended for local v1). Flip to
  // "false" once a real network deployment with auth is intended (Phase 9).
  AUTH_REQUIRE_LOOPBACK: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
});

function parseEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error("Invalid environment variables:");
    console.error(result.error.flatten().fieldErrors);
    process.exit(1);
  }
  return result.data;
}

export const env = parseEnv();
