# Distill - Learning to ADR Converter

**Objective**: Convert accumulated learnings from `~/.claude/knowledge/` into formal Architectural Decision Records for the current project.

**When to Use (Sparingly)**:

- Team needs the "why" — onboarding, justifying to stakeholders
- Significant trade-offs — decision has real costs worth documenting
- Might be challenged — someone could reasonably disagree

Don't distill personal preferences or obvious choices.

**Obsidian format (required)**: `docs/DECISIONS.md` has YAML frontmatter — preserve it when appending a new ADR. Use `[[wikilinks]]` inside the ADR body where relevant.

**Usage**:

- Browse learnings from a category: `distill typescript`
- Distill a specific learning: `distill Use Hono for TypeScript-first APIs`
- Interactive mode: `distill`

**Instructions**:

1. Determine mode from input — if empty show categories, if category name list learnings, if learning text search and distill
2. Show learnings and let user pick
3. Gather ADR context: what problem led to this, alternatives considered, trade-offs
4. Generate ADR in standard format (Context, Decision, Consequences, Alternatives Considered)
5. Append to `docs/DECISIONS.md` with correct ADR numbering
6. Confirm to user and show the generated ADR
