# BirthdayReminders — Claude Code Skills

Invoke any skill by typing the skill name in Claude Code for this project.

---

## `/br-context`
**Load full project context at the start of any session.**

```
You are working on BirthdayReminders — a personal WhatsApp reminder system.

Read CLAUDE.md first for architecture, constraints, and file map.

Key facts:
- Personal tool (not a product) — simplicity over features
- Data lives in data/people.yaml (YAML, not a database)
- GitHub Actions runs daily at 7AM PST via .github/workflows/daily_reminder.yml
- Delivery: Twilio WhatsApp sandbox → owner's number only
- AI: OpenAI GPT-4o for message generation
- Tests: 43 tests in tests/ — all must pass before any push
- Repo: github.com/Learning-WoodyJessie/BirthdayReminders

Architecture layers (never mix them):
  tools/    → what the system can DO (calendar, whatsapp)
  prompts/  → what the system can SAY (templates + GPT-4o)
  router/   → HOW it decides (message_type, tone, label)
  scripts/  → orchestration only (thin, no business logic)

The product version of this is Ripple (separate repo).
```

---

## `/br-add-person`
**Add a new person correctly.**

```
Add a new person to data/people.yaml.

Schema:
  name:         string (required)
  relationship: string (required) — see router/message_router.py CLOSE_RELATIONSHIPS
  birthday:     YYYY-MM-DD or --MM-DD if year unknown (required)
  anniversary:  YYYY-MM-DD (optional, null if none)
  notes:        free text — hobbies, life events, memories (more = better messages)
  phone:        E.164 e.g. +14155550001 (optional, null if not known)
  groups:       [] (leave empty)

After adding, verify with:
  python scripts/list_upcoming.py 365

Make sure the person appears in the output with the correct date.
```

---

## `/br-debug`
**Debug a failed workflow run.**

```
Debug this BirthdayReminders failure systematically:

1. Check which step failed in GitHub Actions logs
2. Common failures and fixes:
   - "OPENAI_API_KEY empty"   → check GitHub repo secrets (not environment secrets)
   - "Twilio error 401"       → TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN wrong
   - "Twilio error 63007"     → recipient hasn't joined Twilio sandbox
   - "MY_WHATSAPP not set"    → MY_WHATSAPP_NO secret missing or empty
   - "No reminders for today" → no one has birthday/anniversary in reminder_days window
3. Run tests locally first: python -m pytest tests/ -v
4. Test locally with real env vars: python scripts/check_reminders.py
5. Check config.yaml reminder_days — must include 3 and 0

Never bypass errors with bare except. Fix the root cause.
```

---

## `/br-test`
**Run and validate the test suite.**

```
Run the full test suite for BirthdayReminders:
  python -m pytest tests/ -v

Expected: 43 tests, all passing.

Test coverage:
  tests/test_calendar.py  → parse_date, days_until, age_str, find_upcoming (20 tests)
  tests/test_router.py    → message_type, tone, label, route() (15 tests)
  tests/test_prompts.py   → template selection, formatting, generate_message (8 tests)

If any test fails:
1. Read the failure message carefully
2. Check if the code changed or the test is wrong
3. Fix the code (not the test) unless the test has a genuine bug
4. Re-run until all 43 pass

OpenAI is mocked in tests — no API calls, no cost.
```

---

## `/br-status`
**Quick health check of the system.**

```
Report the current status of BirthdayReminders:

1. git log --oneline -5  → recent changes
2. python scripts/list_upcoming.py 30  → upcoming events
3. python -m pytest tests/ -q  → test status
4. cat config.yaml  → reminder windows and settings
5. Count people in data/people.yaml

Report as a brief summary table:
  Contacts: X people
  Upcoming (30 days): X events
  Tests: X/43 passing
  Schedule: 7AM PST daily
  Last change: <commit message>
```

---

## `/br-upgrade-twilio`
**Steps to move from Twilio sandbox to production.**

```
To send WhatsApp messages to anyone (no sandbox join required):

1. Upgrade Twilio account (add billing at console.twilio.com)
2. Buy a WhatsApp-enabled phone number (~$1.15/month)
3. Enable WhatsApp: Messaging → Senders → WhatsApp Senders → Add
4. Create a message template (required by Meta for outbound messages):
   - Go to: Messaging → Content Editor → Create new
   - Type: WhatsApp, Category: Utility
   - Example: "Hey! Just a reminder — {{1}}'s {{2}} is {{3}}. Here's a message: {{4}}"
5. Wait for Meta approval (~24 hours)
6. Update TWILIO_FROM secret to the new production number
7. Update tools/whatsapp.py to use template SID instead of free-form text

Note: sandbox is fine for personal use (owner only). Only upgrade if sending to others.
```
