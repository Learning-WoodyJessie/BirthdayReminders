# BirthdayReminders — AI Context

## What this project does
Personal automated birthday and anniversary reminder system.
Runs daily via GitHub Actions at 7AM PST.
Reads contacts from `data/people.yaml`, finds upcoming events, generates
personalised messages via OpenAI GPT-4o, and sends a WhatsApp digest via Twilio.
Includes **Warmly** — a web UI (Next.js on Vercel) for editing and sending messages.

---

## Architecture

```
tools/
  calendar.py         ← parse_date, days_until, age_str, find_upcoming
  whatsapp.py         ← send_whatsapp (Twilio)
  warmly.py           ← create_warmly_link (Supabase insert + return edit URL)
  memory.py           ← load_sent_log, already_sent_this_year, append_sent_log,
                         sync_sent_log_from_supabase (pulls sent+skipped rows),
                         append_run_log
  preferences.py      ← get_person_preferences, get_overall_preferences,
                         build_preferences_section (injects history into prompts)
  health.py           ← days_since_last_sent, get_relationship_health,
                         health_summary_text (never/overdue/ok/recent)

prompts/
  messages.py         ← REMINDER_TEMPLATE, WISH_TEMPLATE, generate_message()
                         (accepts preferences_section arg)
  llm.py              ← LLMProvider (ABC), OpenAIProvider, AnthropicProvider,
                         get_provider(config) factory

router/
  message_router.py   ← route() — message_type, tone, label,
                         should_send, channel, urgency
  planning_agent.py   ← check_for_special_circumstances() — LLM reads notes,
                         returns needs_adjustment, reason, instruction, urgency
                         (fast path if notes < 50 chars; graceful fallback on error)

data/                 ← resource layer (source of truth)
  people.yaml         ← all contacts + dates
  sent_log.yaml       ← which (person, occasion) pairs have been sent this year
  run_log.yaml        ← structured history of every daily run

config.yaml           ← reminder_days, llm provider + model

scripts/
  check_reminders.py  ← thin orchestrator:
                         sync → load → find → route → plan → generate → store → send → log
  add_person.py       ← interactive CLI to add contacts
  list_upcoming.py    ← preview upcoming events (no messages sent)
  status.py           ← CLI dashboard: contacts, upcoming, sent log, run log,
                         LLM config, relationship health (--full for table)

tests/
  test_calendar.py       ← 20 tests
  test_router.py         ← 23 tests (incl. should_send, channel, urgency)
  test_prompts.py        ← 8 tests (OpenAI mocked)
  test_llm.py            ← 13 tests for LLM provider abstraction
  test_memory.py         ← 20 tests for memory tools
  test_preferences.py    ← 21 tests for preferences derivation
  test_health.py         ← 16 tests for relationship health tracking
  test_planning_agent.py ← 17 tests for planning agent (LLM mocked)

warmly/               ← Next.js web app (deployed on Vercel)
  app/
    send/[token]/page.tsx          ← main UI: edit message, tone, voice note, send, skip
    api/regenerate/route.ts        ← POST: rewrite message with tone via GPT-4o
    api/mark-sent/route.ts         ← POST: write-back on send (feedback loop)
    api/skip/route.ts              ← POST: marks reminder skipped (suppresses future)
    api/generate-image/route.ts    ← POST: generate celebration image via DALL-E 3
    api/send-voice/route.ts        ← POST: upload voice blob to Supabase Storage
    api/audio/[filename]/route.ts  ← GET: proxy audio files (publicly accessible)

.github/workflows/
  daily_reminder.yml  ← cron: 7AM PST (15:00 UTC) daily
                         + "Notify on failure" step → WhatsApp alert via Twilio
```

---

## Full message flow

