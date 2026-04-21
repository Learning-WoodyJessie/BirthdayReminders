# Ripple — Product Requirements Document (PRD)

**Version:** 1.0
**Date:** April 2026
**Owner:** Pavani (Product)
**Status:** Active

---

## Overview
This PRD defines the full feature set for Ripple across all three phases.
Each feature has a phase tag, priority, and module owner.
Features are gated by feature flags — see `core/config.py`.

---

## Phase 1 — MVP ("The Message")

### P1.1 — User Authentication
**Module:** `core/auth`
**Priority:** P0

- Google Sign-In via Clerk
- Apple Sign-In via Clerk
- User profile: name, WhatsApp number, timezone
- No password auth in Phase 1

**Acceptance criteria:**
- User can sign in with Google in < 30 seconds
- WhatsApp number verified via OTP before first use
- Session persists across browser refreshes

---

### P1.2 — Contact Management (Solo Mode)
**Module:** `modules/contacts`
**Priority:** P0

- Add a person: name, relationship, birthday (required), anniversary (optional), notes, phone
- Edit and delete contacts
- List view with upcoming birthdays highlighted
- Import from CSV (name, birthday columns minimum)

**Acceptance criteria:**
- Add a contact in < 30 seconds
- Birthday displayed as "in X days" or "TODAY"
- Notes field: free text, no limit
- Relationship dropdown: mother, father, sister, brother, best friend, partner,
  colleague, cousin, friend (extensible list)

---

### P1.3 — Occasion Engine
**Module:** `modules/occasions`
**Priority:** P0

**Occasion types (Phase 1):**
- Birthday
- Anniversary

**Occasion types (Phase 2, feature flagged):**
- Graduation
- Wedding / Engagement
- Baby Shower
- New Home / Housewarming
- Retirement
- Job promotion
- Custom (user-defined)

**Routing rules:**
| Days Away | Message Type | Delivery |
|---|---|---|
| 3 | Reminder + draft | WhatsApp to owner |
| 0 | Wish (ready to send) | WhatsApp to owner |

**Acceptance criteria:**
- Correct message type triggered at correct timing
- Year-boundary handled correctly (Dec 30 birthday triggered from Jan 1)
- Leap year birthdays (Feb 29) handled gracefully

---

### P1.4 — AI Message Generation
**Module:** `modules/messaging` → `prompts/messages.py`
**Priority:** P0

**Two prompt templates:**
- `REMINDER_TEMPLATE` — 3 days before, heads-up + draft
- `WISH_TEMPLATE` — day-of, ready to copy-paste

**Routing inputs:**
- `relationship` → tone (warm/personal vs friendly/professional)
- `occasion` → language (birthday vs anniversary vs milestone)
- `days_away` → message_type (reminder vs wish)
- `notes` → personalisation context

**Model:** OpenAI GPT-4o

**Acceptance criteria:**
- Message generated in < 5 seconds
- References at least one detail from notes when notes are present
- Tone matches relationship type
- Never repeats previous message (Phase 2: uses sent_log)
- Falls back gracefully if OpenAI is unavailable

---

### P1.5 — WhatsApp Delivery
**Module:** `tools/whatsapp`
**Priority:** P0

- Deliver owner digest via Twilio WhatsApp
- Digest format: date header + one section per event
- Retry once on failure
- Log delivery status

**Acceptance criteria:**
- Message arrives within 60 seconds of scheduled time
- Failed delivery logged and surfaced in dashboard
- No duplicate sends within 24 hours (dedup by ripple_id + date)

---

### P1.6 — Group Mode (Ripple)
**Module:** `modules/group`
**Priority:** P1

- Creator starts a Ripple: person name, occasion, date
- Shareable invite link generated (no login required for contributors)
- Contributors add: text wish + optional photo
- Contributor sees others' wishes (read-only after submitting)
- Creator sees live dashboard: who contributed, who hasn't
- AI weaves all wishes into one unified message on the day
- Creator approves before sending (optional toggle)

**Acceptance criteria:**
- Invite link works without app download or sign-in
- Wish submission < 30 seconds
- AI weave handles 2-20 contributions
- Creator notified when first contribution arrives
- Creator notified 24 hours before delivery if < 3 contributions

---

### P1.7 — Dashboard (UI)
**Module:** `frontend/dashboard`
**Priority:** P1

- Upcoming events (next 30 days) — sorted by date
- Quick-add contact button
- Status per event: "Reminder sent", "Message ready", "Sent"
- Active group ripples — contributor count, days remaining
- Empty state with onboarding prompt

---

## Phase 2 — Complexity ("The Moment")
*All features below are feature-flagged: `FEATURE_MILESTONES`, `FEATURE_REGISTRY`, `FEATURE_GIFTING`*

### P2.1 — Milestone Occasions
**Module:** `modules/occasions` (extended)
**Priority:** P0 for Phase 2

