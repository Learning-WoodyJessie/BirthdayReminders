# Project History — BirthdayReminders

Running log of what was built, what was learned, and what was decided.
New entries go at the TOP. Each entry is a session or feature milestone.

---

## [2026-04-28] — SDLC Integration

### Accomplished
- Integrated `personal-sdlc-template` (Learning-WoodyJessie/personal-sdlc-template) into the project
- Created `.agent/workflows/` with 8 adapted workflow files: start, brainstorm, plan, build, audit, kaizen, log, closeout
- Created `skills/` with 5 reference guides: debugging, kaizen, test-driven-development, ui-development, writing-skills
- Created `.agent/gotchas.md` populated with all hard-won lessons from CLAUDE.md
- Created `.agent/decisions.log` with all major architectural decisions recorded
- Created `docs/BUGS.md` with active, resolved, and debt tracking tables
- Created `docs/plans/TEMPLATE.md` as the standard plan format
- Updated `CLAUDE.md` to reference the 7-step workflow and skills system

### Learned
- Workflow commands as slash commands make the development process explicit and repeatable
- Separating "decisions already made" (decisions.log) from "things that can go wrong" (gotchas.md) reduces cognitive load at the start of each session
- The `kaizen` feedback loop (improve the process as you build) compounds over time

### Deferred
- Approximate dates (2025-XX-XX) in decisions.log — fill from git history if needed (D-003 in BUGS.md)

---

## [2026-04] — Prompt Engineering Improvements

### Accomplished
- Added system/user message split to all LLM calls (messages.py, planning_agent.py, Warmly API routes)
- Added three few-shot examples to WISH_TEMPLATE and REMINDER_TEMPLATE
- Added chain-of-thought reasoning to WISH_TEMPLATE
- Added PLANNING_SYSTEM constant with one-shot CoT example to planning_agent.py
- Set temperature=0.8 for message generation, temperature=0.2 for planning agent
- LLMProvider ABC updated: `generate(prompt, system=None, temperature=0.8)` signature
- Fixed 3 test failures caused by messages[0] vs messages[1] index after system message was added

### Learned
- System/user split produces measurably better adherence — role context stays stable across calls
- Few-shot examples are the single highest-leverage prompt improvement for personal message quality
- Temperature tuning: creative tasks (0.8) vs structured output (0.2) are genuinely different needs
- Tests that check message content must be aware of message index after adding system messages

---

## [2026-04] — Warmly Web UI — Auth Removal & Simplification

### Accomplished
- Removed all Supabase auth from Warmly — app is now fully public (no login required)
- Stripped middleware.ts to pass-through
- Removed user_id from all queries and contacts table (ALTER TABLE people ALTER COLUMN user_id DROP NOT NULL)
- Made contacts read-only in Warmly UI — add-only, no edit/delete
- Removed sign out and settings from nav
- Fixed prerender errors on dashboard and contacts pages with `export const dynamic = 'force-dynamic'`

### Learned
- Supabase free tier magic link rate limit (≈3/hour) is a real obstacle during rapid development
- For a single-owner personal tool, auth adds friction without meaningful security benefit
- Phone OTP via Twilio requires a dedicated Twilio SMS number ($1/month) — not the sandbox
- Removing auth is a one-way door — document it clearly so it's not reconsidered without deliberate thought

### Deferred
- If the tool ever becomes multi-user, auth needs to come back before any sharing

---

## [2026-04] — Warmly Web UI — Compose Flow

### Accomplished
- Built `/compose/[personId]` page — full message compose UI with generate, tone, voice, send
- Added ✉️ Write buttons on dashboard event cards
- `GET /api/contacts/[id]` route for person lookup
- `POST /api/generate` route with improved prompt (system/user split, CoT, temperature)
- Voice recording via MediaRecorder API with MIME type fallback (ogg → mp4 → webm)
- Fire-and-forget write-back on Send and Skip actions

### Learned
- Pre-generate URLs before any async work (iOS Safari blocks window.open() after await)
- MediaRecorder MIME type order matters — audio/webm is rejected by WhatsApp
- Fire-and-forget fetch calls must never block the primary user action (WhatsApp open)

