# BirthdayReminders — AI Context

Personal automated birthday and anniversary reminder system.
Runs daily via GitHub Actions at 7AM PST. Reads contacts from `data/people.yaml`,
generates personalised messages via GPT-4o, and sends a WhatsApp digest via Twilio.
**Warmly** is the companion web UI (Next.js on Vercel) for editing and sending.

See `docs/ROADMAP.md` for project history and what comes next.

---

## Why this project exists

Built as a deliberate learning project — not to ship a product, but to make agentic AI
concepts concrete through building. Each architectural layer maps to a concept:

| Layer | Concept being learned |
|---|---|
| `tools/` | Tool use and single-responsibility design |
| `prompts/` | Prompt as product, LLM provider abstraction |
| `router/` | Rule-based routing vs. LLM planning agents |
| `data/` + Supabase | Four memory types (semantic, episodic, working, procedural) |
| Warmly write-back | Feedback loops — how systems improve with use |
| Planning agent | When rules aren't enough — open-ended judgment |

**Architectural decisions were intentional learning choices, not just engineering decisions.**
When reading code or suggesting changes, understand that the folder structure, the router/agent
split, and the feedback loop design exist because they were the concepts under study —
not because they were the simplest path to a working system.

## Knowledge system

This project uses four documents with distinct jobs:

| Document | Audience | Purpose |
|---|---|---|
| `CLAUDE.md` (this file) | Claude Code | Project context — architecture, constraints, lessons, what not to touch |
| `SKILLS.md` | Owner + Claude | Slash commands for repeatable operations; `/agentic-blueprint` for new projects |
| `LEARNING.md` | Owner | Personal concept journal — what clicked, where to apply next |
| `/agentic-blueprint` skill | Owner | 6-step framework for starting any new agentic project |

---

---

## Architecture

```
tools/
  calendar.py         ← parse_date, days_until, age_str, find_upcoming
  whatsapp.py         ← send_whatsapp (Twilio)
  warmly.py           ← create_warmly_link (Supabase insert + return edit URL)
  memory.py           ← load_sent_log, already_sent_this_year, append_sent_log,
                         sync_sent_log_from_supabase (pulls sent+skipped),
                         append_run_log
  preferences.py      ← get_person_preferences, get_overall_preferences,
                         build_preferences_section → injects history into prompts
  health.py           ← days_since_last_sent, get_relationship_health,
                         health_summary_text (never / overdue / ok / recent)

prompts/
  messages.py         ← REMINDER_TEMPLATE, WISH_TEMPLATE, generate_message()
  llm.py              ← LLMProvider (ABC), OpenAIProvider, AnthropicProvider,
                         get_provider(config) factory

router/
  message_router.py   ← route() → message_type, tone, label,
                         should_send, channel, urgency
  planning_agent.py   ← check_for_special_circumstances() — LLM reads person
                         notes; returns needs_adjustment, reason, instruction,
                         urgency (normal / sensitive / skip)
                         Fast path: notes < 50 chars → no LLM call

data/
  people.yaml         ← contacts (source of truth)
  sent_log.yaml       ← episodic: (person, occasion, year) pairs already messaged
  run_log.yaml        ← episodic: structured record of every daily run

config.yaml           ← reminder_days, llm.provider, llm.model

scripts/
  check_reminders.py  ← orchestrator: sync → find → route → plan → generate → send → log
  add_person.py       ← interactive CLI to add a contact
  list_upcoming.py    ← preview upcoming events (no messages sent)
  status.py           ← CLI dashboard (contacts, upcoming, health, last run)

tests/                ← 138 tests, all mocked (no API calls, no cost)
  test_calendar.py       20 tests
  test_router.py         23 tests
  test_prompts.py         8 tests
  test_llm.py            13 tests
  test_memory.py         20 tests
  test_preferences.py    21 tests
  test_health.py         16 tests
  test_planning_agent.py 17 tests

warmly/               ← Next.js 14, Vercel, dark UI (#0A0A18)
  app/send/[token]/page.tsx          ← edit · tone · context · send · skip
  app/api/regenerate/route.ts        ← POST: GPT-4o tone rewrite
  app/api/mark-sent/route.ts         ← POST: write-back on send (feedback loop)
  app/api/skip/route.ts              ← POST: mark skipped → suppresses future reminder
  app/api/send-voice/route.ts        ← POST: upload voice blob to Supabase Storage
  app/api/audio/[filename]/route.ts  ← GET: proxy audio from Supabase (always public)
  app/api/generate-image/route.ts    ← POST: DALL-E 3 celebration image (available, not in main UI)

.github/workflows/
  daily_reminder.yml  ← cron 15:00 UTC (7AM PST) + failure alert via WhatsApp
```

