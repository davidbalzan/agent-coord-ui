---
name: update-focus
description: Update the Current Focus section in docs/CURRENT_FOCUS.md with session progress
disable-model-invocation: true
argument-hint: "[summary of what was accomplished]"
---

# Update Focus - Session Progress Recorder

Update the "Current Focus" section in `docs/CURRENT_FOCUS.md` to capture session progress for future context.

## Obsidian Format (Required)

`docs/CURRENT_FOCUS.md` lives in the Obsidian vault and already has YAML frontmatter. When updating:

1. **Do NOT touch the frontmatter** at the top of the file — preserve it exactly.
2. **Use `[[wikilinks]]`** when referencing other docs in session notes (e.g. `[[DECISIONS#adr-005|ADR-005]]`, `[[phase2/README|Phase 2]]`).

## Instructions

1. **Read docs/CURRENT_FOCUS.md** to understand existing state (focus on the "Current Focus" section at the top)
2. **Gather session progress** from conversation context or $ARGUMENTS
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

## After Updating

Confirm the changes made and show the updated status to the user.

Session summary to record: $ARGUMENTS
