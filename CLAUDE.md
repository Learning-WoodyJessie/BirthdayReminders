# BirthdayReminders — AI Context

## What this project does
Personal automated birthday and anniversary reminder system.
Runs daily via GitHub Actions at 7AM PST.
Reads contacts from `data/people.yaml`, finds upcoming events, generates
personalised messages via OpenAI GPT-4o, and sends a WhatsApp digest via Twilio.

---

## Architecture

```
tools/
  calendar.py         ← parse_date, days_until, age_str, find_upcoming
  whatsapp.py         ← send_whatsapp (Twilio)

prompts/
  messages.py         ← REMINDER_TEMPLATE, WISH_TEMPLATE, generate_message()

router/
  message_router.py   ← route() — message_type, tone, label

data/                 ← resource layer (source of truth)
  people.yaml         ← all contacts + dates

scripts/
  check_reminders.py  ← thin orchestrator: load → find → route → generate → send
  add_person.py       ← interactive CLI to add contacts
  list_upcoming.py    ← preview upcoming events (no messages sent)

tests/
  test_calendar.py    ← 20 tests for calendar tools
  test_router.py      ← 15 tests for router
  test_prompts.py     ← 8 tests for prompts (OpenAI mocked)

.github/workflows/
  daily_reminder.yml  ← cron: 7AM PST (15:00 UTC) daily
```

---

## Message flow
```
GitHub Actions (7AM PST)
  → check_reminders.py
      → find_upcoming (calendar tool)     finds events in [3, 0] days
      → route() (router)                  decides message_type + tone
      → generate_message() (prompts)      calls GPT-4o
      → send_whatsapp() (whatsapp tool)   Twilio delivery to owner
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
  birthday: YYYY-MM-DD or --MM-DD (year unknown)
  anniversary: YYYY-MM-DD (optional)
  notes: string — used by GPT-4o to personalise messages
  phone: E.164 (optional — reserved for future direct messaging)
  groups: []  (reserved for future group posting)
```

---

## GitHub Secrets
| Secret | Description |
|---|---|
| `OPENAI_API_KEY` | OpenAI API key (gpt-4o) |
| `TWILIO_ACCOUNT_SID` | Twilio Account SID |
| `TWILIO_AUTH_TOKEN` | Twilio Auth Token |
| `TWILIO_FROM` | Twilio WhatsApp sandbox number |
| `MY_WHATSAPP_NO` | Owner's WhatsApp number (E.164) — where reminders are sent |

---

## Running tests
```bash
python -m pytest tests/ -v
```
All 43 tests must pass before any commit. Tests do NOT call OpenAI (mocked).

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

## Key constraints
- **No database, no server** — YAML files only
- **No web app** — GitHub Actions is the scheduler
- **Secrets never in code** — GitHub Secrets only
- **OpenAI model**: always `gpt-4o`
- **Delivery**: Twilio WhatsApp (sandbox — owner's number must join sandbox)
- **Tests must pass** before every push

## What NOT to change without thought
- `days_until` year-boundary wrap in `tools/calendar.py` — handles Dec 31 → Jan 1 correctly
- Two-template split (reminder vs wish) in `prompts/messages.py` — intentional
- `CLOSE_RELATIONSHIPS` set in `router/message_router.py` — add new close relationships here
- `reminder_days: [3, 0]` in `config.yaml` — 3-day advance + day-of only by design
