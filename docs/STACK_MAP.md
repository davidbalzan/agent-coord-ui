---
title: "Stack Map"
tags: [agent-coord-ui/core]
aliases: ["Stack"]
---

# Stack Map

> Quick reference: every technology → the files you touch to swap it.
> For the "why" behind each choice, see [[DECISIONS|[[DECISIONS]]]].

---

## Core

| Technology | Version | Files to Change                                                       |
| ---------- | ------- | --------------------------------------------------------------------- |
| Node.js    | 22+     | `package.json` (`engines`), `.github/workflows/ci.yml`, `Dockerfile`  |
| TypeScript | 5.x     | `tsconfig.base.json`, all `tsconfig.json` files, `package.json` (dep) |
| pnpm       | 10.x    | `package.json` (`packageManager`), `pnpm-workspace.yaml`              |
| Turborepo  | 2.x     | `turbo.json`, `package.json` (dep)                                    |

## Frontend (`apps/web/`)

| Technology   | Version | Files to Change                                                               |
| ------------ | ------- | ----------------------------------------------------------------------------- |
| React        | 19.x    | `apps/web/package.json`, `apps/web/tsconfig.json` (`jsx`), `eslint.config.js` |
| Vite         | 6.x     | `apps/web/vite.config.ts`, `apps/web/package.json`                            |
| Tailwind CSS | 4.x     | `apps/web/src/index.css`, `apps/web/package.json`                             |

## Backend (`apps/api/`)

| Technology | Version | Files to Change                                                          |
| ---------- | ------- | ------------------------------------------------------------------------ |
| Hono       | 4.x     | `apps/api/package.json`, `apps/api/src/index.ts`, `apps/api/src/routes/` |
| Zod        | 3.x     | `apps/api/package.json`, `apps/api/src/env.ts`                           |
| dotenv     | 16.x    | `apps/api/package.json`, `apps/api/src/index.ts`                         |

## Shared Packages

| Package            | Path               | Files to Change                                        |
| ------------------ | ------------------ | ------------------------------------------------------ |
| `@coord-ui/shared` | `packages/shared/` | `packages/shared/package.json`, `packages/shared/src/` |
| `@coord-ui/ui`     | `packages/ui/`     | `packages/ui/package.json`, `packages/ui/src/`         |

## Developer Tooling

| Tool           | Purpose             | Files to Change                                              |
| -------------- | ------------------- | ------------------------------------------------------------ |
| ESLint         | Linting             | `eslint.config.js`, `package.json` (dep)                     |
| Prettier       | Formatting          | `.prettierrc` (if exists), `package.json` (dep)              |
| Vitest         | Testing             | `vitest.config.ts`, `package.json` (dep)                     |
| Husky          | Git hooks           | `.husky/pre-commit`, `package.json` (dep + `prepare` script) |
| lint-staged    | Staged file linting | `package.json` (`lint-staged` config)                        |
| GitHub Actions | CI                  | `.github/workflows/ci.yml`                                   |
