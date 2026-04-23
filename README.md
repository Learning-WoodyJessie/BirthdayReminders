# Warmly 🌻

An AI-powered birthday and anniversary reminder system. Runs daily via GitHub Actions,
generates personalised WhatsApp messages with GPT-4o, and delivers a review link so
you can edit, adjust tone, add context, and send — in under two minutes.

**Live web UI:** [birthday-reminders-pi.vercel.app](https://birthday-reminders-pi.vercel.app)
**Repo:** [github.com/Learning-WoodyJessie/BirthdayReminders](https://github.com/Learning-WoodyJessie/BirthdayReminders)

---

## How it works

```
GitHub Actions (7AM PST daily)
  → find upcoming birthdays and anniversaries
  → route: message type, tone, should send
  → plan: LLM reads notes, flags anything sensitive
  → generate: GPT-4o with past preferences injected
  → send WhatsApp digest with a Warmly edit link
  → you tap the link → edit → send to WhatsApp
  → write-back: tone + context logged → informs next message
```

You review every message before it goes out. The system never sends directly to anyone —
it sends you a draft to review and act on.

---

## Understanding the codebase

The architecture is split into layers, each mapping to an agentic AI concept:

```
tools/              → what the system can DO (one capability per file)
  calendar.py       — date math: parse_date, days_until, find_upcoming
  whatsapp.py       — send digest via Twilio WhatsApp sandbox
  memory.py         — load/write sent log, sync from Supabase
  preferences.py    — pull past tone + context, inject into prompts
  health.py         — relationship health: never / overdue / ok / recent
  warmly.py         — create Supabase reminder row, return edit link

prompts/            → what the system can SAY
  messages.py       — REMINDER_TEMPLATE, WISH_TEMPLATE, generate_message()
  llm.py            — LLMProvider (ABC), OpenAIProvider, AnthropicProvider,
                      get_provider(config) factory

router/             → HOW it decides
  message_router.py — rule-based: tone, channel, urgency, should_send
  planning_agent.py — LLM-based: reads notes, flags sensitive cases

data/               → what the system KNOWS
  people.yaml       — contacts (source of truth for the Python layer)
  sent_log.yaml     — episodic memory: what was sent, when
  run_log.yaml      — record of every daily run

scripts/            → orchestrators only, no business logic
  check_reminders.py — main daily runner
  list_upcoming.py   — preview upcoming events (no messages sent)
  status.py          — CLI health dashboard
  add_person.py      — interactive CLI to add a contact

warmly/             → Next.js web UI (Vercel)
  app/send/[token]  — edit · tone · voice · send · skip
  app/dashboard     — upcoming events + ✉️ Write buttons
  app/contacts      — contact list + add contact form
  app/api/          — generate, regenerate, mark-sent, skip, send-voice

tests/              → 138 tests, all mocked (no API calls, no cost)
```

**Key documents:**
| File | Purpose |
|---|---|
| `CLAUDE.md` | Architecture, constraints, hard-won lessons — context for AI assistants |
| `SKILLS.md` | Claude Code slash commands — `/agentic-blueprint`, `/br-debug`, `/warmly-deploy` |
| `LEARNING.md` | Concept journal — what each layer taught, where to apply next |
| `docs/ROADMAP.md` | Project history and what comes next |

---

## Setup

### Prerequisites
- Python 3.11+
- Node.js 18+
- A [Twilio account](https://twilio.com) (free tier works — WhatsApp sandbox)
- An [OpenAI account](https://platform.openai.com) with API access
- A [Supabase project](https://supabase.com) (free tier works)
- A [Vercel account](https://vercel.com) (free tier works — for the web UI)

---

### 1. Clone and install

```bash
git clone https://github.com/Learning-WoodyJessie/BirthdayReminders.git
cd BirthdayReminders
pip install -r requirements.txt
```

---

### 2. Supabase — database setup

Create a new Supabase project, then run the following in the **SQL editor**:

```sql
-- Contacts table (used by the web UI)
CREATE TABLE people (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid,
  name         text not null,
  relationship text not null,
  birthday     text,
  anniversary  text,
  phone        text,
  notes        text,
  created_at   timestamptz default now()
);

-- Reminders table (stores generated messages + tracks sends)
CREATE TABLE reminders (
  id            uuid primary key default gen_random_uuid(),
  token         text unique not null,
  person_name   text,
  relationship  text,
  occasion      text,
  notes         text,
  message       text,
  phone         text,
  user_id       uuid,
  created_at    timestamptz default now(),
  whatsapp_sent boolean default false,
  sent_at       timestamptz,
  message_sent  text,
  context_added text,
  tone_selected text,
  skipped       boolean default false,
  skipped_at    timestamptz
);

-- Allow public read on reminders (token = access control)
CREATE POLICY "Public read reminders" ON reminders
  FOR SELECT USING (true);

ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE people DISABLE ROW LEVEL SECURITY;

-- Voice notes storage bucket
-- Go to Storage → New bucket → name: voice-notes → mark public
-- Then run:
CREATE POLICY "Public read voice-notes" ON storage.objects
  FOR SELECT USING (bucket_id = 'voice-notes');
```

Note your **Project URL** and **service role key** (Settings → API).

---

### 3. Twilio WhatsApp sandbox

1. Sign up at [twilio.com](https://twilio.com)
2. Go to **Messaging → Try it out → Send a WhatsApp message**
3. Follow the instructions to join the sandbox (text `JOIN <word>` to the sandbox number)
4. Note your:
   - **Account SID**
   - **Auth Token**
   - **Sandbox number** (format: `whatsapp:+14155238886`)
5. Your own WhatsApp number must have joined the sandbox to receive messages

---

### 4. Add your contacts

Edit `data/people.yaml` directly:

```yaml
- name: Jane Smith
  relationship: best friend
  birthday: "1990-06-15"       # YYYY-MM-DD, or --MM-DD if year unknown
  anniversary: null
  phone: "+14155550001"         # E.164 format, optional
  notes: >
    We met in college. Loves hiking, terrible at replying to texts,
    obsessed with her dog Biscuit.
```

Or use the interactive CLI:
```bash
python scripts/add_person.py
```

---

### 5. Set environment variables

For local testing, create a `.env` file (never commit this):

```bash
OPENAI_API_KEY=sk-...
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM=whatsapp:+14155238886
MY_WHATSAPP_NO=+1...              # your number that joined the sandbox
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
WARMLY_BASE_URL=http://localhost:3000
```

---

### 6. Run locally

```bash
# Preview upcoming events (no messages sent, no API calls)
python scripts/list_upcoming.py
python scripts/list_upcoming.py 90    # next 90 days

# System health dashboard
python scripts/status.py
python scripts/status.py --full       # per-person health table

# Run the full daily flow (sends real WhatsApp messages)
python scripts/check_reminders.py

# Run all tests (no API calls, no cost)
python -m pytest tests/ -v            # expect: 138 passed
```

---

### 7. GitHub Actions — automate the daily run

In your forked repo → **Settings → Secrets and variables → Actions → Repository secrets**
(must be repository secrets, not environment secrets):

| Secret | Value |
|---|---|
| `OPENAI_API_KEY` | Your OpenAI API key |
| `TWILIO_ACCOUNT_SID` | Twilio Account SID |
| `TWILIO_AUTH_TOKEN` | Twilio Auth Token |
| `TWILIO_FROM` | e.g. `whatsapp:+14155238886` |
| `MY_WHATSAPP_NO` | Your WhatsApp number in E.164 format |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Supabase service role key |
| `WARMLY_BASE_URL` | Your Vercel deployment URL (step 8) |

The cron runs daily at 7AM PST (15:00 UTC). To change the time, edit
`.github/workflows/daily_reminder.yml`:
```yaml
- cron: '15 15 * * *'   # 15:15 UTC = 7:15AM PST
```
Use [crontab.guru](https://crontab.guru) to find your offset.

---

### 8. Deploy the Warmly web UI (optional but recommended)

The web UI lets you edit messages, adjust tone, record voice notes, and send to
WhatsApp from your phone — without waiting for the daily digest.

**Deploy to Vercel:**

```bash
cd warmly
npm install
npm run build          # verify it builds before deploying
```

1. Push your repo to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → import your repo
3. Set **Root Directory** to `warmly`
4. Add these environment variables in Vercel (Settings → Environment Variables):

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_KEY` | Supabase service role key |
| `OPENAI_API_KEY` | OpenAI API key |
| `TWILIO_ACCOUNT_SID` | Twilio Account SID |
| `TWILIO_AUTH_TOKEN` | Twilio Auth Token |
| `TWILIO_FROM` | e.g. `whatsapp:+14155238886` |
| `MY_WHATSAPP` | Your WhatsApp number in E.164 format |
| `NEXT_PUBLIC_WARMLY_URL` | Your production Vercel URL (never use `VERCEL_URL`) |

5. Deploy. Note the production URL and add it as `WARMLY_BASE_URL` in GitHub secrets.

---

## Adjust reminder timing

Edit `config.yaml`:
```yaml
reminder_days: [3, 0]   # 3 days before + day-of (recommended)
```

---

## Swap LLM provider

Edit `config.yaml`:
```yaml
llm:
  provider: openai       # or: anthropic
  model: gpt-4o          # or: claude-opus-4-5
```

The provider abstraction handles the rest — no code changes needed.

---

## Troubleshooting

**Messages not sending / GitHub Actions failing**
- Secrets must be **repository secrets**, not environment secrets
- Check the Actions log for the exact failing step
- Run `python scripts/status.py` locally to verify the setup

**"This link has expired or is invalid" in Warmly**
- RLS policy missing on the `reminders` table (re-run the SQL above)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` not set in Vercel

**WhatsApp not opening on iOS after voice note**
- Known iOS Safari limitation: `window.open()` is blocked after `async/await`
- This is handled by design — report as a bug if it regresses

**Tone/regenerate not working in Warmly**
- `OPENAI_API_KEY` not set in Vercel environment variables

**Voice upload fails**
- `voice-notes` Supabase storage bucket doesn't exist or RLS policy missing
- `SUPABASE_SERVICE_KEY` not set in Vercel

---

## Contributing

This is a personal learning project — built to make agentic AI concepts concrete,
not to be a general-purpose product. Read `CLAUDE.md` before making any changes.
Run `python -m pytest tests/ -v` before every push (138 tests, all must pass).

---

*Built with Claude Code · Python · Next.js · Supabase · Twilio · OpenAI*
