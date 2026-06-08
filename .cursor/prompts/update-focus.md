# Update Focus - Session Progress Recorder

Update the "Current Focus" section in `docs/CURRENT_FOCUS.md` to capture session progress for future context.

## Obsidian Format (Required)

`docs/CURRENT_FOCUS.md` has YAML frontmatter — preserve it. Use `[[wikilinks]]` when referencing other docs in session notes (e.g. `[[DECISIONS#adr-005|ADR-005]]`, `[[phase2/README|Phase 2]]`).

## Instructions

1. **Read docs/CURRENT_FOCUS.md** to understand existing state (focus on the "Current Focus" section at the top)
2. **Gather session progress** from conversation context
3. **Update the Current Focus section**:
   - Phase and task (if changed)
   - Quick Context: Done, Next, Blockers
   - Last Updated date

## Current Focus Section Format

```markdown
## Current Focus

> **Quick reference for AI assistants and team members to instantly know where work stands.**

**Phase**: Phase N - [Phase Name] ([status])
**Task**: [Current task description]
**Branch**: `main` or feature branch
**Last Updated**: YYYY-MM-DD

### Quick Context

- **Done**: [Recent completions]
- **Next**: [Upcoming work]
- **Blockers**: [Any blockers, or "None"]
```

## Update Guidelines

- Keep entries concise and scannable
- Use consistent status indicators:
  - ✅ Complete
  - 🚧 In Progress
  - ⏳ Not Started
- Date format: YYYY-MM-DD
- Only update the "Current Focus" section, not the rest of the roadmap

## Also Update Phase Overview Table

If a phase status changed, also update the Phase Overview table:

```markdown
| [Phase N](./phases/phaseN/) | Phase Name | Priority | Status |
```

## After Updating

Confirm the changes made and show the updated status to the user.