---

## Full message flow

```
GitHub Actions (7AM PST)
  → check_reminders.py
      → sync_sent_log_from_supabase()   merge whatsapp_sent=true + skipped=true rows
      → load_sent_log()                 in-memory dedup list
      → get_provider(config)            OpenAI or Anthropic per config.yaml
      → find_upcoming()                 events in reminder_days window [3, 0]
      → route()                         message_type · tone · should_send · channel · urgency
      → skip if should_send=False       already sent this year
      → check_for_special_circumstances()  planning agent: read notes → adjustment / skip
      → skip if urgency=skip            planning agent says don't send
      → build_preferences_section()     inject past tone + context from sent_log
      → generate_message()              LLM call with history in prompt
      → create_warmly_link()            insert into Supabase, return /send/{token} URL
      → send_whatsapp()                 Twilio digest → owner's WhatsApp
      → append_run_log()                write to data/run_log.yaml
  [on any failure] → WhatsApp alert via Twilio

Owner taps Warmly link → /send/[token]
  → Supabase lookup by token → load message, person, phone
  → edit · regenerate with tone · add personal context
  → "Send as text 💬"
      → window.open(wa.me)              pre-fill WhatsApp (synchronous, iOS-safe)
      → POST /api/mark-sent [bg]        write whatsapp_sent, message_sent, context_added, tone_selected
  → "Send voice note 🎤"
      → pre-generate filename + URL     know the link before any upload
      → window.open(wa.me)              share tap-to-play link (synchronous)
      → POST /api/send-voice [bg]       upload audio to Supabase Storage
  → "Skip this reminder"
      → POST /api/skip [bg]             mark skipped=true, skipped_at
      → confirmation screen             "Won't remind you again this year"

Next daily run:
  → sync picks up whatsapp_sent=true AND skipped=true rows
  → already_sent_this_year=True → skips duplicate
```

---

## Routing decisions

### Message types
| days_away | message_type | what it contains |
|---|---|---|
| 3 | `reminder` | Heads-up + draft to prepare |
| 0 | `wish` | Ready-to-send message |

### Tone
| relationship | tone |
|---|---|
| mother, father, sister, brother, best friend, partner, spouse, husband, wife, daughter, son, grandmother, grandfather | warm and personal |
| everything else | friendly and professional |

### route() output
| field | values | meaning |
|---|---|---|
| `message_type` | reminder / wish | which template |
| `tone` | warm and personal / friendly and professional | LLM instruction |
| `label` | "🎂 Sush's birthday — TODAY 🎉" | digest header |
| `should_send` | True / False | False = already sent this year |
| `channel` | warmly / digest_only | warmly if phone number present |
| `urgency` | high / normal | high if days_away == 0 |

### Planning agent output
| field | values | meaning |
|---|---|---|
| `needs_adjustment` | True / False | False = use standard flow |
| `reason` | string | why adjustment is needed |
| `instruction` | string / None | injected into notes for generate_message |
| `urgency` | normal / sensitive / skip | skip = don't send at all |

---

## Data schemas

### `data/people.yaml`
```yaml
- name: string (required)
  relationship: string (required)
  birthday: YYYY-MM-DD or --MM-DD if year unknown (required)
  anniversary: YYYY-MM-DD (optional, null if none)
  notes: free text — more = better personalisation
  phone: E.164 e.g. +14155550001 (optional)
  groups: []
```

### `data/sent_log.yaml`
```yaml
- person_name: Alice
  occasion: birthday
  year: 2026
  sent_at: "2026-04-05T09:14:22"    # optional, from Supabase sync
  context_added: "We stayed up all night before finals"
  tone_selected: "warmer and more heartfelt"
```

### `data/run_log.yaml`
```yaml
- run_date: "2026-04-21"
  events_found: 2
  events_skipped: 1
  events_sent: 1
  synced_from_supabase: 1
  digest_sent: true
  logged_at: "2026-04-21T15:02:11"
```