```
GitHub Actions (7AM PST)
  → check_reminders.py
      → sync_sent_log_from_supabase()   pulls whatsapp_sent=true + skipped=true rows
      → load_sent_log()                 in-memory list for duplicate checks
      → get_provider(config)            OpenAI or Anthropic per config.yaml
      → find_upcoming()                 finds events in [3, 0] days
      → route()                         decides message_type, tone, should_send,
                                        channel, urgency
      → [skip if should_send=False]     already sent this year
      → check_for_special_circumstances() planning agent reads notes, returns
                                        adjustment instruction or urgency=skip
      → [skip if urgency=skip]          planning agent says don't send
      → build_preferences_section()     inject past tone + context from sent_log
      → generate_message()              calls LLM with preferences in prompt
      → create_warmly_link()            stores in Supabase, returns edit URL
      → send_whatsapp()                 Twilio digest to owner
      → append_run_log()                writes to data/run_log.yaml
  → [on failure] Notify on failure      WhatsApp alert via Twilio

Owner taps Warmly link → warmly/app/send/[token]/page.tsx
  → loads reminder from Supabase by token
  → owner edits message, adjusts tone (GPT-4o), adds personal context
  → "Send as text 💬"
      → window.open(wa.me link)         pre-fills WhatsApp
      → POST /api/mark-sent             writes whatsapp_sent, sent_at,
                                        message_sent, context_added, tone_selected
  → OR: records voice note
      → pre-generates filename          knows URL before upload
      → window.open(wa.me link)         opens WhatsApp synchronously (iOS safe)
      → POST /api/send-voice            uploads audio in background
  → OR: "Skip this reminder"
      → POST /api/skip                  marks skipped=true, skipped_at in Supabase
      → shows confirmation screen       "Won't remind you again this year"

Next run of check_reminders.py:
  → sync_sent_log_from_supabase() picks up whatsapp_sent=true AND skipped=true rows
  → router sees already_sent_this_year=True → skips duplicate
```

---

## Message types

| days_away | message_type | content |
|---|---|---|
| 3 | `reminder` | Heads-up + draft message to prepare and send |
| 0 | `wish` | Ready-to-copy-paste birthday/anniversary message |

## Router output fields

| field | values | meaning |
|---|---|---|
| `message_type` | reminder / wish | which template to use |
| `tone` | warm and personal / friendly and professional | GPT-4o instruction |
| `label` | e.g. "🎂 Sush's birthday is TODAY" | WhatsApp digest header |
| `should_send` | True / False | False if already sent this year |
| `channel` | warmly / digest_only | warmly if person has a phone number |
| `urgency` | high / normal | high if days_away == 0 |

## Tone routing

| relationship | tone |
|---|---|
| mother, father, sister, brother, best friend, partner, spouse, husband, wife, daughter, son, grandmother, grandfather | warm and personal |
| everything else | friendly and professional |

---

## Data schema (`data/people.yaml`)

```yaml
- name: string (required)
  relationship: string (required)
  birthday: YYYY-MM-DD or --MM-DD if year unknown (required)
  anniversary: YYYY-MM-DD (optional, null if none)
  notes: string — used by GPT-4o to personalise messages (more = better)
  phone: E.164 e.g. +14155550001 (optional)
  groups: []  (reserved for future group posting)
```

---

## LLM provider abstraction (`prompts/llm.py`)

Swap the underlying model without touching any other code:

```yaml
# config.yaml
llm:
  provider: openai       # or: anthropic
  model: gpt-4o          # or: claude-opus-4-5
```

Pattern:
```python
class LLMProvider(ABC):
    @abstractmethod
    def generate(self, prompt: str) -> str: ...

class OpenAIProvider(LLMProvider): ...   # calls openai SDK
class AnthropicProvider(LLMProvider): ... # lazy-imports anthropic SDK

def get_provider(config: dict) -> LLMProvider:
    # reads config["llm"]["provider"] — defaults to openai/gpt-4o
```

`generate_message()` in `prompts/messages.py` accepts `provider: LLMProvider = None`.
If None it falls back to `OpenAIProvider()` — fully backward compatible with tests.

---

## Memory system (`tools/memory.py`)

### `data/sent_log.yaml`
Tracks which (person, occasion, year) pairs have already been messaged.
Updated two ways:
1. **Supabase sync** — `sync_sent_log_from_supabase()` runs at the top of every daily check; pulls all `whatsapp_sent=true` rows and merges them in (idempotent)
2. **Direct append** — `append_sent_log()` can be called directly if needed

```yaml
# data/sent_log.yaml — example
- person_name: Alice
  occasion: birthday
  year: 2026
  sent_at: "2026-04-05T09:14:22"
  context_added: "We stayed up all night before finals"
  tone_selected: "warmer and more heartfelt"
```

### `data/run_log.yaml`
Appended by `append_run_log()` at the end of every orchestrator run.
```yaml
# data/run_log.yaml — example
- run_date: "2026-04-21"
  events_found: 2
  events_skipped: 1
  events_sent: 1
  synced_from_supabase: 1
  digest_sent: true
  logged_at: "2026-04-21T15:02:11.043"
```

---

## Feedback loop (how the agent learns)

