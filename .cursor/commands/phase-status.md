# Phase Status - Progress Reporter

**Objective**: Report on phase progress, highlighting completed work, current status, and remaining tasks.

**Requirements**:

- Read phase documentation files
- Calculate accurate progress statistics
- Identify blockers and risks
- Provide actionable summary

## Files to Read

1. `docs/phases/README.md` - Overall phase progress
2. `docs/phases/phaseN/README.md` - Specific phase overview
3. `docs/phases/phaseN/PHASEN_TASKS.md` - Detailed task status
4. `docs/CURRENT_FOCUS.md` - Active work context

## Output Format

```markdown
## Phase N: [Phase Name] - Status Report

**Overall Progress**: XX% complete
**Status**: 🚧 In Progress | ✅ Complete | ⏳ Not Started

### Sprint Breakdown

| Sprint   | Focus  | Progress   | Status |
| -------- | ------ | ---------- | ------ |
| Sprint 1 | [Name] | 4/4 (100%) | ✅     |
| Sprint 2 | [Name] | 2/4 (50%)  | 🚧     |
| Sprint 3 | [Name] | 0/3 (0%)   | ⏳     |

### Completed Tasks

- ✅ Task 1: [Name]
- ✅ Task 2: [Name]

### In Progress

- 🚧 Task 3: [Name] - [Current sub-step]

### Remaining

- ⏳ Task 4: [Name]
- ⏳ Task 5: [Name]

### Blockers

- [Any blocking issues, or "None"]

### Risks

- [Any identified risks]

### Estimated Remaining Work

- [X tasks remaining]
- [Key deliverables left]
```

## Progress Calculation

Count checkboxes:

- `- [x]` = completed
- `- [ ]` = remaining

Calculate: `completed / total * 100`

## Status Indicators

- ✅ Complete (100%)
- 🚧 In Progress (1-99%)
- ⏳ Not Started (0%)
- 🔴 Blocked
- ⚠️ At Risk

**Output**: Comprehensive phase status report with actionable insights.
