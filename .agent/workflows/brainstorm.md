---
description: Brainstorm and design a new feature or complex change. Uses the Socratic method to explore intent and constraints before any code is written.
---

# /brainstorm

Use this workflow BEFORE starting any creative work. Turns ideas into fully formed designs through collaborative dialogue.

## Core Principles
- **Design for Failure Modes**: Always identify what happens when things go wrong. Build in fallbacks.
- **Constraints Create Freedom**: Clearly define what we are NOT building.
- **One Question at a Time**: Don't overwhelm. Guide the user through the design.
- **Incremental Validation**: Present design in chunks and ask for feedback.
- **3PB Philosophy**:
  1. **Make it Work**: Minimal viable logic (the emergency exit)
  2. **Make it Right**: Clean implementation (architecture + P0 standards)
  3. **Make it Fast**: High-performance layer (optimistic UI, native feel)

## The Process

### 1. Discovery

**Pre-read context first**: Before asking any questions, read `docs/ROADMAP.md` and `docs/BUGS.md`. Summarize in 3 bullets:
1. What phase we're closing out or starting
2. What's already decided
3. What actually needs a decision

Only ask about the undecided parts — never re-litigate what the roadmap already documents.

Then read `CLAUDE.md` for architecture constraints.

Ask Socratic questions one at a time:
- **Purpose**: Why are we building this?
- **Audience**: Who uses it? The owner (Python CLI), or external users (Warmly web UI)?
- **Layer**: Which layer does this touch? (`tools/`, `router/`, `prompts/`, `warmly/`)
- **Failure Modes**: What are the edge cases? How do we handle errors?
- **Success Criteria**: What does "done" look like?

**If UI/Frontend (Warmly) Work Detected** — before any design decisions:
1. **Interpret Intent**: Summarize the user goal and the workflow it implies
2. **Translate to UI Architecture**: Identify page shell, layout, primary interaction model
3. **Propose UI Options**: Present 2–3 UI patterns. Use canonical names: table, drawer, modal, tabs, card grid, toast, skeleton loader, empty state, etc.
4. **Recommendation**: Recommend the best pattern and explain why
5. **User Confirmation**: Get explicit approval before proceeding
- After approval: Trigger `ui-development` skill, run domain exploration

### 2. Exploration

**Library Landscape**: Before proposing approaches, check open-source libraries that already solve the core problem. Present a short **Build vs. Borrow** table. If a well-maintained library covers ≥80% of the need, default to it.

**Batch Task Detection**: If any part involves processing >10 items of the same type (contacts, reminders, API calls), flag it — use a CLI script (`scripts/`), not UI-driven steps.

Propose 2-3 approaches with trade-offs. Lead with a recommendation.

**Architecture constraints to keep in mind:**
- No new backend database — YAML files only for the Python layer
- Secrets never in code — GitHub Secrets + Vercel env vars only
- 138 Python tests must continue passing
- WhatsApp delivery is via Twilio sandbox — owner's number only

### 3. Presentation

Present the validated design in sections (Architecture, Components, Data Flow, Error Handling). After each section, pause: "Does this look right so far?"

### 4. Persistence

Write the final output as a **PRD** to `docs/plans/YYYY-MM-DD-<topic>-design.md`. Structure:
- Goal, Audience, Scope (what we're NOT building), Core Requirements, Success Criteria, Edge Cases & Failure Modes

**Append to `.agent/decisions.log`**: For each significant design decision:
```
[YYYY-MM-DD] [Feature] — Decision: <what was chosen>. Rejected: <what was considered>. Because: <the reason>.
```

Update `PROJECT_HISTORY.md` to reflect the design phase.

### 5. Visual Validation (If Warmly UI Work)

Create a mockup as a static HTML prototype at `warmly/public/prototype_<feature>.html`. Confirm with the user BEFORE moving to planning.

**Next Step**: Once design is approved, use `/plan` to create an implementation plan.
