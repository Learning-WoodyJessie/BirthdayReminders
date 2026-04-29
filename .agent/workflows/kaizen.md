---
description: Continuous improvement — review the last build session and identify targeted improvements before closeout.
---

# /kaizen: Compound Engineering

Review the current session and identify **3–5 specific, targeted improvements** that would make this project cleaner, faster, or more maintainable.

## The Process

### 1. Scan the session
Look at what was built, what `/audit` flagged, and where you had to backtrack or iterate.

### 2. Identify friction points
Where did things go wrong, get caught late, or require manual re-triage?

### 3. The 3Ms of Waste

**Muda (Waste)**: Remove dead code, redundant comments, or unused dependencies.
- Example: a function in `tools/` that's no longer called anywhere
- Example: a test that tests a mock instead of real behavior

**Mura (Inconsistency)**: Standardize naming conventions or patterns across related files.
- Example: some tools use `load_X()` naming, others use `get_X()` — pick one
- Example: some Warmly API routes return `{ data }`, others return `{ result }` — standardize

**Muri (Overburden)**: Simplify over-complex functions or logic that "smells".
- Example: `check_reminders.py` orchestrator function doing too much — could it delegate?
- Example: a prompt template that's so long it's unmaintainable

### 4. Entropy Reduction

Core question: "What does the codebase look like *after*?"

- Writing 50 lines that delete 200 lines = net win
- Keeping 14 functions to avoid writing 2 = net loss

Three questions:
1. What's the smallest codebase that solves this?
2. Does the proposed change result in less total code?
3. What can we delete?

Red flags:
- "Keep what exists" (status quo bias)
- "This adds flexibility" (YAGNI)
- "Better separation of concerns" (separation isn't free — it costs lines)

### 5. Propose edits

For each friction point, suggest a concrete change. Each suggestion must include:
- **Target file**: which file to edit
- **Where**: the exact section or function
- **The edit**: the exact change to make

Output only the suggestions — no lengthy explanations. Keep it actionable.

### 6. Update gotchas

If any new failure pattern was identified this session, append it to `.agent/gotchas.md`:
- Pattern name
- What went wrong
- The "tell" that signals the problem
- How to avoid it

### 7. Artifact Management

If `CLAUDE.md` exceeds 500 lines, run progressive disclosure:
1. Find contradictions and redundant instructions
2. Extract core instructions that must stay in root
3. Move detailed/reference content to `.agent/instructions/` as linked files
4. Prune vague or obsolete instructions

## Verification Checklist
- [ ] Codebase is cleaner than it was at the start of the session
- [ ] At least one instance of "Muda" (waste) identified and addressed
- [ ] Process friction documented in `.agent/gotchas.md` if applicable
- [ ] Net lines of code reduced or neutral (entropy check)
- [ ] All 138 tests still pass after any refactoring
