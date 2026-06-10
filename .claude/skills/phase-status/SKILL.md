---
name: phase-status
description: Show current phase progress with completion percentages
argument-hint: "[phase number, or leave blank for current]"
allowed-tools: Read, Glob, Grep
---

# Phase Status - Progress Reporter

Display comprehensive status for a project phase.

## Instructions

1. **Determine target phase**:
   - If $ARGUMENTS specifies a phase number, use that
   - Otherwise, read docs/PRODUCTION_ROADMAP.md (Current Focus section) to get current phase
2. **Read phase documentation**:
   - `docs/phases/phaseN/README.md` - Overview and goals
   - `docs/phases/phaseN/PHASEN_TASKS.md` - Detailed tasks
3. **Calculate progress metrics**:
   - Count total tasks and sub-tasks
   - Count completed items (marked with [x] or ✅)
   - Calculate percentages
4. **Generate status report**

## Output Format

```markdown
## Phase N Status: [Phase Name]

**Overall Progress**: ██████████░░░░░░░░░░ 50% (X/Y tasks)

### Task Breakdown

| #   | Task        | Status         | Progress      |
| --- | ----------- | -------------- | ------------- |
| 1   | [Task name] | ✅ Complete    | 100%          |
| 2   | [Task name] | 🚧 In Progress | 3/5 sub-tasks |
| 3   | [Task name] | ⏳ Not Started | 0%            |

### Key Deliverables

- [x] Deliverable 1
- [ ] Deliverable 2

### Success Criteria Status

- ✅ Criterion 1 met
- 🚧 Criterion 2 partially met
- ⏳ Criterion 3 not yet addressed

### Blockers & Risks

- [Any identified blockers]

### Estimated Remaining Work

- [X tasks remaining]
- [Key dependencies]
```

## Progress Bar Generation

Use block characters for visual progress:

- Full: █
- Empty: ░

Example: `████████░░░░░░░░░░░░` = 40%

## Metrics to Calculate

- **Task completion rate**: completed / total tasks
- **Sub-task completion rate**: completed sub-tasks / total sub-tasks
- **Weighted progress**: (completed tasks × weight) / total weighted
- **Time in phase**: days since phase started (if date available)

Phase to report on: $ARGUMENTS
