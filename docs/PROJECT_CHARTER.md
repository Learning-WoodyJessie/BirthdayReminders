# Ripple — Project Charter

## Vision
**"Make every important moment feel personal, even when life gets busy."**

Ripple is an AI-powered celebration platform that helps people remember, express,
and coordinate around the moments that matter — birthdays, anniversaries, graduations,
and life milestones. It starts with the message. The magic is in making it feel
like *you* said it.

---

## Problem Statement
As people get older and busier, relationships suffer not from lack of care but
lack of time and bandwidth. The result:
- Important occasions are forgotten or acknowledged with a generic "HBD!"
- Group coordination for gifts happens over chaotic WhatsApp threads
- AI tools exist but produce generic, impersonal messages
- No single product connects the reminder → message → group coordination → gifting loop

**The gap:** Tools tell you *when*. Nobody helps you say *what* — meaningfully.

---

## Solution
Ripple has two modes:

**Solo Mode**
You add people you care about. Ripple reminds you 3 days before with a
personalised draft. On the day, it sends you the perfect ready-to-send message,
written in a tone that matches your relationship.

**Group Mode (Ripple)**
One person starts a Ripple — an event page where friends contribute wishes,
memories, and photos. AI weaves everything into one unified message. For
milestone occasions (graduation, wedding, retirement), a gift pool or registry
link can be attached. No WhatsApp coordination chaos.

---

## Target Users

### Primary (Phase 1)
- **The Thoughtful But Busy Professional** — 28-45 years old, genuinely cares
  about relationships, but life gets in the way. Wants to be the person who
  always remembers. Currently fails 30% of the time.

### Secondary (Phase 2)
- **The Coordinator** — the person in every friend group who organises everything.
  Currently does this over WhatsApp. Desperately needs a better tool.

### B2B (Phase 3)
- **HR / People Ops teams** — responsible for employee recognition. Birthdays,
  work anniversaries, milestone moments. Currently using spreadsheets.

---

## What Ripple Is NOT
- ❌ A generic reminder app (iOS Birthdays, Facebook)
- ❌ A gifting marketplace (Amazon, Etsy)
- ❌ A social network (no public feeds, no likes)
- ❌ A mass messaging tool
- ❌ A CRM for sales

---

## Success Metrics

### Phase 1 (MVP)
| Metric | Target |
|---|---|
| Ripples created | 100 in first month |
| Group participants per ripple | 5+ average |
| D7 retention | > 40% |
| NPS | > 60 |
| Messages rated "felt personal" | > 80% |

### Phase 2
| Metric | Target |
|---|---|
| MAU | 1,000 |
| Pro conversion | > 8% |
| MRR | $1,000 |
| Gift pools created | 50/month |

### Phase 3
| Metric | Target |
|---|---|
| MAU | 50,000 |
| MRR | $25,000 |
| B2B customers | 20 companies |
| Gift pool GMV | $100K/month |

---

## Team & Roles
| Role | Responsibility |
|---|---|
| Product (Pavani) | Vision, prioritisation, user research |
| AI/Backend | Claude Code — tools, prompts, router, API |
| Frontend | Claude Code — Next.js UI |
| Design | TBD — Figma mockups |
| Growth | TBD — Phase 2 |

---

## Guiding Principles
1. **Message first** — the AI message is the product. Everything else supports it.
2. **Modular by design** — every feature is a module, independently shippable.
3. **Occasion-appropriate** — gifting only on milestones. Never push money on everyday moments.
4. **Personal not automated** — every message should feel like the sender wrote it.
5. **Zero friction** — if it takes more than 30 seconds to start, we've failed.

---

## Constraints
- **Budget:** Minimal — use free tiers where possible (Vercel, Supabase, Clerk)
- **Timeline:** Phase 1 MVP in 8 weeks
- **Stack:** Python (FastAPI) backend, Next.js frontend — no scope creep on tech
- **Compliance:** GDPR-friendly — no selling user data, clear data deletion

---

## Risks & Mitigations
| Risk | Mitigation |
|---|---|
| WhatsApp delivery restrictions | Twilio sandbox for MVP; production template approval in Phase 2 |
| AI messages feel generic | Voice profiling in onboarding; user feedback loop |
| Low group participation | Email + WhatsApp nudges to contributors |
| Gifting complexity | Phase 2 only; registry link (zero infra) first |
| Competition (generic reminders) | Moat = personalisation + group coordination |
