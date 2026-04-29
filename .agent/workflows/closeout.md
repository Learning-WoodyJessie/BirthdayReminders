---
description: Wrap up a development session — update docs, commit, push, and mark phase complete.
---

# /closeout

Use this workflow to wrap up a development session and maintain clean project history.

## Prerequisites
- `/audit` has been completed and passed
- `docs/BUGS.md` shows all items resolved (or explicitly deferred) for the current feature
- All tests passing: `python -m pytest tests/ -v`
- Warmly build clean (if applicable): `cd warmly && node_modules/.bin/next build`

## The Process

### 1. Integration of Learnings
- Pull the "friction points" identified in the recent `/kaizen` session
- Update `.agent/gotchas.md` with any new failure patterns discovered this session:
  - Pattern name
  - Wrong example vs right example
  - The "tell" that signals the problem
  - Update the "Last updated" line

### 2. Documentation Update

**PROJECT_HISTORY.md** — prepend a new dated entry:
```
## [YYYY-MM-DD] — [Feature/Phase Name]

### Accomplished
- <bullet>

### Learned
- <bullet>

### Deferred
- <bullet (link to BUGS.md item)>
```

**docs/ROADMAP.md** — mark the just-completed feature with ✅ and check off completed items.

**docs/BUGS.md** — move resolved items from Active to Resolved section.

**README.md** — if the feature changes what the system does from a user's perspective, update:
- Architecture section if a new tool/module was added
- Running section if new commands were added

### 3. Git Hygiene + CI Check

```bash
# Full test suite — must be green
python -m pytest tests/ -v

# Warmly build (if warmly/ was changed)
cd warmly && node_modules/.bin/next build

# Stage and commit docs + code together
git add <specific files — never git add -A>
git commit -m "docs: closeout <feature name> session"

# Push
git push
```

**Secret Hygiene**: If this feature added new env vars:
- [ ] Added to GitHub → Settings → Secrets → Actions (if used in GitHub Actions)
- [ ] Added to Vercel env vars (if used in warmly/)
- [ ] Documented in `CLAUDE.md` secrets table

### 4. Phase Transition (If Applicable)

Check `docs/ROADMAP.md`:
- Did we just complete a full phase?
- If yes, ask the user: "Start the next phase or stay on this branch?"
- If starting next phase: `git checkout -b phase-N-<name>`

### 5. Summary

Provide a concise final summary (5–8 bullets max):
- What shipped
- What was deferred (and where it's logged)
- Test count (before → after)
- Next feature/phase name