---

## LLM provider

Swap provider with one line in `config.yaml`:

```yaml
llm:
  provider: openai       # or: anthropic
  model: gpt-4o          # or: claude-opus-4-5
```

`generate_message()` accepts `provider: LLMProvider = None`. If None, falls back to
`OpenAIProvider()` — backward compatible with all existing tests.

---

## Agentic architecture (how the pillars map here)

| Pillar | Implementation |
|---|---|
| **Tools** | calendar, whatsapp, warmly, memory, preferences, health |
| **Memory** | `people.yaml` (semantic) · `sent_log.yaml` (episodic) · `run_log.yaml` (episodic) |
| **Prompts** | Two templates + tone routing + preferences injection + LLM abstraction |
| **Router** | Rule-based: message_type, tone, should_send, channel, urgency |
| **Planning agent** | LLM judgment for edge cases rules can't handle (notes analysis) |
| **Feedback loop** | Warmly write-back → Supabase → daily sync → sent_log → skip duplicates + inform prompts |
| **Human control** | Owner edits every message before send · Skip button |
| **Observability** | run_log.yaml · failure WhatsApp alert · `scripts/status.py` |

**Rule-based router vs planning agent — when to use each:**
- Router: decision space is finite; rules can be written down; wrong decisions are low-stakes
- Planning agent: open-ended judgment needed (read notes, infer emotional state, weigh options)

**Four memory types:**
- Working: in-RAM during a run (`sent_log` list, current `message` string)
- Episodic: timestamped events (`sent_log.yaml`, `run_log.yaml`)
- Semantic: timeless facts (`people.yaml`)
- Procedural: how to do things (the code in `tools/`, `prompts/`, `router/`)

---

## Secrets

### GitHub Actions (repository secrets only — NOT environment secrets)
| Secret | Description |
|---|---|
| `OPENAI_API_KEY` | OpenAI API key |
| `TWILIO_ACCOUNT_SID` | Twilio Account SID |
| `TWILIO_AUTH_TOKEN` | Twilio Auth Token |
| `TWILIO_FROM` | e.g. `whatsapp:+14155238886` |
| `MY_WHATSAPP_NO` | Owner's number (E.164) |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Supabase service role key |
| `WARMLY_BASE_URL` | e.g. `https://birthday-reminders-pi.vercel.app` |

⚠️ Environment secrets are NOT picked up unless `environment:` is set in the workflow YAML.

### Vercel env vars
| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL (client-safe) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (client-safe) |
| `SUPABASE_SERVICE_KEY` | Service role key (server-only) |
| `OPENAI_API_KEY` | OpenAI key |
| `TWILIO_ACCOUNT_SID` | Twilio SID |
| `TWILIO_AUTH_TOKEN` | Twilio token |
| `TWILIO_FROM` | WhatsApp sender (with `whatsapp:` prefix) |
| `MY_WHATSAPP` | Owner's number (E.164) |
| `NEXT_PUBLIC_WARMLY_URL` | `https://birthday-reminders-pi.vercel.app` ← never use VERCEL_URL |

---

## Supabase setup

### `reminders` table (complete schema)
```sql
-- Core columns created at setup
token, person_name, relationship, occasion, notes, message, phone, created_at

-- Feature columns — run this migration if needed
ALTER TABLE reminders
  ADD COLUMN IF NOT EXISTS whatsapp_sent  boolean default false,
  ADD COLUMN IF NOT EXISTS sent_at        timestamptz,
  ADD COLUMN IF NOT EXISTS message_sent   text,
  ADD COLUMN IF NOT EXISTS context_added  text,
  ADD COLUMN IF NOT EXISTS tone_selected  text,
  ADD COLUMN IF NOT EXISTS skipped        boolean default false,
  ADD COLUMN IF NOT EXISTS skipped_at     timestamptz;

-- RLS: allow public read (token = access control)
CREATE POLICY "Public read reminders" ON reminders FOR SELECT USING (true);
```

### Storage
```sql
-- Bucket: voice-notes (mark public in dashboard, then add policy)
CREATE POLICY "Public read voice-notes" ON storage.objects
  FOR SELECT USING (bucket_id = 'voice-notes');
```