```
You send a message via Warmly
    ↓
/api/mark-sent writes back to Supabase:
  whatsapp_sent=true, sent_at, message_sent, context_added, tone_selected
    ↓
Next morning: sync_sent_log_from_supabase() pulls this row
    ↓
sent_log.yaml is updated on disk
    ↓
router.should_send = False → no duplicate message sent
    ↓ (Sprint 3)
context_added + tone_selected will feed preferences.py
    → build_prompt() uses your past choices to personalise future messages
```

---

## Secrets — GitHub (Actions)

| Secret | Description |
|---|---|
| `OPENAI_API_KEY` | OpenAI API key (gpt-4o) |
| `TWILIO_ACCOUNT_SID` | Twilio Account SID |
| `TWILIO_AUTH_TOKEN` | Twilio Auth Token |
| `TWILIO_FROM` | Twilio WhatsApp number e.g. `whatsapp:+14155238886` |
| `MY_WHATSAPP_NO` | Owner's WhatsApp number (E.164) — where digest is sent |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Supabase service role key |
| `WARMLY_BASE_URL` | Warmly app URL e.g. `https://birthday-reminders-pi.vercel.app` |

⚠️ All secrets must be **repository secrets**, NOT environment secrets.
Environment secrets are NOT picked up by GitHub Actions unless `environment:` is set in the workflow.

## Secrets — Vercel (Warmly app)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (safe to expose) |
| `SUPABASE_SERVICE_KEY` | Supabase service role key (server-side only) |
| `OPENAI_API_KEY` | OpenAI API key |
| `TWILIO_ACCOUNT_SID` | Twilio Account SID |
| `TWILIO_AUTH_TOKEN` | Twilio Auth Token |
| `TWILIO_FROM` | Twilio WhatsApp number (with `whatsapp:` prefix) |
| `MY_WHATSAPP` | Owner's WhatsApp number (E.164) |
| `NEXT_PUBLIC_WARMLY_URL` | Production URL e.g. `https://birthday-reminders-pi.vercel.app` |

---

## Running tests
```bash
python -m pytest tests/ -v
```
All 138 tests must pass before any commit. Tests do NOT call OpenAI (mocked).

## Running locally
```bash
export OPENAI_API_KEY=...
export TWILIO_ACCOUNT_SID=...
export TWILIO_AUTH_TOKEN=...
export TWILIO_FROM=...
export MY_WHATSAPP=+1...
python scripts/check_reminders.py
```

## Preview upcoming events (no messages sent)
```bash
python scripts/list_upcoming.py        # next 30 days
python scripts/list_upcoming.py 90     # next 90 days
```

---

## Warmly (web UI)

