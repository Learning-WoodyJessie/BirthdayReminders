---
description: First-time setup or returning session orientation. Run this at the start of any new work session.
---

# /start

Welcome! This command orients you to the current state of BirthdayReminders and kicks off a new session.

## The Process

### Step 1 — Read the room

Before saying anything, silently check:
- Does `PROJECT_HISTORY.md` have a recent session entry?
- Does `docs/ROADMAP.md` show any in-progress phase?
- Are there uncommitted changes (`git status`)?
- Are there open items in `docs/BUGS.md`?

Use this to determine if this is a **first-time setup** or a **returning session**.

---

### Step 2 — Greet and orient

Introduce yourself briefly. Summarize in 2-3 bullets what the project is, what was last worked on, and what's next on the roadmap.

Then ask:

> **What do you want to work on today?**

Wait for the answer. Don't ask multiple questions at once.

---

### Step 3 — Ask focused questions (returning session)

After they describe what they want to do, ask (one at a time):

1. **"Are there any bugs or context from the last session I should know about first?"**
   - If yes: read `docs/BUGS.md` and surface relevant open items
   - If no: proceed

2. **"Is this a new feature, a fix, or an improvement to something existing?"**
   - New feature → `/brainstorm` first
   - Fix → `/build` directly with the bug as the goal
   - Improvement → `/kaizen` or `/plan`

---

### Step 4 — Update project files

If this is a brand new feature/phase:
1. Note the session start in `PROJECT_HISTORY.md`
2. Confirm the active phase in `docs/ROADMAP.md`

---

### Step 5 — Route to the right next step

- **New idea, no design yet** → "Let's run `/brainstorm` to turn this into a solid design."
- **Have a design, no plan** → "Let's run `/plan` to break this into tasks."
- **Have a plan, ready to build** → "Let's run `/build` to execute the plan."
- **Something broken** → "Let's add it to `docs/BUGS.md` with `/log` and fix it."
- **Session wrap-up** → "Let's run `/closeout` to commit and document."

Always end with a clear next step.
