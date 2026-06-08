---
mode: edit
description: Initialize a new project with Agent Coord UI documentation structure
---

# Kickstart - Project Initialization Wizard

Initialize a new project with the complete Agent Coord UI documentation structure. This prompt guides you through setting up all foundational documents for a well-organized, AI-friendly project.

## Obsidian Format (Required)

All generated files in `docs/` must start with YAML frontmatter (`title`, `tags: [agent-coord-ui/core|reference|phase|template]`, `aliases`) and use `[[wikilinks]]` for cross-references. Templates already have frontmatter — preserve it and update the title/aliases to match the project.

## Instructions

Follow this guided flow to set up a new project from scratch.

### Stage 1: Project Setup

First, gather basic information:

1. **Project name** - What's the project called?
2. **Project type** - Web app, API, CLI, library, mobile, etc.
3. **Brief description** - One sentence about what it does

Then create the folder structure:

```
project-root/
├── docs/
│   ├── phases/
│   │   └── templates/
│   └── templates/
├── client/src/          # If frontend needed
└── server/src/          # If backend needed
```

### Stage 2: Tech Stack Discovery

Ask about each layer (skip if not applicable):

**Frontend:**

- Framework? (React, Vue, Svelte, etc.)
- Build tool? (Vite, Next.js, etc.)
- Styling? (Tailwind, CSS-in-JS, etc.)
- State management? (Zustand, Redux, etc.)

**Backend:**

- Runtime? (Node.js, Deno, Bun, Python, Go, etc.)
- Framework? (Hono, Express, FastAPI, etc.)
- Database? (PostgreSQL, MySQL, MongoDB, etc.)
- ORM? (Drizzle, Prisma, SQLAlchemy, etc.)

**Infrastructure:**

- Package manager? (pnpm, npm, yarn)
- Monorepo? (Yes/No)
- Deployment target? (Vercel, AWS, Docker, etc.)

Generate `docs/TECH_STACK.md` using `docs/templates/TECH_STACK_TEMPLATE.md` as the structure. Fill in the placeholders with the collected information.

### Stage 3: Architecture Decisions

For each major technology choice, ask:

1. **Why this choice?** - Rationale for the decision
2. **What alternatives were considered?** - Other options evaluated
3. **What are the trade-offs?** - Pros and cons

Generate using the corresponding templates in `docs/templates/`:

- `docs/ARCHITECTURE_GUIDE.md` - from `ARCHITECTURE_GUIDE_TEMPLATE.md`
- `docs/DECISIONS.md` - Initial ADRs for key choices (use existing DECISIONS.md ADR template section as structure)

### Stage 4: Project Phases

Ask about the project scope:

1. **What's the MVP?** - Minimum viable product scope
2. **What comes after MVP?** - Future phases
3. **Any hard deadlines?** - Timeline constraints

Suggest a phase structure based on project type:

**Typical Web App Phases:**

```
Phase 1: Foundation (Setup, Auth, Core UI)
Phase 2: Core Features (Main functionality)
Phase 3: Polish (UX, Performance, Testing)
Phase 4: Launch (Deployment, Monitoring)
```

**Typical API Phases:**

```
Phase 1: Foundation (Setup, Database, Core Endpoints)
Phase 2: Security (Auth, Rate Limiting, Validation)
Phase 3: Features (Business Logic, Integrations)
Phase 4: Production (Monitoring, Docs, Deployment)
```

Generate using the corresponding templates in `docs/templates/`:

- `docs/PRODUCTION_ROADMAP.md` - from `PRODUCTION_ROADMAP_TEMPLATE.md`
- `docs/phases/README.md` - from `PHASES_README_TEMPLATE.md`
- `docs/phases/phase1/README.md` - from `PHASE_README_TEMPLATE.md`

### Stage 5: Initialize Focus

Set up the current focus document:

- Point to Phase 1 as the starting point
- Note any immediate next steps
- Leave session notes empty for first session

Generate `docs/CURRENT_FOCUS.md`.

### Stage 6: Design System (Optional)

If the project has a frontend, ask:

1. **Color scheme?** - Primary, secondary, accent colors
2. **Typography?** - Font family preferences
3. **Component style?** - Minimal, modern, playful, corporate

Generate `docs/DESIGN_SYSTEM.md` from `docs/templates/DESIGN_SYSTEM_TEMPLATE.md` if applicable.

### Stage 7: Summary & Next Steps

Provide a summary of everything created:

```markdown
## Project Initialized: [Project Name]

### Files Created

- docs/TECH_STACK.md
- docs/ARCHITECTURE_GUIDE.md
- docs/DECISIONS.md
- docs/PRODUCTION_ROADMAP.md
- docs/DESIGN_SYSTEM.md (if frontend)
- docs/phases/README.md
- docs/phases/phase1/README.md
- docs/phases/templates/TASK_TEMPLATE.md
- docs/templates/PRD_TEMPLATE.md
- docs/CURRENT_FOCUS.md

### Next Steps

1. Use `create-prd` prompt to define detailed requirements
2. Use `plan-phase` prompt to create Phase 1 detailed tasks
3. Use `start-session` prompt to begin development
```

## Output Files

| File                           | Source Template                                 | Purpose                             |
| ------------------------------ | ----------------------------------------------- | ----------------------------------- |
| `docs/TECH_STACK.md`           | `docs/templates/TECH_STACK_TEMPLATE.md`         | Technology choices and versions     |
| `docs/ARCHITECTURE_GUIDE.md`   | `docs/templates/ARCHITECTURE_GUIDE_TEMPLATE.md` | System design and patterns          |
| `docs/DECISIONS.md`            | (ADR template in existing file)                 | Architectural Decision Records      |
| `docs/PRODUCTION_ROADMAP.md`   | `docs/templates/PRODUCTION_ROADMAP_TEMPLATE.md` | High-level phase overview           |
| `docs/DESIGN_SYSTEM.md`        | `docs/templates/DESIGN_SYSTEM_TEMPLATE.md`      | Visual design guidelines (optional) |
| `docs/phases/README.md`        | `docs/templates/PHASES_README_TEMPLATE.md`      | Phase navigation and progress       |
| `docs/phases/phase1/README.md` | `docs/templates/PHASE_README_TEMPLATE.md`       | First phase overview                |
| `docs/CURRENT_FOCUS.md`        | (generated from context)                        | Active work quick reference         |

## Tips

- **Start lean**: You can always add more detail later
- **Capture decisions early**: Future you will thank you
- **Don't overthink phases**: They can be adjusted as you learn
- **Link documents**: Cross-reference between docs for navigation

## Related Prompts

After kickstart, use these in order:

1. `create-prd` prompt - Define detailed product requirements
2. `plan-phase` prompt - Create Phase 1 task breakdown
3. `start-session` prompt - Begin your first coding session
4. `log-decision` prompt - Record decisions as you make them