### Stack
- **Framework**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Hosting**: Vercel (auto-deploys on push to main)
- **Database**: Supabase (reminders table + voice-notes storage bucket)
- **Design**: Dark theme (#0A0A18), orange→pink gradient (`btn-primary`), glass cards

### Supabase setup required

1. Table: `reminders` with columns:
   ```
   token, person_name, relationship, occasion, notes, message, phone, created_at
   whatsapp_sent boolean default false
   sent_at       timestamptz
   message_sent  text
   context_added text
   tone_selected text
   ```
   Run this to add all feature columns to an existing table:
   ```sql
   ALTER TABLE reminders
     ADD COLUMN IF NOT EXISTS whatsapp_sent  boolean default false,
     ADD COLUMN IF NOT EXISTS sent_at        timestamptz,
     ADD COLUMN IF NOT EXISTS message_sent   text,
     ADD COLUMN IF NOT EXISTS context_added  text,
     ADD COLUMN IF NOT EXISTS tone_selected  text,
     ADD COLUMN IF NOT EXISTS skipped        boolean default false,
     ADD COLUMN IF NOT EXISTS skipped_at     timestamptz;
   ```

2. RLS policy — public read on reminders:
   ```sql
   CREATE POLICY "Public read reminders" ON reminders FOR SELECT USING (true);
   ```

3. Storage bucket: `voice-notes` (public)

4. Storage policy — public read on voice-notes:
   ```sql
   CREATE POLICY "Public read voice-notes" ON storage.objects
     FOR SELECT USING (bucket_id = 'voice-notes');
   ```

### Vercel deployment protection
- Use **Standard Protection** (not None, not full)
- Standard Protection = preview deployments protected, production URL public
- Production URL (`birthday-reminders-pi.vercel.app`) is always public
- `VERCEL_URL` env var = deployment-specific URL (may be protected) — always use `NEXT_PUBLIC_WARMLY_URL` for external links

---

## Agentic architecture pillars

This project is a working example of all seven pillars. Reference this when extending it.

| Pillar | This project | Next step |
|---|---|---|
| **Tools** | calendar, whatsapp, warmly, memory | preferences tool (Sprint 3) |
| **Memory** | sent_log.yaml (episodic), people.yaml (semantic), run_log.yaml (episodic) | preferences.yaml derived from sent patterns |
| **Prompts** | Two templates + tone routing + LLM abstraction | build_prompt() that uses past context |
| **Router** | rule-based (message_type, tone, should_send, channel, urgency) | planning agent only if rules can't cover it |
| **Feedback loop** | Warmly writes back → Supabase → sync → sent_log → skip | Sprint 3: read back context_added + tone to improve prompts |
| **Observability** | run_log.yaml per-run history | dashboard, failure alerts |
| **Human control** | Owner reviews + edits every message before send | skip button in Warmly |

### Four memory types (mapped to this project)

| Type | Definition | In this project |
|---|---|---|
| **Working** | Current run only — in RAM | `sent_log` list in `check_reminders.py`, current `message` string in Warmly |
| **Episodic** | What happened + when (timestamped events) | `data/sent_log.yaml`, `data/run_log.yaml` |
| **Semantic** | Timeless facts about the world | `data/people.yaml` (birthdays, relationships, notes) |
| **Procedural** | How to do things (the code itself) | `tools/`, `prompts/`, `router/` — the agent's skills |

### Rule-based router vs planning agent

Use a **rule-based router** (what this project has) when:
- The decision space is finite and enumerable
- Rules can be written down: "if days_away=0, message_type=wish"
- Wrong decisions are low-stakes

Use a **planning agent** when:
- The right action requires judgment about open-ended context
- Example: "Should I skip this person's reminder because they're going through a hard time?" — that needs to read notes, infer emotional state, weigh options
- Rule-based would require an impossibly large decision tree

For this project: router stays rule-based. A planning agent would be appropriate for Sprint 4's "relationship health" feature — deciding whether to send at all based on recency and sentiment patterns.

---

## Hard-won lessons (do not repeat these mistakes)

### WhatsApp via wa.me deep links
- `wa.me/?text=...` supports **text only** — no binary attachments
- Images, audio, video **cannot** be sent this way
- Pre-fill text with `encodeURIComponent(text)`
- `window.open(waUrl, '_blank')` is blocked by iOS Safari if called after `await` — must be called on **direct user tap** (synchronously)
- Pattern: pre-generate filename and URL *before* any async, open WhatsApp on the tap event, then upload in background

### Twilio WhatsApp Sandbox limitations
- Sandbox supports: text messages, images (jpeg/png)
- Sandbox does **NOT** support: audio, video, documents
- Audio via Twilio API fails with **error 63021** (Channel invalid content error) in sandbox
- To send native audio/voice notes: need WhatsApp Business API (production Twilio + Meta approval)
- Workaround: upload audio to Supabase Storage, share as tap-to-play link via wa.me text

### Audio recording (MediaRecorder API)
- Prefer MIME types in this order: `audio/ogg;codecs=opus` → `audio/mp4` → `audio/webm`
- `audio/webm` is NOT supported by WhatsApp
- `audio/ogg` (Opus) and `audio/mp4` ARE supported by WhatsApp
- iOS Safari only supports `audio/mp4` — always falls back correctly with the preference order above
- Always use `mr.start(100)` (100ms timeslice) for reliability
- Always handle `getUserMedia` permission denied with an explicit, human-readable error

### Supabase Storage
- Marking a bucket "public" in the dashboard is NOT enough — you must also add an RLS policy via SQL
- Without the SQL policy, `getPublicUrl()` returns a URL that gives 403
- Proxy audio through a Next.js API route (`/api/audio/[filename]`) using the service key — more reliable than direct Supabase URLs
- `upsert: true` on upload is essential when the client pre-generates the filename before upload

### Vercel environment URLs
- `VERCEL_URL` = deployment-specific subdomain (e.g. `aih6p3enl.vercel.app`) which is protected by Standard Protection
- Always use `NEXT_PUBLIC_WARMLY_URL` for external links (set to `https://birthday-reminders-pi.vercel.app`)
- Symptom of using VERCEL_URL: audio link requires Vercel login to open

### Secrets management
- GitHub Actions: secrets go in **repository secrets**, NOT environment secrets
  - Environment secrets require `environment:` in the workflow YAML — easy to miss
  - Symptom: secret appears set in GitHub UI but arrives as empty string in workflow
- Vercel: `NEXT_PUBLIC_*` vars are exposed client-side; others are server-only
- Twilio credentials must be in Vercel env vars too (not just GitHub) — Warmly calls Twilio from server routes

### Feedback loop write-back
- Write back on the user action (tap), not on page load or a timer
- Use fire-and-forget (`fetch().catch()`) — never block the WhatsApp open on a write-back
- Keep write-back idempotent — the sync function checks for duplicates before appending
- Skipped = same as sent for deduplication — `sync_sent_log_from_supabase()` pulls both

### Planning agent design
- Only invoke when notes are substantial (>50 chars) — empty notes → fast return, no LLM cost
- Use a tightly structured output format (`KEY: value` per line) so parsing is reliable
- Always have a `_no_adjustment()` fallback — errors should degrade gracefully, not crash
- Inject the instruction into `person["notes"]` so generate_message() sees it without needing a new param
- The planning agent recommends; the orchestrator decides — `urgency=skip` is honoured in `check_reminders.py` but not enforced by the agent itself

### Building and deploying Warmly
- Always build from `warmly/` directory: `cd warmly && node_modules/.bin/next build`
- Never run `npx next build` from the project root — it won't find the right config
- TypeScript errors fail the Vercel deploy silently; always verify the build locally first
- `git add warmly/app/send/[token]/page.tsx` fails in zsh due to `[` glob expansion — use `git add warmly/` instead

---

## Key constraints
- **No database, no server** (backend) — YAML files only for Python side
- **Secrets never in code** — GitHub Secrets and Vercel env vars only
- **LLM model**: configured in `config.yaml` — default `gpt-4o` via OpenAI
- **Delivery**: Twilio WhatsApp sandbox (owner's number must join sandbox)
- **Tests must pass** before every push: `python -m pytest tests/ -v` (84 tests)

## What NOT to change without thought
- `days_until` year-boundary wrap in `tools/calendar.py` — handles Dec 31 → Jan 1 correctly
- Two-template split (reminder vs wish) in `prompts/messages.py` — intentional
- `CLOSE_RELATIONSHIPS` set in `router/message_router.py` — add new relationships here, don't inline
- `reminder_days: [3, 0]` in `config.yaml` — 3-day advance + day-of only by design
- `NEXT_PUBLIC_WARMLY_URL` in Vercel — must point to production URL, not deployment URL
- `append_sent_log()` idempotency check — must stay or Supabase syncs will create duplicates
- `window.open()` placement in Warmly — must be synchronous on user tap, never after `await`

---

## Sprint roadmap

### ✅ Sprint 1 — Core agentic layer
- LLM provider abstraction (`prompts/llm.py`) — swap GPT for Claude/Gemini via config
- Memory tool (`tools/memory.py`) — `sent_log.yaml`, `already_sent_this_year()`
- Router upgraded — `should_send`, `channel`, `urgency` fields
- 84 tests, all passing

### ✅ Sprint 2 — Feedback loop
- `/api/mark-sent` — Warmly writes `message_sent`, `context_added`, `tone_selected` back to Supabase on send
- `sync_sent_log_from_supabase()` — daily sync pulls sent data into `sent_log.yaml`
- `run_log.yaml` — structured run history after every GitHub Actions trigger
- `toneUsed` state tracked in Warmly UI

### ✅ Sprint 3 — Preferences + Skip
- `tools/preferences.py` — derives tone preferences and past context themes from `sent_log`; `build_preferences_section()` injects history into every prompt
- Templates updated with `{preferences_section}` slot — AI now sees what the owner has sent before
- Skip button in Warmly — ghost CTA at bottom; POST `/api/skip` marks `skipped=true`; sync treats skipped same as sent (no duplicate reminder)
- 21 new tests

### ✅ Sprint 4 — Health, Planning Agent, Alerts
- `tools/health.py` — relationship health: `days_since_last_sent()`, `get_relationship_health()` (never/overdue/ok/recent tiers), `health_summary_text()`
- `router/planning_agent.py` — LLM-based edge case detector; reads person notes, outputs `needs_adjustment`, `reason`, `instruction`, `urgency` (skip/sensitive/normal); fast path for short notes; graceful fallback
- `scripts/status.py` — CLI dashboard: contacts, upcoming, sent log, run log, LLM config, relationship health; `--full` flag for detail table
- `.github/workflows/daily_reminder.yml` — failure alert step sends WhatsApp via Twilio if any step fails
- 33 new tests (138 total)
