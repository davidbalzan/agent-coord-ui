# Kickstart - Project Initialization

**Objective**: Initialize a new project with the complete Agent Coord UI documentation structure through a guided discovery process.

**Requirements**:

- Follow the 7-stage discovery flow below
- Ask questions to gather information before generating files
- Use the templates in `docs/templates/` and `docs/phases/templates/`
- Create all files with proper cross-references

**Obsidian format (required)**: All generated files in `docs/` must start with YAML frontmatter (`title`, `tags: [agent-coord-ui/core|reference|phase|template]`, `aliases`) and use `[[wikilinks]]` for cross-references. Templates already have frontmatter — preserve it and update the title/aliases to match the project.

## Stage 1: Project Setup

Gather basic information:

1. Project name
2. Project type (Web app, API, CLI, library, mobile)
3. Brief description (one sentence)

Create folder structure:

```
project-root/
├── docs/
│   ├── phases/
│   │   └── templates/
│   └── templates/
├── client/src/          # If frontend needed
└── server/src/          # If backend needed
```

## Stage 2: Tech Stack Discovery

Ask about each layer (skip if not applicable):

**Frontend**: Framework, Build tool, Styling, State management
**Backend**: Runtime, Framework, Database, ORM
**Infrastructure**: Package manager, Monorepo (Yes/No), Deployment target

Generate `docs/TECH_STACK.md` using `docs/templates/TECH_STACK_TEMPLATE.md` as the structure.

## Stage 3: Architecture Decisions

For each major technology choice, ask:

1. Why this choice?
2. What alternatives were considered?
3. What are the trade-offs?

Generate using the corresponding templates in `docs/templates/`:

- `docs/ARCHITECTURE_GUIDE.md` - from `ARCHITECTURE_GUIDE_TEMPLATE.md`
- `docs/DECISIONS.md` - Initial ADRs for key choices (use existing DECISIONS.md ADR template section as structure)

## Stage 4: Project Phases

Ask about project scope:

1. What's the MVP?
2. What comes after MVP?
3. Any hard deadlines?

Generate using the corresponding templates in `docs/templates/`:

- `docs/PRODUCTION_ROADMAP.md` - from `PRODUCTION_ROADMAP_TEMPLATE.md`
- `docs/phases/README.md` - from `PHASES_README_TEMPLATE.md`
- `docs/phases/phase1/README.md` - from `PHASE_README_TEMPLATE.md`

## Stage 5: Initialize Focus

Create `docs/CURRENT_FOCUS.md` pointing to Phase 1.

## Stage 6: Design System (Optional)

If frontend exists, ask about colors, typography, component style.
Generate `docs/DESIGN_SYSTEM.md` from `docs/templates/DESIGN_SYSTEM_TEMPLATE.md` if applicable.

## Stage 7: Summary

List all created files and suggest next steps:

1. `/create-prd` - Define detailed requirements
2. `/plan-phase` - Create Phase 1 task breakdown
3. `/start-session` - Begin development

**Output**: Complete project documentation structure ready for development.
