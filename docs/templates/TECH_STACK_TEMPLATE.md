---
title: "Tech Stack Template"
tags: [agent-coord-ui/template]
aliases: []
---

# [Project Name] - Complete Tech Stack

> Single source of truth for all technology choices, versions, and rationale. Referenced by AI agents when generating code, suggesting patterns, or debugging compatibility issues.

---

## 📋 Overview

**Project Type**: [Web app / API / CLI / Library / Mobile — describe what this project is and what problem it solves]
**Architecture**: [Monorepo / Monolith / Microservices — describe the high-level architectural approach and why it was chosen]
**Primary Language**: [TypeScript / Python / Go / etc. — include version and strict mode configuration]

---

## 🏗️ Architecture

### Project Structure

```
[project-name]/
├── apps/
│   ├── [app-1]/           # [Purpose: what this app does and who uses it]
│   └── [app-2]/           # [Purpose: what this app does and who uses it]
├── packages/
│   ├── [package-1]/       # [Purpose: what shared functionality this provides]
│   └── [package-2]/       # [Purpose: what shared functionality this provides]
└── docs/                  # Project documentation and templates
```

### Data Flow

```
[Describe the primary data flow through the system, e.g.:]
[User → Browser → Frontend (React) → API (Hono) → Database (PostgreSQL)]
[                                   ← JSON Response ←                  ]
```

---

## 🎨 Frontend Stack ([app location, e.g., apps/web/])

### Core Framework & Build

| Technology               | Version               | Purpose                                                                                         | Why This Choice                                                            |
| ------------------------ | --------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| [Framework, e.g., React] | [version, e.g., 19.x] | [UI framework — describe rendering model, e.g., "Component-based UI with concurrent rendering"] | [Rationale: ecosystem size, team familiarity, performance characteristics] |
| [Build Tool, e.g., Vite] | [version, e.g., 6.x]  | [Build & dev server — describe key features, e.g., "HMR, ESM-native, plugin ecosystem"]         | [Rationale: speed vs alternatives, plugin availability]                    |
| TypeScript               | [version, e.g., 5.x]  | [Type safety — describe strictness level and key compiler options]                              | [Rationale: error prevention, DX, refactoring confidence]                  |

### Styling & UI

| Technology                          | Version              | Purpose                                                                         | Why This Choice                                             |
| ----------------------------------- | -------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| [CSS Framework, e.g., Tailwind CSS] | [version, e.g., 4.x] | [Styling approach — describe methodology: utility-first, CSS-in-JS, BEM, etc.]  | [Rationale: bundle size, DX, design system alignment]       |
| [UI Library, e.g., Lucide React]    | [version]            | [Icon/component library — describe what it provides and customization approach] | [Rationale: consistency, bundle size, tree-shaking support] |

### State Management

| Technology                                     | Version   | Purpose                                                                               | Why This Choice                                                    |
| ---------------------------------------------- | --------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| [State Library, e.g., Zustand / React Context] | [version] | [State management scope — describe what state it manages: global, server, form, etc.] | [Rationale: complexity vs simplicity, bundle size, learning curve] |

### Key Frontend Patterns

- **Routing**: [Library and approach — file-based, config-based, or framework-native]
- **Data Fetching**: [Library and strategy — SWR, React Query, fetch, or framework-native]
- **Form Handling**: [Library or approach — controlled, uncontrolled, form library name]
- **Error Boundaries**: [Strategy for handling runtime errors in the UI]

---

## ⚙️ Backend Stack ([app location, e.g., apps/api/])

### Core Framework & Runtime

| Technology               | Version               | Purpose                                                                                | Why This Choice                                                               |
| ------------------------ | --------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| [Runtime, e.g., Node.js] | [version, e.g., 22.x] | [Server runtime — describe key features: event loop, worker threads, native ESM, etc.] | [Rationale: performance, ecosystem, deployment target compatibility]          |
| [Framework, e.g., Hono]  | [version, e.g., 4.x]  | [Web framework — describe middleware model, routing, and key features]                 | [Rationale: performance benchmarks, type safety, portability across runtimes] |
| TypeScript               | [version]             | [Shared with frontend — note any backend-specific compiler options]                    | [Rationale: end-to-end type safety with shared package]                       |

### Database & ORM

| Technology                   | Version               | Purpose                                                                           | Why This Choice                                                                 |
| ---------------------------- | --------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| [Database, e.g., PostgreSQL] | [version, e.g., 17.x] | [Primary data store — describe data model: relational, document, key-value, etc.] | [Rationale: ACID compliance, scalability, feature set, managed hosting options] |
| [ORM, e.g., Drizzle]         | [version]             | [Database toolkit — describe query approach: query builder, ORM, raw SQL, etc.]   | [Rationale: type safety, migration support, performance, learning curve]        |

### Key Backend Patterns

