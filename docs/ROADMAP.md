# BirthdayReminders — History & Roadmap

How the system grew from a simple reminder script into a personalised agentic application, and where it goes next.

---

## Phase 0 — The Problem

People forget to message friends and family on their birthdays — not because they don't care, but because life is busy and dates slip through the cracks.

The goal: a personal system that handles the remembering, writes a warm first draft, and lets the owner put their own human touch on it before sending. Not a product. A tool for one person, built to fit their life.

---

## Phase 1 — The Core Engine

**What was built:**
- `data/people.yaml` — contacts: birthdays, anniversaries, notes, phones
- `tools/calendar.py` — date parsing; `days_until()` with year-boundary wrap
- `tools/whatsapp.py` — Twilio WhatsApp sandbox delivery
- `prompts/messages.py` — two GPT-4o templates: `reminder` (3 days before) and `wish` (day-of)
- `router/message_router.py` — rule-based: close relationships → warm tone, others → professional
- `scripts/check_reminders.py` — thin orchestrator
- `.github/workflows/daily_reminder.yml` — GitHub Actions cron, 7AM PST, free forever
- 43 tests

**Decision: YAML not a database**
All contacts live in a version-controlled YAML file. Zero infrastructure. Zero uptime. Readable in any text editor. The right tradeoff for a personal tool.

**Decision: two-template split**
`reminder` (3 days out) = heads-up + draft to prepare. `wish` (day-of) = ready to send RIGHT NOW. These serve different mental states — don't collapse them into one.

**Lesson: Twilio WhatsApp Sandbox**
The sandbox only delivers to numbers that have texted JOIN. Audio fails with error 63021. Text and images only.

---

## Phase 2 — Warmly: The Human Edit Layer

The engine sent great drafts — but they needed a human touch before hitting Send. The missing piece: a frictionless way to edit, personalise, and send from a phone.

