# BirthdayReminders — Claude Code Skills

Invoke any skill by typing the skill name in Claude Code for this project.

---

## `/br-context`
**Load full project context at the start of any session.**

```
You are working on BirthdayReminders — a personal WhatsApp reminder system with a Warmly web UI.

Read CLAUDE.md first for architecture, constraints, file map, and hard-won lessons.

Key facts:
- Personal tool (not a product) — simplicity over features
- Data lives in data/people.yaml (YAML, not a database)
- GitHub Actions runs daily at 7AM PST via .github/workflows/daily_reminder.yml
- Delivery: Twilio WhatsApp sandbox → owner's number only (digest + Warmly edit link)
- AI: OpenAI GPT-4o for message generation, DALL-E 3 for images
- Warmly: Next.js app on Vercel — edit/send UI at /send/[token]
- Tests: 43 tests in tests/ — all must pass before any push
- Repo: github.com/Learning-WoodyJessie/BirthdayReminders

Architecture layers (never mix them):
  tools/    → what the system can DO (calendar, whatsapp, warmly)
  prompts/  → what the system can SAY (templates + GPT-4o)
  router/   → HOW it decides (message_type, tone, label)
  scripts/  → orchestration only (thin, no business logic)
  warmly/   → web UI for editing and sending (Next.js on Vercel)

Critical platform limitations (read CLAUDE.md "Hard-won lessons"):
  - wa.me links = text only, no attachments
  - Twilio sandbox = no audio (error 63021), text + images only
  - window.open() after await = blocked on iOS Safari
  - VERCEL_URL = deployment URL (protected) — use NEXT_PUBLIC_WARMLY_URL instead
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
**Debug a failed GitHub Actions workflow run.**

```
Debug this BirthdayReminders failure systematically:

1. Check which step failed in GitHub Actions logs
2. Common failures and fixes:
   - "OPENAI_API_KEY empty"     → secrets must be REPOSITORY secrets, not environment secrets
   - "Twilio error 401"         → TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN wrong/missing
   - "Twilio error 63007"       → recipient hasn't joined Twilio sandbox (text JOIN to sandbox number)
   - "Twilio error 63021"       → audio not supported in sandbox (text/images only)
   - "MY_WHATSAPP not set"      → MY_WHATSAPP_NO secret missing from repository secrets
   - "No reminders for today"   → check: date in people.yaml correct? ZoneInfo PT timezone? reminder_days includes 0?
   - "Supabase link expired"    → RLS policy missing on reminders table (see CLAUDE.md Supabase setup)
3. Run tests locally first: python -m pytest tests/ -v
4. Test locally with real env vars: python scripts/check_reminders.py
5. Check config.yaml reminder_days — must include 3 and 0

Secrets rule: ALL secrets must be repository-level in GitHub, not under an environment.
  Wrong: Settings → Environments → Prod → Secrets
  Right: Settings → Secrets and variables → Actions → Repository secrets

Never bypass errors with bare except. Fix the root cause.
```

---

## `/warmly-debug`
**Debug a Warmly web app issue.**

```
Debug this Warmly issue systematically:

COMMON ISSUES:

1. "This link has expired or is invalid"
   → Supabase RLS policy missing on reminders table:
     CREATE POLICY "Public read reminders" ON reminders FOR SELECT USING (true);
   → Or: NEXT_PUBLIC_SUPABASE_ANON_KEY not set in Vercel env vars

2. Tone/regenerate not working
   → OPENAI_API_KEY not set in Vercel env vars

3. Voice note upload fails
   → SUPABASE_SERVICE_KEY not set in Vercel env vars
   → voice-notes storage bucket doesn't exist in Supabase
   → Storage RLS policy missing:
     CREATE POLICY "Public read voice-notes" ON storage.objects
       FOR SELECT USING (bucket_id = 'voice-notes');

4. Audio URL requires login / Twilio gets 401 fetching audio
   → NEXT_PUBLIC_WARMLY_URL not set in Vercel — set to https://birthday-reminders-pi.vercel.app
   → VERCEL_URL points to deployment-specific URL which is protected by Standard Protection

5. WhatsApp doesn't open on iOS after recording
   → window.open() is blocked by iOS Safari after async operations
   → Fix: pre-generate filename before upload, open WhatsApp synchronously on user tap

6. Voice note not delivered as native audio in WhatsApp
   → Twilio sandbox only supports text + images (error 63021 = audio rejected)
   → Workaround: upload audio, share as tap-to-play link via wa.me
   → Native audio needs WhatsApp Business API (production Twilio + Meta approval)

