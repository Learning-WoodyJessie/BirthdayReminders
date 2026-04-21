# Ripple — Claude Code Skills

This file defines reusable skills for Claude Code in this project.
Invoke any skill by typing `/ripple-<skill>` in Claude Code.

---

## `/ripple-context`
**When to use:** Start of any new session. Loads full project context.

```
You are working on Ripple — an AI-powered celebration platform.

Read these files in order before doing anything:
1. docs/PROJECT_CHARTER.md  — vision, users, principles
2. docs/PRD.md              — full feature requirements by phase
3. CLAUDE.md                — architecture, modules, constraints

Current state:
- Phase 1 backend core is built (tools/, prompts/, router/, scripts/)
- Data store: YAML files (data/people.yaml)
- Delivery: Twilio WhatsApp
- AI: OpenAI GPT-4o
- Scheduler: GitHub Actions (7AM PST daily)
- Repo: github.com/Learning-WoodyJessie/BirthdayReminders

Architecture is modular — every feature lives in its own module under modules/.
Feature flags in core/config.py gate Phase 2 and 3 features.
Never break the tools/prompts/router separation.
```

---

## `/ripple-new-feature`
**When to use:** Adding any new feature. Ensures it follows module pattern.

```
Before implementing this feature, confirm:
1. Which phase does it belong to? (1 / 2 / 3)
2. Which module does it live in? (modules/<name>/)
3. Does it need a feature flag? (Phase 2+ = yes)
4. What are the acceptance criteria from PRD.md?
5. Does it touch core/models.py? (If yes, review dependencies first)

Module structure to follow:
  modules/<name>/
  ├── __init__.py      ← export public interface only
  ├── models.py        ← data models (if new)
  ├── service.py       ← business logic
  ├── repository.py    ← DB queries
  └── router.py        ← FastAPI routes

Frontend structure:
  frontend/app/<name>/
  ├── page.tsx
  ├── components/
  └── hooks/

Never import directly between modules — use core/models.py as the contract.
Always write the service.py before the router.py.
```

---

## `/ripple-debug`
**When to use:** Something is broken. Structured debugging.

```
Debug this issue systematically:

1. Identify which layer the error is in:
   - tools/     → delivery or calendar failure
   - prompts/   → AI generation failure
   - router/    → wrong routing decision
   - modules/   → business logic failure
   - api/       → endpoint failure
   - frontend/  → UI/data fetching failure

2. Check GitHub Actions logs if it's a scheduled job failure.

3. For WhatsApp errors: check Twilio console logs first.

4. For OpenAI errors: check API key, model name (gpt-4o), token limits.

5. For scheduling errors: check config.yaml reminder_days matches expectation.

Always fix the root cause. Never bypass with try/except that swallows errors.
```

---

## `/ripple-add-person`
**When to use:** Adding a new contact to data/people.yaml.

```
Add a new person to data/people.yaml following this schema:

- name: "Full Name"
  relationship: "<see router/message_router.py CLOSE_RELATIONSHIPS for close types>"
  birthday: "YYYY-MM-DD"     # use --MM-DD if year unknown
  anniversary: null           # or "YYYY-MM-DD"
  notes: "<hobbies, life events, shared memories — more = better AI messages>"
  phone: null                 # "+1XXXXXXXXXX" if available
  groups: []                  # WhatsApp group IDs for Phase 2

After adding, run: python scripts/list_upcoming.py
to verify the person appears correctly.
```

---

## `/ripple-phase2`
**When to use:** Starting Phase 2 development.

```
Phase 2 adds: milestone occasions, registry links, gift pools, freemium paywall.
Read docs/PRD.md sections P2.1 through P2.6 before starting.

Phase 2 setup steps:
1. Enable feature flags in core/config.py:
   FEATURE_MILESTONES = True
   FEATURE_REGISTRY   = True
   FEATURE_GIFTING    = True  (only after Stripe is configured)

2. New dependencies to add to requirements.txt:
   stripe>=7.0.0
   resend>=0.6.0

3. New GitHub Secrets needed:
   STRIPE_SECRET_KEY
   STRIPE_WEBHOOK_SECRET
   RESEND_API_KEY

4. Database migrations needed before coding:
   - occasions table (extended types)
   - registry table
   - gift_pools table
   - contributions table

Build order: occasions → registry → gifting → billing → notifications
Never build gifting before registry (registry is the simpler proof of concept).
```

---

## `/ripple-yc-pitch`
**When to use:** Preparing for investor conversations.

```
Ripple — one-line pitch:
"We're turning 'HBD!' into a moment — AI writes the perfect message,
friends contribute wishes, and milestones include coordinated gifting."

Problem: 4 billion birthdays/year. Best most people get is a generic text.
Solution: Solo mode (AI reminder + personalised message) + Group mode (collective wish, coordinated gift)
Market: $200B milestone gifting market. $50B greeting card market. Both broken.
Traction: [fill in current numbers]
Business model: Freemium ($6.99/mo Pro) + 2.5% gift pool fee
Team: [fill in]

Key differentiators:
1. Message quality — sounds like you, not a bot
2. Group coordination — replaces WhatsApp chaos
3. Modular — gifting only on milestones, never forced
4. Moat — relationship data + message history gets smarter over time

Comparable companies:
- Hallmark (offline, no AI, no coordination)
- Kudoboard (work only, no personal, no gifting)
- Zola (weddings only, no AI message)
Ripple is the first to combine AI message + group coordination + milestone gifting.
```

---

## `/ripple-status`
**When to use:** Quick status check at start of session.

```
Report the current status of Ripple:

1. Check git log --oneline -10 for recent changes
2. Check .github/workflows/daily_reminder.yml for current schedule
3. Check data/people.yaml for number of contacts
4. Check config.yaml for current reminder_days
5. Check if any TODO comments exist in tools/, prompts/, router/, modules/
6. Report what Phase 1 items from docs/PRD.md are complete vs pending

Format as a brief status table.
```