### Vercel deployment protection
- Use **Standard Protection** — preview protected, production public
- Never use `VERCEL_URL` for external links — use `NEXT_PUBLIC_WARMLY_URL`

---

## Running the project

```bash
# Tests (must pass before every push)
python -m pytest tests/ -v                   # 138 tests

# Local run (requires env vars)
python scripts/check_reminders.py

# Preview upcoming events (no messages sent)
python scripts/list_upcoming.py              # 30 days
python scripts/list_upcoming.py 90           # 90 days

# System health check
python scripts/status.py
python scripts/status.py --full              # per-person health table

# Warmly local build check (always before push)
cd warmly && node_modules/.bin/next build
```

---

## Hard-won lessons

### WhatsApp / iOS Safari
- `wa.me/?text=...` = text only — no attachments of any kind
- `window.open()` after `await` is silently blocked by iOS Safari — must fire on direct user tap
- Pattern: pre-generate filename + URL before any async → open WhatsApp synchronously → upload in background

### Twilio WhatsApp Sandbox
- Sandbox supports text + images only; audio fails with **error 63021**
- Audio workaround: upload to Supabase Storage, share tap-to-play link in the wa.me text
- Native audio needs WhatsApp Business API (production Twilio + Meta approval)

### Audio recording (MediaRecorder API)
- MIME preference order: `audio/ogg;codecs=opus` → `audio/mp4` → `audio/webm`
- `audio/webm` rejected by WhatsApp; ogg + mp4 are accepted
- iOS Safari only supports mp4 — falls back automatically with the order above
- Always `mr.start(100)` (100ms timeslice); always catch `getUserMedia` denied explicitly

### Supabase Storage
- "Public" bucket in dashboard is not enough — requires an explicit SQL RLS policy
- Without it, `getPublicUrl()` returns a URL that gives 403
- Proxy audio through `/api/audio/[filename]` using the service key — always public
- Use `upsert: true` when the client pre-generates the filename before uploading

### Vercel
- `VERCEL_URL` = deployment-specific subdomain, protected by Standard Protection
- Use `NEXT_PUBLIC_WARMLY_URL` for every external link
- Build from `warmly/` directory: `cd warmly && node_modules/.bin/next build`
- TypeScript errors fail Vercel deploy silently — always build locally first
- `git add warmly/app/send/[token]/page.tsx` fails in zsh (glob) — use `git add warmly/`

### Secrets
- GitHub Actions: repository secrets only, NOT environment secrets
- Symptom of env secrets: shows in UI but arrives empty in workflow
- Vercel: Twilio creds must be in Vercel too — server routes call Twilio directly

### Feedback loop
- Write back on the user action (tap), not on load or a timer
- Fire-and-forget (`fetch().catch()`) — never block WhatsApp open on a write-back
- `append_sent_log()` is idempotent — safe to sync repeatedly
- Skipped = treated identically to sent for deduplication

### Planning agent
- Only invoke when notes > 50 chars — short notes = fast path, no LLM cost
- Use structured `KEY: value` output format — easy to parse reliably
- Always have a `_no_adjustment()` fallback — errors must degrade gracefully
- Inject instruction into `person["notes"]` — generate_message() sees it without a new param
- Agent recommends; orchestrator decides — `urgency=skip` is honoured, not enforced

---

## Key constraints
- **No backend database** — YAML files only for the Python layer
- **Secrets never in code** — GitHub Secrets + Vercel env vars only
- **LLM**: configured in `config.yaml`; default `gpt-4o` via OpenAI
- **Delivery**: Twilio WhatsApp sandbox — owner's number must JOIN sandbox first
- **138 tests must pass** before every push

## What NOT to change without thought
- `days_until` year-boundary wrap in `calendar.py` — handles Dec 31 → Jan 1
- Two-template split in `messages.py` — reminder vs wish serve different mental states
- `CLOSE_RELATIONSHIPS` set in `message_router.py` — add relationships here, don't inline
- `reminder_days: [3, 0]` in `config.yaml` — advance + day-of only, by design
- `NEXT_PUBLIC_WARMLY_URL` in Vercel — must be production URL, not deployment URL
- `append_sent_log()` idempotency check — remove this and Supabase syncs create duplicates
- `window.open()` in Warmly — synchronous on user tap, never after `await`