- **Authentication**: [Strategy and library — JWT, sessions, OAuth provider, etc.]
- **Validation**: [Library and approach — Zod, Joi, class-validator, etc. and where validation occurs]
- **Error Handling**: [Strategy — centralized error handler, error classes, HTTP status mapping]
- **Logging**: [Library and format — structured JSON, log levels, correlation IDs]
- **API Documentation**: [Approach — OpenAPI/Swagger, auto-generated, manual, etc.]

---

## 🔧 Infrastructure

### Package Management & Monorepo

| Technology                       | Version   | Purpose                                                                                         | Why This Choice                                        |
| -------------------------------- | --------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| [Package Manager, e.g., pnpm]    | [version] | [Dependency management — describe key features: workspaces, hoisting strategy, lockfile format] | [Rationale: disk space, speed, monorepo support]       |
| [Monorepo Tool, e.g., Turborepo] | [version] | [Build orchestration — describe key features: caching, parallel tasks, dependency graph]        | [Rationale: build speed, DX, configuration simplicity] |

### Development Environment

| Service                                             | URL                                 | Purpose                                                                         |
| --------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------- |
| Frontend                                            | http://localhost:[port, e.g., 5173] | [Dev server with HMR — describe proxy configuration if applicable]              |
| Backend API                                         | http://localhost:[port, e.g., 3000] | [API server — describe auto-reload setup]                                       |
| Database                                            | localhost:[port, e.g., 5432]        | [Local database — describe how it's provisioned: Docker, native install, cloud] |
| [Additional services like Redis, mail server, etc.] | localhost:[port]                    | [Purpose and provisioning method]                                               |

### Deployment & CI/CD

- **Hosting**: [Platform and approach — Vercel, AWS, Docker, self-hosted, etc.]
- **CI/CD**: [Pipeline tool — GitHub Actions, GitLab CI, etc. and key stages]
- **Environments**: [List environments — dev, staging, production and how they differ]
- **Containerization**: [Docker setup if applicable — base images, compose services]

---

## 📊 Dependency Summary

### Production Dependencies (Critical Path)

| Package        | Version                        | Location                    | Purpose                                      | Upgrade Risk                                      |
| -------------- | ------------------------------ | --------------------------- | -------------------------------------------- | ------------------------------------------------- |
| [Package name] | [Exact version, e.g., ^19.0.0] | [Which app/package uses it] | [What it does in this project — be specific] | [Low/Medium/High — describe breaking change risk] |
| [Package name] | [version]                      | [location]                  | [purpose]                                    | [risk]                                            |
| [Package name] | [version]                      | [location]                  | [purpose]                                    | [risk]                                            |

### Development Dependencies (Tooling)

| Package                     | Version   | Purpose                                                       |
| --------------------------- | --------- | ------------------------------------------------------------- |
| [Dev dep, e.g., typescript] | [version] | [Compiler/transpiler — describe configuration approach]       |
| [Dev dep, e.g., eslint]     | [version] | [Linter — describe config format: flat config, extends, etc.] |
| [Dev dep, e.g., prettier]   | [version] | [Formatter — describe key settings that differ from defaults] |

---

## 🚀 Development Commands

```bash
# Setup
[package-manager] install              # Install all workspace dependencies

# Development
[package-manager] dev                  # Start all apps in development mode (parallel)
[package-manager] dev --filter=[app]   # Start a specific app only

# Quality
[package-manager] build                # Build all packages and apps for production
[package-manager] lint                 # Run linter across all workspaces
[package-manager] typecheck            # TypeScript type checking (no emit)
[package-manager] format               # Run code formatter
[package-manager] test                 # Run test suite [describe framework: vitest, jest, etc.]

# Database (if applicable)
[package-manager] db:migrate           # Run pending database migrations
[package-manager] db:seed              # Seed database with development data
[package-manager] db:studio            # Open database GUI tool
```

---

## ⚠️ Known Limitations & Future Upgrades

| Current Limitation                                                                         | Impact                                                          | Planned Upgrade                                                       | When                                                      |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------- |
| [Limitation — describe what doesn't work or isn't ideal, e.g., "No server-side rendering"] | [Impact on users/DX — e.g., "Slower initial page load, no SEO"] | [Planned solution — e.g., "Migrate to Next.js or add SSR middleware"] | [Trigger condition — e.g., "When SEO becomes a priority"] |
| [Limitation]                                                                               | [Impact]                                                        | [Planned upgrade]                                                     | [When to upgrade]                                         |

---

## 📝 Notes

- [Version pinning strategy — describe whether you pin exact versions or use ranges and why]
- [Browser support targets — describe minimum browser versions if applicable]
- [Node.js version management — describe .nvmrc, volta, or other version management]
- [Environment variables — reference .env.example and describe required vs optional vars]

---

## 🔗 Related Documents

- **[[ARCHITECTURE_GUIDE|Architecture Guide]]** - Why these technologies work together
- **[[DECISIONS|Decisions Log]]** - ADRs for each major technology choice
- **[[DESIGN_SYSTEM|Design System]]** - Visual language built on this stack
