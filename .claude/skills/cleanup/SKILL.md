---
name: cleanup
description: Reset project to clean template state while preserving essential structure
disable-model-invocation: true
argument-hint: "[--dry-run] [--keep-decisions]"
---

# Cleanup - Reset to Template State

Reset the project to a clean template state, removing project-specific content while preserving the essential structure for reuse.

## Instructions

This skill removes transitional/project-specific files while keeping the template infrastructure intact.

### What Gets REMOVED (Project-Specific)

These files contain project-specific content and will be deleted or reset:

```
Files to DELETE:
├── docs/PRD.md                      # Project requirements
├── docs/PRD_*.md                    # Named PRD files
├── docs/TECH_STACK.md               # Technology choices
├── docs/ARCHITECTURE_GUIDE.md       # Architecture decisions
├── docs/DESIGN_SYSTEM.md            # Design tokens
├── docs/PRODUCTION_ROADMAP.md       # Project roadmap
├── docs/phases/phase*/PHASE*_TASKS.md  # Task breakdowns
│
Files to RESET (restore to template state):
├── docs/CURRENT_FOCUS.md                 # Reset to placeholder
└── docs/DECISIONS.md                # Reset to template with example ADR
```

### What Gets PRESERVED (Template Infrastructure)

These files are kept intact for rebuilding:

```
ALWAYS PRESERVED:
├── README.md                        # Project README
├── docs/AGENT_COORD_UI_METHODOLOGY.md              # Core methodology
│
├── docs/
│   ├── COMMANDS.md                  # Commands guide
│   ├── phases/
│   │   ├── README.md                # Phase overview (preserved)
│   │   ├── phase*/README.md         # Phase READMEs (preserved)
│   │   └── templates/               # All templates preserved
│   │       ├── README.md
│   │       ├── TASK_TEMPLATE.md
│   │       └── task_template_prompt.md
│   └── templates/
│       ├── PRD_TEMPLATE.md              # PRD template
│       ├── TECH_STACK_TEMPLATE.md       # Tech stack template
│       ├── ARCHITECTURE_GUIDE_TEMPLATE.md # Architecture template
│       ├── PRODUCTION_ROADMAP_TEMPLATE.md # Roadmap template
│       ├── DESIGN_SYSTEM_TEMPLATE.md    # Design system template
│       ├── PHASES_README_TEMPLATE.md    # Phases overview template
│       └── PHASE_README_TEMPLATE.md     # Individual phase template
│
├── .claude/skills/                  # All skills preserved
├── .cursor/commands/                # All commands preserved
├── .cursor/prompts/                 # All prompts preserved
└── .vscode/prompts/                 # All prompts preserved
```

## Process

### Step 1: Dry Run (Default)

First, show what would be deleted without making changes:

```markdown
## Cleanup Preview

### Files to DELETE:

- docs/PRD.md
- docs/TECH_STACK.md
- docs/ARCHITECTURE_GUIDE.md
- docs/phases/phase2/PHASE2_TASKS.md
- ...

### Files to RESET:

- docs/CURRENT_FOCUS.md → restore to template
- docs/DECISIONS.md → keep only example ADR

### Files PRESERVED:

- docs/phases/phase1/README.md ✓
- docs/phases/phase2/README.md ✓
- docs/templates/PRD_TEMPLATE.md ✓
- ...

Proceed with cleanup? [y/N]
```

### Step 2: Execute Cleanup

After confirmation:

1. **Delete project-specific files**
2. **Reset docs/CURRENT_FOCUS.md** to template state:

   ```markdown
   # Current Focus

   ## 🎯 Active Work

   **Phase**: Not started
   **Task**: None
   **Status**: ⏳ Ready to begin

   ## 📍 Quick Context

   **What we're doing**: Project not yet initialized
   **Why**: -
   **Blocked by**: Nothing
   **Next up**: Run `/kickstart` to initialize project

   ## 🔗 Key Files

   - Methodology: `docs/AGENT_COORD_UI_METHODOLOGY.md`
   - Commands: `docs/COMMANDS.md`

   ## 📝 Session Notes

   _No active session_

   ## 🕐 Last Updated

   **Date**: [Today's date]
   **Status**: ⏳ Not Started
   ```

3. **Reset docs/DECISIONS.md** - Keep structure and example ADR-001, remove project-specific ADRs

### Step 3: Summary

```markdown
## Cleanup Complete

### Deleted: X files

- [list of deleted files]

### Reset: 2 files

- docs/CURRENT_FOCUS.md
- docs/DECISIONS.md

### Preserved: Y files

- Phase READMEs
- All templates
- All skills/commands

Ready to start fresh with `/kickstart`
```

## Options

- `--dry-run` - Preview changes without executing (default behavior)
- `--keep-decisions` - Preserve all ADRs in DECISIONS.md
- `--keep-phases` - Preserve phase task files (PHASE\*\_TASKS.md)

## Safety Features

1. **Always dry-run first** - Show preview before any deletion
2. **Require confirmation** - Ask before executing
3. **Preserve READMEs** - Phase structure stays intact
4. **Preserve templates** - All templates are never touched
5. **Git-aware** - Remind user to commit before cleanup if there are changes

## Arguments: $ARGUMENTS
