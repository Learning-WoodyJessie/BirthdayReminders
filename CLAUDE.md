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

prompts/
  messages.py         ← REMINDER_TEMPLATE, WISH_TEMPLATE, generate_message()

router/
  message_router.py   ← route() — message_type, tone, label

data/                 ← resource layer (source of truth)
  people.yaml         ← all contacts + dates

scripts/
  check_reminders.py  ← thin orchestrator: load → find → route → generate → store → send
  add_person.py       ← interactive CLI to add contacts
  list_upcoming.py    ← preview upcoming events (no messages sent)

tests/
  test_calendar.py    ← 20 tests for calendar tools
  test_router.py      ← 15 tests for router
  test_prompts.py     ← 8 tests for prompts (OpenAI mocked)

warmly/               ← Next.js web app (deployed on Vercel)
  app/
    send/[token]/page.tsx          ← main UI: edit message, tone, voice note, send
    api/regenerate/route.ts        ← POST: rewrite message with tone via GPT-4o
    api/generate-image/route.ts    ← POST: generate celebration image via DALL-E 3
    api/send-voice/route.ts        ← POST: upload voice blob to Supabase Storage
    api/audio/[filename]/route.ts  ← GET: proxy audio files (publicly accessible)

.github/workflows/
  daily_reminder.yml  ← cron: 7AM PST (15:00 UTC) daily
```

---

## Full message flow
```
GitHub Actions (7AM PST)
  → check_reminders.py
      → find_upcoming (calendar tool)     finds events in [3, 0] days
      → route() (router)                  decides message_type + tone
      → generate_message() (prompts)      calls GPT-4o
      → create_warmly_link() (warmly)     stores in Supabase, returns edit URL
      → send_whatsapp() (whatsapp tool)   Twilio digest to owner with Warmly link

Owner clicks Warmly link → warmly/app/send/[token]/page.tsx
  → loads reminder from Supabase by token
  → owner edits message, adjusts tone (GPT-4o), adds context
  → sends via WhatsApp (wa.me deep link) OR records voice note → uploads → wa.me link
```

## Message types
| days_away | message_type | content |
|---|---|---|
| 3 | `reminder` | Heads-up + draft message to prepare and send |
| 0 | `wish` | Ready-to-copy-paste birthday/anniversary message |

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
All 84 tests must pass before any commit. Tests do NOT call OpenAI (mocked).

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
   Run this to add the feedback-loop columns to an existing table:
   ```sql
   ALTER TABLE reminders
     ADD COLUMN IF NOT EXISTS whatsapp_sent  boolean default false,
     ADD COLUMN IF NOT EXISTS sent_at        timestamptz,
     ADD COLUMN IF NOT EXISTS message_sent   text,
     ADD COLUMN IF NOT EXISTS context_added  text,
     ADD COLUMN IF NOT EXISTS tone_selected  text;
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

## Hard-won lessons (do not repeat these mistakes)

### WhatsApp via wa.me deep links
- `wa.me/?text=...` supports **text only** — no binary attachments
- Images, audio, video **cannot** be sent this way
- Pre-fill text with `encodeURIComponent(text)`
- `window.open(waUrl, '_blank')` is blocked by iOS Safari if called after `await` — must be called on **direct user tap** (synchronously)

### Twilio WhatsApp Sandbox limitations
- Sandbox supports: text messages, images (jpeg/png)
- Sandbox does **NOT** support: audio, video, documents
- Audio via Twilio API fails with **error 63021** (Channel invalid content error) in sandbox
- To send native audio/voice notes: need WhatsApp Business API (production Twilio + Meta approval)
- Workaround: upload audio to storage, share as a tap-to-play link via wa.me

### Audio recording (MediaRecorder API)
- Prefer MIME types in this order: `audio/ogg;codecs=opus` → `audio/mp4` → `audio/webm`
- `audio/webm` is NOT supported by WhatsApp
- `audio/ogg` (Opus) and `audio/mp4` ARE supported by WhatsApp
- iOS Safari only supports `audio/mp4` — always falls back correctly with the order above
- Always use `mr.start(100)` (100ms timeslice) for reliability
- Always handle `getUserMedia` permission denied explicitly

### Supabase Storage
- Marking a bucket "public" in the dashboard is NOT enough — you must also add an RLS policy
- Without the SQL policy, `getPublicUrl()` returns a URL that gives 403
- Proxy audio through a Next.js API route (`/api/audio/[filename]`) using the service key — more reliable than direct Supabase URLs

### Secrets management
- GitHub Actions: secrets go in **repository secrets**, NOT environment secrets
  - Environment secrets require `environment:` in the workflow YAML — easy to miss
  - Symptom: secret appears set in GitHub UI but arrives as empty string in workflow
- Vercel: `NEXT_PUBLIC_*` vars are exposed client-side; others are server-only

---

## Key constraints
- **No database, no server** (backend) — YAML files only for Python side
- **Secrets never in code** — GitHub Secrets and Vercel env vars only
- **OpenAI model**: always `gpt-4o`
- **Delivery**: Twilio WhatsApp sandbox (owner's number must join sandbox)
- **Tests must pass** before every push

## What NOT to change without thought
- `days_until` year-boundary wrap in `tools/calendar.py` — handles Dec 31 → Jan 1 correctly
- Two-template split (reminder vs wish) in `prompts/messages.py` — intentional
- `CLOSE_RELATIONSHIPS` set in `router/message_router.py` — add new relationships here
- `reminder_days: [3, 0]` in `config.yaml` — 3-day advance + day-of only by design
- `NEXT_PUBLIC_WARMLY_URL` in Vercel — must point to production URL, not deployment URL
