---
description: Log bugs, technical debt, or feature ideas into the tracking system. No implementation — capture only.
---

# /log — Capture without implementing

Categorize what was found, then stop.

**Bug/Debt** → `docs/BUGS.md` active table
**Feature/Idea** → `docs/ROADMAP.md`

## Bug/Debt format

```
| [ID] | Description | Severity | Status | Notes |
| B-001 | <description> | Critical/High/Medium/Low | Active | <context> |
```

For debt items that move code, use this exact format so an agent can fix it without investigation:
```
"Move X from file A (line N) to file B. Update imports in: file C, file D."
```

Severity guide:
- **Critical**: Breaks a daily run or sends wrong messages
- **High**: Incorrect behavior, bad UX in Warmly
- **Medium**: Tech debt that's accumulating
- **Low**: Style/naming inconsistency, nice-to-have improvement

## Feature format

Add to `docs/ROADMAP.md`:
- Small UX tweak → current phase section
- New capability → future phase section

## Hard stops

- No root cause investigation
- No fix proposal
- No new branch
- No reading beyond what's needed to categorize

Confirm with: `"Added [ID] to [File]. Not starting work on this."`