**What was built:**
- `warmly/` — Next.js 14 app on Vercel; dark premium UI (#0A0A18, orange→pink gradient)
- `/send/[token]` — edit message, adjust tone (Funnier / Warmer / Shorter), add personal context
- `/api/regenerate` — GPT-4o rewrites with tone + context on demand
- `/api/generate-image` — DALL-E 3 celebration images (built, later removed from main UI)
- Voice note recording — MediaRecorder API; upload to Supabase Storage; send as tap-to-play link via WhatsApp
- Supabase — `reminders` table stores the draft; unique token in URL is the key
- Daily digest includes a Warmly link per event

**Decision: stateless URL (token lookup)**
No sessions. No auth. The token in the URL IS the identity. Tap the link in WhatsApp → page loads the specific reminder. Simple, mobile-native.

**Lessons learned (the hard way):**

*iOS Safari popup blocking* — `window.open()` after `await` is silently blocked. Solution: pre-generate the filename and URL before any async, open WhatsApp synchronously on the direct user tap, upload in background.

*Twilio sandbox + audio* — Tried to send voice notes via Twilio MediaUrl. Failed with error 63021 — audio not supported in sandbox. Pivoted: upload to Supabase Storage, share as a tap-to-listen link in the wa.me text. Same UX, different mechanism.

*Supabase Storage RLS* — Marking a bucket "public" in the dashboard is not enough. Requires an explicit SQL RLS policy. Without it, "public" URLs return 403.

*VERCEL_URL vs production URL* — `VERCEL_URL` points to a deployment-specific subdomain protected by Standard Protection. External links must use `NEXT_PUBLIC_WARMLY_URL` — the production URL that's always accessible.

*audio/webm rejected by WhatsApp* — WhatsApp only accepts `audio/ogg` (Opus) and `audio/mp4`. MediaRecorder preference order: `audio/ogg;codecs=opus` → `audio/mp4` → `audio/webm` as fallback.

---

## Phase 3 — Agentic Architecture (Sprints 1 + 2)

The system worked. Time to make it smarter — teach it to learn from what happens and stop repeating itself.

**Insight from this phase:** "Agentic" doesn't just mean "uses an LLM". It means: Tools + Memory + Prompts + Router + Feedback loops + Human control + Graceful degradation. All seven need to be present for a system to genuinely improve over time.

**Sprint 1 — Core agentic layer**
- `prompts/llm.py` — abstract `LLMProvider` base class; `OpenAIProvider` and `AnthropicProvider`; `get_provider(config)` factory. Swap GPT for Claude with one line in `config.yaml`.
- `tools/memory.py` — `load_sent_log()`, `already_sent_this_year()`. The router now knows if a message was already sent this year.
- Router upgraded — `should_send`, `channel`, `urgency` added to every routing decision
- 84 tests

**Sprint 2 — Feedback loop**
The system had no idea what happened after the digest was sent. Was the message sent? Was it edited? What tone was chosen?

- `/api/mark-sent` — Warmly fires a write-back to Supabase on "Send". Records `whatsapp_sent`, `sent_at`, `message_sent`, `context_added`, `tone_selected`.
- `sync_sent_log_from_supabase()` — orchestrator syncs these records into `sent_log.yaml` at the top of every daily run. The router now knows what was *actually sent*, not just what was generated.
- `run_log.yaml` — structured record of every run: events found, skipped, sent, digest delivered.

**What changed conceptually:**
Before Sprint 2: one-way flow. Generate → send.
After Sprint 2: a loop. Generate → send → write-back → sync → inform next generation.
That loop is what makes a system agentic rather than just automated.

---

## Phase 4 — Learning from Behaviour (Sprints 3 + 4)

With the feedback loop in place, the system could start learning.

**Sprint 3 — Preferences + Skip**
- `tools/preferences.py` — reads `sent_log.yaml`, derives facts about the owner's style: which tones they reach for, what kinds of personal context they add. `build_preferences_section()` formats this as a prompt block.
- Templates updated — both templates now have a `{preferences_section}` slot. When history exists, GPT-4o sees it before writing. Messages get progressively more personalised without any manual configuration.
- Skip button in Warmly — quiet ghost CTA at the bottom. Marks `skipped=true` in Supabase. The next sync treats skipped the same as sent — no duplicate reminder.
- 21 new tests (105 total)

**Sprint 4 — Health, Planning Agent, Alerts**
- `tools/health.py` — "when did we last reach out?" Four tiers: `never` / `overdue` (>1yr) / `ok` / `recent` (<30d). Sorted by urgency. Shown in `status.py`.
- `router/planning_agent.py` — the first genuine LLM-based decision in the system. When notes are substantial, the planning agent asks: "Does anything here need special handling?" Returns `urgency=sensitive` (send but adjust tone) or `urgency=skip` (don't send — grief, estrangement). The orchestrator respects these as recommendations, not hard rules.
- `scripts/status.py` — CLI dashboard: contacts, upcoming events, sent log, last run, LLM config, relationship health. `--full` for a per-person table.
- Failure alerts — if GitHub Actions fails, a WhatsApp alert arrives immediately. No silent failures.
- 33 new tests (138 total)

**What changed conceptually:**
The system now has four layers of intelligence:
1. **Rules** (router) — fast, cheap, covers 95% of cases
2. **History** (preferences) — learns from past sends without being told
3. **LLM judgment** (planning agent) — handles edge cases rules can't
4. **Human control** (skip, Warmly edit) — the owner always has the final word

---

## Current State (Phase 4 complete)

**138 tests, all passing. 4 sprints shipped.**

```
Daily flow — GitHub Actions 7AM PST:
  sync Supabase (sent + skipped) → sent_log.yaml
  find upcoming events (3-day + day-of)
  route: message_type · tone · should_send · channel · urgency
  planning agent: does this person's situation need special handling?
  preferences: what has the owner sent to this person before?
  generate message (GPT-4o, with history in prompt)
  store in Supabase → Warmly link
  send WhatsApp digest
  write run_log.yaml entry
  on failure → WhatsApp alert

Warmly — when the owner taps the link:
  edit message · adjust tone · add context · regenerate
  send as text → write-back to Supabase
  OR: record voice note → upload + share tap-to-play link
  OR: skip → mark skipped in Supabase
```

**What the system knows how to do:**
- Not repeat itself (sent_log deduplication)
- Match the owner's preferred tone for each person (preferences)
- Reference inside jokes and memories they've added before (context injection)
- Tread carefully when someone is going through something hard (planning agent)
- Surface relationships going cold (health tracking)
- Alert on failures (WhatsApp notification)

---

## What Comes Next

### Near-term (incremental improvements)

**Store relationship in sent_log**
Preferences are currently aggregated across all contacts. Storing the relationship type per entry enables per-category tone preferences: "warmer for family, funnier for close friends, shorter for colleagues".

**Warmly dashboard page**
A lightweight `/dashboard` route: recent sends, upcoming events, relationship health. Already reads from Supabase — just needs a UI.

**Richer notes in `people.yaml`**
The system is only as good as the data. Adding richer notes (memories, interests, life events) improves every generated message.

**Twilio production upgrade**
Upgrade from sandbox to WhatsApp Business API (production Twilio + Meta approval). Unlocks: native audio delivery, sending to anyone, image attachments in digest. See `SKILLS.md` → `/br-upgrade-twilio`.

### Medium-term (new capabilities)

**Multi-occasion awareness**
Currently birthday and anniversary are treated independently. Awareness of both enables smarter timing — don't send two separate messages in the same week for the same person.

**Group messages**
The `groups: []` field in `people.yaml` is reserved for this. Send one crafted message to a group (team birthdays, family group chat) instead of individual sends.

**Preferences per relationship category**
Once relationship is stored in `sent_log`, derive rules automatically: "for family, preferred tone is warmer; for colleagues, preferred tone is shorter". Feed into routing and prompts.

### Longer-term (architectural evolution)

**Multi-channel delivery**
Email, Telegram, iMessage as alternative delivery channels. Abstract `send_whatsapp()` behind a `send_message(channel)` interface. Channel chosen per person from `people.yaml`.

**Relationship health as a prompt input**
Currently health tracking is diagnostic (CLI only). Feed `days_since_last_sent` into the prompt so GPT-4o knows: "you haven't been in touch for 8 months — acknowledge the gap warmly."

**Planning agent evolution**
Today the agent answers: "Does anything in these notes need special handling?" A more capable version reads the last few messages sent (from `sent_log`) and suggests a genuinely new angle rather than repeating past themes.

**Skip as a preference signal**
Skipping a reminder is information. A pattern of skips for a particular relationship type is a health signal: "You've skipped this person's birthday 2 years in a row — is this relationship drifting?"
