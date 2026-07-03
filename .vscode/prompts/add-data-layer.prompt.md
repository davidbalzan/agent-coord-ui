---
mode: edit
description: Add an optional Drizzle ORM + PostgreSQL data layer to a Groundwork project
---

<!-- GENERATED from .claude/skills/add-data-layer/SKILL.md by `groundwork`. Do not edit by hand. -->

# Add Data Layer - Optional Persistence Module

The Groundwork starter is intentionally **database-agnostic** — no ORM or DB is wired in.
Run this only when a feature actually needs to store something (a foundation phase rarely
does). It adds a type-safe Drizzle data layer and records the choice as an ADR. When
updating docs, preserve frontmatter and use `[[wikilinks]]`.

## Default Recipe: Drizzle + PostgreSQL

### Stage 1: Confirm the choice

Ask only if ambiguous:

- **Engine?** PostgreSQL (default), MySQL, or SQLite.
- **Driver?** Postgres → `postgres` (postgres.js). MySQL → `mysql2`. SQLite → `better-sqlite3`.

### Stage 2: Install dependencies

```bash
pnpm --filter @<scope>/api add drizzle-orm postgres
pnpm --filter @<scope>/api add -D drizzle-kit
```

(MySQL: swap `postgres` → `mysql2`. SQLite: `better-sqlite3`.)

### Stage 3: Files to create (apps/api)

```
apps/api/
├── drizzle.config.ts          # drizzle-kit config (schema path, out dir, dialect, dbCredentials)
├── src/db/
│   ├── client.ts              # drizzle(postgres(env.DATABASE_URL)) singleton
│   ├── schema.ts              # table definitions (pgTable/...) — start small
│   └── index.ts               # re-export client + schema
└── migrations/                # generated SQL (drizzle-kit generate)
```

`src/db/client.ts` (Postgres):

```ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../env";
import * as schema from "./schema";

const client = postgres(env.DATABASE_URL, { max: 10 });
export const db = drizzle(client, { schema });
```

`drizzle.config.ts`:

```ts
import { defineConfig } from "drizzle-kit";
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

### Stage 4: Environment + validation

Add to `apps/api/src/env.ts` (Zod schema) and `.env.example`:

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/app
```

### Stage 5: docker-compose service

Ensure `docker-compose.yml` has a Postgres service (most Groundwork starters already
ship one — verify the port/credentials match `DATABASE_URL`):

```yaml
services:
  db:
    image: postgres:17
    environment:
      POSTGRES_PASSWORD: postgres
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]
volumes: { pgdata: {} }
```

### Stage 6: Package scripts

Add to `apps/api/package.json`:

```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio"
  }
}
```

### Stage 7: Record the decision

1. `/log-decision "Use Drizzle ORM + PostgreSQL for persistence"` — capture why
   (type-safety, migration story) and alternatives (Prisma, raw SQL, Kysely).
2. Update `docs/STACK_MAP.md`: move Drizzle + the DB engine from the **Optional
   modules** section into the active **Backend** table with pinned versions.
3. Pin to **latest stable** versions (check the registry; do not copy versions from
   memory).

## Verify

```bash
docker compose up -d db
pnpm --filter @<scope>/api db:generate
pnpm --filter @<scope>/api db:migrate
```

Confirm the app boots and a trivial query against `db` works before closing the stream.

## Notes

- Keep `schema.ts` minimal at first — add tables as features need them, not upfront.
- For MySQL use `drizzle-orm/mysql2` + `mysqlTable`; for SQLite `drizzle-orm/better-sqlite3` + `sqliteTable`, and set `dialect` accordingly.

Engine requested: (the input you provide)
