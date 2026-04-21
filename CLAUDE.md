# BirthdayReminders — AI Context

## What this project does
Automated birthday and anniversary reminder system. Runs daily via GitHub Actions.
Reads contacts from `data/people.yaml`, finds upcoming events, routes to the right
prompt, generates personalised messages via OpenAI GPT-4o, and sends a WhatsApp
digest to the owner via Twilio.

## Architecture — tools / prompts / router / resources

```
tools/
  calendar.py       ← find_upcoming, parse_date, days_until, age_str
  whatsapp.py       ← send_whatsapp (Twilio)

prompts/
  messages.py       ← REMINDER_TEMPLATE, WISH_TEMPLATE, generate_message()

router/
  message_router.py ← route() — decides message_type, tone, label

resources (data layer):
  data/people.yaml  ← source of truth for contacts
  config.yaml       ← reminder windows, settings

scripts/
  check_reminders.py  ← thin orchestrator: load → find → route → generate → send
  add_person.py       ← interactive CLI to add contacts
  list_upcoming.py    ← preview upcoming events (no messages sent)
```

## Message flow
1. `find_upcoming` (calendar tool) yields events within `reminder_days`
2. `route()` (router) decides:
   - `message_type`: "reminder" (3 days before) or "wish" (day-of)
   - `tone`: "warm and personal" (close relationships) or "friendly and professional"
3. `generate_message` (prompts) calls GPT-4o with the right template
4. `send_whatsapp` (whatsapp tool) delivers via Twilio

## Message types
| Type | When | Content |
|---|---|---|
| `reminder` | 3 days before | Heads-up + draft message to prepare |
| `wish` | Day-of (0 days) | Actual ready-to-copy-paste message |

## Key constraints
- **No database, no server** — YAML files only. Keep it that way.
- **No web app** — GitHub Actions is the scheduler/runner.
- **Secrets never in code** — all credentials are GitHub Secrets.
- **OpenAI model**: always use `gpt-4o`.
- **Twilio** for WhatsApp delivery (not Meta Cloud API).

## Data schema (`data/people.yaml`)
```yaml
- name: string (required)
  relationship: string (required)
  birthday: YYYY-MM-DD or --MM-DD
  anniversary: YYYY-MM-DD (optional)
  notes: string — used by GPT-4o to personalise
  phone: E.164 (optional — reserved for future direct messaging)
  groups: list of group IDs (optional — reserved for future group posting)
```

## GitHub Secrets required
| Secret | Description |
|---|---|
| `OPENAI_API_KEY` | OpenAI API key |
| `TWILIO_ACCOUNT_SID` | Twilio Account SID |
| `TWILIO_AUTH_TOKEN` | Twilio Auth Token |
| `TWILIO_FROM` | Twilio WhatsApp sender number |
| `MY_WHATSAPP_NO` | Owner's WhatsApp number (E.164) |

## Router — close relationships
These relationship strings trigger "warm and personal" tone:
mother, father, mom, dad, sister, brother, best friend, partner,
spouse, husband, wife, daughter, son, grandmother, grandfather.
All others get "friendly and professional".

## What NOT to change without thought
- `find_upcoming` year-boundary wrap logic in `tools/calendar.py`
- The two-template split in `prompts/messages.py` — reminder vs wish is intentional
- Router tone mapping — add new relationships to `CLOSE_RELATIONSHIPS` set if needed