---

## [2026-04] — Gen Z Login Page Redesign

### Accomplished
- Full redesign of warmly/app/login/page.tsx with ambient gradient globs, feature pills, casual copy
- Fixed `bg-warmly-cream` → `bg-[#0A0A18]` in warmly/app/layout.tsx (was showing cream background)

### Learned
- Tailwind custom color classes (bg-warmly-cream) defined in the config can override global styles unexpectedly
- Check layout.tsx first when debugging full-page background color issues

---

## [2026-04] — Knowledge System Setup

### Accomplished
- Created `LEARNING.md` — personal concept journal for what clicked and where to apply next
- Created `SKILLS.md` — slash commands for repeatable operations + `/agentic-blueprint` as the 6-step framework for starting any agentic project
- Updated `CLAUDE.md` — added "Why this project exists" section with layer→concept table
- Full README rewrite — accurate system description, codebase map, 8-step setup, troubleshooting
- Wrote `docs/SUBSTACK_POST.md` — full TPM/AI engineer learning journey post with Layer 1 as narrative spine

### Learned
- Three documents serve three distinct audiences: CLAUDE.md (AI context), SKILLS.md (repeatable operations), LEARNING.md (personal growth)
- The `/agentic-blueprint` pattern (6 questions before any agentic project) is the most reusable artifact from this build

---

## [Earlier] — Core System Build

### Accomplished
- `tools/calendar.py` — parse_date, days_until (with year-boundary wrap), age_str, find_upcoming
- `tools/whatsapp.py` — send_whatsapp via Twilio
- `tools/warmly.py` — create_warmly_link (Supabase insert + return /send/{token} URL)
- `tools/memory.py` — load_sent_log, already_sent_this_year, append_sent_log (idempotent), sync_sent_log_from_supabase, append_run_log
- `tools/preferences.py` — get_person_preferences, build_preferences_section (injects history into prompts)
- `tools/health.py` — days_since_last_sent, get_relationship_health, health_summary_text
- `prompts/messages.py` — REMINDER_TEMPLATE, WISH_TEMPLATE, generate_message()
- `prompts/llm.py` — LLMProvider ABC, OpenAIProvider, AnthropicProvider, get_provider() factory
- `router/message_router.py` — route() with message_type, tone, label, should_send, channel, urgency
- `router/planning_agent.py` — check_for_special_circumstances() with fast path (notes < 50 chars)
- `scripts/check_reminders.py` — full orchestrator: sync → find → route → plan → generate → send → log
- `scripts/add_person.py`, `scripts/list_upcoming.py`, `scripts/status.py` — CLI utilities
- `.github/workflows/daily_reminder.yml` — GitHub Actions cron at 7AM PST + failure WhatsApp alert
- Warmly: `/send/[token]` edit/tone/send page, mark-sent, skip, regenerate, send-voice API routes
- 138 tests, all mocked, covering all tools/router/prompts/planning_agent modules

### Key Architecture Decisions
- Rule-based router for enumerable decisions; LLM planning agent only for open-ended judgment
- YAML files as data store — no backend DB for Python layer
- Four memory types: working (in-RAM), episodic (sent_log, run_log), semantic (people.yaml), procedural (code)
- Warmly as human-in-the-loop layer — owner reviews every message before send
- Feedback loop: Warmly write-back → Supabase → daily sync → sent_log → deduplication + prompt history

---

## Project Goal

Build a personal automated birthday and anniversary reminder system as a deliberate learning project — not to ship a product, but to make agentic AI concepts concrete through building.

## Target Audience

Single owner (Pavani). Personal use only. The reminder system runs autonomously; Warmly is the companion UI for reviewing and sending messages.

## Agentic Concepts Studied

| Layer | Concept |
|---|---|
| `tools/` | Tool use and single-responsibility design |
| `prompts/` | Prompt as product, LLM provider abstraction |
| `router/` | Rule-based routing vs. LLM planning agents |
| `data/` + Supabase | Four memory types |
| Warmly write-back | Feedback loops |
| Planning agent | When rules aren't enough |
