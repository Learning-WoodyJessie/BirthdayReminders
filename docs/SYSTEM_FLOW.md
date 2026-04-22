# BirthdayReminders + Warmly — System Flow

Two sequence diagrams: the automated daily engine, and the Warmly editing experience.

---

## Part 1 — Daily Reminder Engine

Runs automatically every day at 7AM Pacific via GitHub Actions.

```mermaid
sequenceDiagram
    autonumber

    participant GH   as GitHub Actions<br/>(7AM PST cron)
    participant CR   as check_reminders.py<br/>(orchestrator)
    participant CAL  as calendar.py<br/>(tool)
    participant ROU  as message_router.py<br/>(router)
    participant GPT  as OpenAI GPT-4o
    participant SB   as Supabase<br/>(reminders table)
    participant TW   as Twilio
    participant OWN  as Owner<br/>(WhatsApp)

    GH->>CR: trigger (daily cron 15:00 UTC)

    CR->>CAL: find_upcoming(people.yaml, reminder_days=[3,0])
    Note over CAL: Reads all contacts<br/>Calculates days until each event<br/>Handles year boundary (Dec→Jan)
    CAL-->>CR: [{ person: Alice, occasion: birthday, days_away: 0 }]

    loop for each upcoming event

        CR->>ROU: route(relationship="best friend", days_away=0)
        Note over ROU: days_away=0 → message_type: wish<br/>best friend → tone: warm and personal<br/>days_away=3 → message_type: reminder
        ROU-->>CR: { message_type: wish, tone: warm and personal }

        CR->>GPT: generate_message(person, occasion, notes, tone)
        Note over GPT: Prompt includes:<br/>• Person name + relationship<br/>• Occasion (birthday/anniversary)<br/>• Notes (memories, personality)<br/>• Tone instruction<br/>• Past send history (preferences)
        GPT-->>CR: "Hey Alice! 🎉 Happy Birthday..."

        CR->>SB: insert({ token: uuid, person, message, phone, ... })
        Note over SB: Stores full reminder<br/>Token = unique URL key<br/>RLS policy allows public read
        SB-->>CR: warmly_url = https://birthday-reminders-pi.vercel.app/send/{token}

    end

    CR->>TW: send_whatsapp(to: MY_WHATSAPP, body: digest + warmly_url)
    Note over TW: Twilio WhatsApp sandbox<br/>From: whatsapp:+14155238886<br/>To: owner's number
    TW-->>OWN: WhatsApp message delivered
    Note over OWN: "🎂 Alice's birthday is TODAY<br/>✏️ Personalise & send:<br/>https://birthday-reminders-pi.vercel.app/send/abc-123"
```

---

## Part 2 — Warmly (Edit & Send)

Triggered when the owner taps the Warmly link in their WhatsApp digest.

```mermaid
sequenceDiagram
    autonumber

    participant OWN  as Owner<br/>(mobile)
    participant UI   as Warmly UI<br/>/send/[token]
    participant SB   as Supabase<br/>(reminders table)
    participant GPT  as OpenAI GPT-4o
    participant SBS  as Supabase Storage<br/>(voice-notes bucket)
    participant VER  as Vercel<br/>/api/audio/[filename]
    participant WA   as WhatsApp

    OWN->>UI: tap Warmly link

    UI->>SB: SELECT * FROM reminders WHERE token = {token}
    Note over SB: Public read RLS policy<br/>allows unauthenticated fetch
    SB-->>UI: { person_name, occasion, message, phone, notes, ... }

    UI-->>OWN: show page with<br/>editable message + tone buttons

    Note over OWN,UI: ── Path A: Edit text and send ──

    opt Owner types personal context
        OWN->>UI: types memory / inside joke in context field
    end

    opt Owner adjusts tone
        OWN->>UI: taps Funnier / Warmer / Shorter / Regenerate
        UI->>GPT: POST /api/regenerate<br/>{ person, occasion, notes + context, tone }
        Note over GPT: Rewrites message with<br/>new tone + added context
        GPT-->>UI: { message: "new version..." }
        UI-->>OWN: message textarea updates
    end

    OWN->>UI: taps "Send as text 💬"
    Note over UI: Builds wa.me URL:<br/>wa.me/{phone}?text={encodeURIComponent(message)}<br/>window.open() — called on direct tap (iOS safe)
    UI->>WA: open wa.me deep link
    WA-->>OWN: WhatsApp opens with<br/>message pre-filled to recipient
    OWN->>WA: taps Send ✓
    UI->>SB: POST /api/mark-sent (background)<br/>writes message_sent, context_added, tone_selected

    Note over OWN,WA: ── Path B: Record and send voice note ──

    OWN->>UI: taps 🎤 Tap to record
    Note over UI: MediaRecorder API<br/>Prefers audio/ogg (Chrome) → audio/mp4 (Safari)<br/>Captures in 100ms chunks
    UI-->>OWN: recording... (pulse animation)

    OWN->>UI: taps ⏹ Stop recording
    UI-->>OWN: shows audio playback + Send button

    OWN->>UI: taps "Send voice note on WhatsApp 🎤"

    Note over UI: Pre-generates filename BEFORE any async<br/>Builds wa.me URL with audio link<br/>Opens WhatsApp SYNCHRONOUSLY (iOS won't block this)
    UI->>WA: window.open(wa.me?text=🎤 Voice note — tap to listen: {audioUrl})
    WA-->>OWN: WhatsApp opens with link pre-filled

    UI->>SBS: POST /api/send-voice (background, fire-and-forget)
    Note over SBS: Uploads audio blob<br/>upsert: true so filename matches pre-generated URL
    SBS-->>UI: { ok: true }

    Note over OWN,VER: ── When recipient taps the audio link ──

    OWN->>VER: GET /api/audio/{filename}
    Note over VER: Vercel API route fetches from<br/>Supabase Storage using service key<br/>Streams audio back publicly
    VER->>SBS: download(filename)
    SBS-->>VER: audio blob
    VER-->>OWN: audio stream (Content-Type: audio/mp4 or audio/ogg)

    Note over OWN,UI: ── Path C: Skip this reminder ──

    OWN->>UI: taps "Skip this reminder"
    UI->>SB: POST /api/skip (background)<br/>marks skipped=true, skipped_at
    UI-->>OWN: confirmation screen<br/>"Won't remind you again this year"
```

---

## Key Design Decisions

| Decision | Why |
|---|---|
| YAML not a database | Zero infrastructure, version controlled, readable |
| GitHub Actions not a server | Free scheduler, no uptime to manage |
| Supabase token lookup | Stateless URL — no session, no auth needed |
| `window.open` before `await` | iOS Safari blocks popups after async — must open on direct tap |
| Audio proxied through Vercel | Supabase direct URLs blocked by RLS; Vercel URL always public |
| `NEXT_PUBLIC_WARMLY_URL` not `VERCEL_URL` | `VERCEL_URL` = deployment-specific (Vercel-protected); production URL is always public |
| Twilio sandbox → owner only | Recipients must opt-in; fine for personal use; upgrade to WhatsApp Business API for others |
| `audio/ogg` preferred over `audio/webm` | WhatsApp supports ogg + mp4; rejects webm |
| Feedback loop write-back | Mark-sent fires on tap → Supabase → daily sync → sent_log → no duplicates |
| Skip = treated as sent | Skipping a reminder suppresses it the same as sending; sync pulls both |