- Add milestone occasion types (graduation, wedding, baby, retirement, etc.)
- Milestone occasions always default to Group Mode
- Milestone-specific prompt templates
- Custom occasion type (user-defined label)

---

### P2.2 — Registry Link
**Module:** `modules/registry`
**Priority:** P0 for Phase 2

- Attach any URL to a milestone ripple (Amazon wishlist, Zola, any link)
- Displayed to contributors alongside wish submission
- No Ripple infrastructure needed — just a link

**Acceptance criteria:**
- URL validated (reachable)
- Displayed as clickable card with favicon + title preview
- Contributor can add wish without clicking registry (optional)

---

### P2.3 — Gift Pool
**Module:** `modules/gifting`
**Priority:** P1 for Phase 2

- Creator sets target amount (e.g. $150)
- Contributors choose custom contribution amount
- Stripe Checkout for payment (no Ripple wallet)
- Progress bar: "$90 of $150 collected"
- Creator sees contributor list + amounts
- Ripple takes 2.5% platform fee
- Funds released to creator after occasion date

**Acceptance criteria:**
- Stripe Connect onboarding for creator < 5 minutes
- Contributor payment in < 60 seconds
- Refund policy: full refund if ripple cancelled 48+ hours before date
- Tax/receipt emailed automatically by Stripe

---

### P2.4 — Freemium Paywall
**Module:** `core/billing`
**Priority:** P1 for Phase 2

```
Free Tier:
  - Up to 5 contacts
  - Solo mode only
  - Birthday + Anniversary only
  - WhatsApp delivery

Pro ($6.99/month):
  - Unlimited contacts
  - Solo + Group mode
  - All occasion types
  - Registry + Gift pool
  - Message history (no repeats)
  - Priority AI generation
```

---

### P2.5 — Notification System
**Module:** `modules/reminders` (extended)
**Priority:** P1 for Phase 2

- Email reminders (via Resend) as fallback to WhatsApp
- Contributor nudges: "3 days left to add your wish to Sarah's ripple"
- Creator nudges: "Only 2 people have contributed — remind your group?"
- User controls notification preferences per channel

---

### P2.6 — Message History & Voice
**Module:** `modules/messaging` (extended)
**Priority:** P2 for Phase 2

- Log every generated + sent message per person per year
- Feed history into prompt: "You sent X last year — write something different"
- Voice profiling: onboarding quiz captures user's natural style
- Style ratings: after sending, rate the message → AI refines

---

## Phase 3 — Scale ("The Platform")
*Feature flagged: `FEATURE_TEAMS`, `FEATURE_MOBILE`, `FEATURE_MARKETPLACE`*

### P3.1 — Ripple for Teams (B2B)
**Module:** `modules/teams`
- Company admin account
- Bulk import employees (CSV / HRIS integration)
- Auto-ripple on birthdays + work anniversaries
- Slack + Teams integration for delivery
- Pricing: $3/employee/month (min 10 seats)

### P3.2 — Native Mobile Apps
- React Native (iOS + Android)
- Reuses all API modules — zero backend changes
- Push notifications replace WhatsApp for in-app users

### P3.3 — Gift Marketplace
- Curated gift suggestions via AI based on relationship + notes
- Partner integrations: Amazon, Airbnb Experiences, Uber Eats
- Ripple earns 5-8% affiliate commission

### P3.4 — Multilingual
- AI generates messages in user's preferred language
- UI translated into top 10 languages

---

## Non-Functional Requirements

### Performance
- Page load < 2 seconds (Vercel edge)
- Message generation < 5 seconds
- WhatsApp delivery < 60 seconds of scheduled time

### Security
- All secrets in environment variables (never in code)
- No PII in logs
- HTTPS everywhere
- Stripe handles all payment data (no card data touches Ripple servers)

### Privacy
- GDPR compliant — data deletion on request
- No selling user data
- Users own their data

### Reliability
- Scheduled job retry on failure (max 3 attempts)
- Dedup: never send twice in same day for same event
- Delivery status logged for every message

---

## Open Questions
1. Should contributors need to sign in for group mode, or anonymous? (Lean: anonymous for MVP)
2. Should creator approve AI-woven message before delivery? (Lean: optional toggle)
3. WhatsApp vs SMS for delivery — which is primary? (Current: WhatsApp via Twilio sandbox)
4. How do we handle the same person being in multiple users' contact lists?
5. What happens if the birthday person is also a Ripple user — do they see the ripple?

---

## Dependencies
| Dependency | Used for | Phase |
|---|---|---|
| OpenAI GPT-4o | Message generation | 1 |
| Twilio | WhatsApp delivery | 1 |
| Clerk | Authentication | 1 |
| Supabase | Database | 1 |
| Vercel | Frontend hosting | 1 |
| Railway / Render | Backend hosting | 1 |
| Stripe | Gift pools + subscriptions | 2 |
| Resend | Email notifications | 2 |
| Mux | Video contributions | 2 |
| React Native | Mobile apps | 3 |
