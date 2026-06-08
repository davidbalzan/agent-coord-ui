# Remember - Global Knowledge Capture

**Objective**: Persist learnings to `~/.claude/knowledge/` and sync to Agent Coord UI repo.

**Usage**:

- With explicit category: `remember typescript: Always use Zod for runtime validation`
- Without category (auto-detected): `remember Always use Zod for runtime validation`

**Instructions**:

1. Parse input — format is `<category>: <learning>` or just `<learning>`
2. Auto-categorize if no category specified (typescript, react, tailwind, testing, architecture, database, ai, devops, process, general)
3. Confirm detected category with user before saving
4. Append to `~/.claude/knowledge/<category>.md` with date: `- [YYYY-MM-DD] <learning>`
5. Update `~/.claude/knowledge/README.md` index
6. Sync to Agent Coord UI repo if inside it
7. Confirm to user what was saved and where