VERCEL DEPLOYMENT PROTECTION:
   → Use "Standard Protection" — protects preview, keeps production public
   → Never turn off completely, never upgrade to full protection for this app

CHECK THESE ENV VARS ARE SET IN VERCEL:
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  NEXT_PUBLIC_WARMLY_URL          ← must be https://birthday-reminders-pi.vercel.app
  SUPABASE_SERVICE_KEY
  OPENAI_API_KEY
  TWILIO_ACCOUNT_SID
  TWILIO_AUTH_TOKEN
  TWILIO_FROM                     ← include whatsapp: prefix e.g. whatsapp:+14155238886
  MY_WHATSAPP                     ← E.164 e.g. +14259850783
```

---

## `/warmly-deploy`
**Deploy a Warmly change to production.**

```
Deploy Warmly changes to Vercel:

1. Build locally first:
   cd warmly && node_modules/.bin/next build
   (Fix all TypeScript/build errors before pushing)

2. Commit and push to main:
   git add warmly/
   git commit -m "feat/fix/design: description"
   git push

3. Vercel auto-deploys on push to main (~1-2 min)
   Check: vercel.com → birthday-reminders → Deployments

4. After deploy, verify at https://birthday-reminders-pi.vercel.app

IMPORTANT:
  - Build from warmly/ directory: cd warmly && node_modules/.bin/next build
  - Never push broken builds — TypeScript errors will fail Vercel deploy
  - If env vars change, redeploy manually: Vercel → Deployments → Redeploy
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

1. git log --oneline -5          → recent changes
2. python scripts/list_upcoming.py 30  → upcoming events
3. python -m pytest tests/ -q    → test status
4. cat config.yaml               → reminder windows and settings
5. Count people in data/people.yaml
6. Check Vercel deployment: https://birthday-reminders-pi.vercel.app

Report as a brief summary:
  Contacts: X people
  Upcoming (30 days): X events
  Tests: X/43 passing
  Schedule: 7AM PST daily (GitHub Actions)
  Warmly: https://birthday-reminders-pi.vercel.app
  Last change: <commit message>
```

---

## `/br-upgrade-twilio`
**Steps to move from Twilio sandbox to production (enables sending to anyone).**

```
Current sandbox limitations:
  - Only owner's number can receive messages (must JOIN sandbox first)
  - Audio messages NOT supported (error 63021)
  - Images supported, audio/video not

To upgrade to production WhatsApp Business API:

1. Upgrade Twilio account (add billing at console.twilio.com)
2. Buy a WhatsApp-enabled phone number (~$1.15/month)
3. Enable WhatsApp: Messaging → Senders → WhatsApp Senders → Add
4. Apply for WhatsApp Business API through Meta (Twilio guides this)
5. Create a message template (required by Meta for outbound messages):
   - Go to: Messaging → Content Editor → Create new
   - Type: WhatsApp, Category: Utility
   - Example: "Hey! Just a reminder — {{1}}'s {{2}} is {{3}}."
6. Wait for Meta approval (~24 hours to 7 days)
7. Update secrets: TWILIO_FROM → new production number (with whatsapp: prefix)
8. With production number, native audio/voice notes will work via MediaUrl

Note: sandbox is fine for personal use (owner only). Only upgrade to send to others
or to enable native audio messages.
```

---

## `/warmly-add-feature`
**Pattern for adding a new feature to Warmly safely.**

```
When adding a feature to warmly/app/send/[token]/page.tsx or a new API route:

PATTERNS TO FOLLOW:
  1. New API routes go in warmly/app/api/<name>/route.ts
  2. Always export named async functions: export async function POST/GET(req: NextRequest)
  3. Return NextResponse.json({...}) — never throw unhandled errors
  4. Wrap entire route body in try/catch, return { error: msg } on catch
  5. Server-side secrets: process.env.SECRET_NAME (no NEXT_PUBLIC_ prefix)
  6. Client-side values: process.env.NEXT_PUBLIC_* only

iOS/MOBILE GOTCHAS:
  - window.open() after await = blocked. Open URLs on direct user tap only.
  - Pre-compute URLs before async, or show a tap-to-open link after async completes
  - MediaRecorder: prefer audio/ogg;codecs=opus → audio/mp4 → audio/webm (in that order)
  - Always request microphone permission with try/catch and show human-readable errors

WHATSAPP LIMITS (wa.me deep links):
  - Text only — no images, audio, or video
  - Max ~4000 chars encoded
  - encodeURIComponent() the text

BUILD BEFORE PUSH:
  cd warmly && node_modules/.bin/next build
  Fix all errors — broken builds fail Vercel deploy silently.
```
