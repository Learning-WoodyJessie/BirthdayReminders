# From reading to building: a TPM/AI engineer's learning journey

**Subtitle:** How I structured a project to make agentic AI concepts stick —
starting minimal, adding layers deliberately, and what I'd do differently.

---

I've been reading a lot about agentic AI systems. Memory, planning agents, tool use,
feedback loops. Good material. But there's a gap between understanding something and
actually having it.

The only way I've found to close that gap is to build something real with it.

So I picked a genuine problem — I miss birthdays, and when I remember I don't know
what to say — and built it end to end using Claude Code. This post is about the
process as much as the product.

---

## How I approached it — as a TPM and as an engineer

Before writing a line of code, I put on two hats.

**As a TPM:**
- What outcome do I actually want?
  *Never miss a birthday. Send something that sounds like me in under 2 minutes.*
- Who is the user?
  *Me — single person, iPhone, WhatsApp, wants to review every message before it goes out.*
- What does done look like?
  *Concrete metrics, not vibes — more on this later.*
- What is explicitly out of scope?
  *Write this down before building, or scope will find you mid-session.*

**As an AI engineer:**
- What agentic concepts am I trying to learn?
- How does each layer of the system map to one of those concepts?
- What architectural decisions need to be made on day one and locked?

That second question changed everything. I didn't choose the architecture and then
find concepts in it — I chose the concepts and designed the architecture to match.

---

## Layer 1 — Start with the minimal agentic flow

The first rule I set: **build the smallest thing that does the actual job before
adding anything else.**

Not the smartest thing. Not the most extensible thing. The minimum that works.

Here's what Layer 1 looked like — the entire system in one diagram:

```
GitHub Actions (7AM PST daily)
  → read contacts from people.yaml
  → find who has a birthday or anniversary coming up
  → call GPT-4o: "write a warm WhatsApp message for {name}"
  → send digest to my WhatsApp via Twilio
```

That's it. Four steps. No router. No planning agent. No web UI. No feedback loop.
Just a cron job that reads a file, calls an API, and sends a message.

**Why start here?**

Because this is the core agentic loop: *observe → reason → act*. Everything else
is a layer on top of this loop. If the loop doesn't work, nothing else matters.

**What Layer 1 taught me:**
- GitHub Actions secrets: repository-level only, never environment secrets —
  learned by debugging empty env vars in production
- Timezone math: `OPENAI_API_KEY` works locally but the Actions runner is UTC.
  7AM PST = 15:00 UTC. Get this wrong and messages arrive at 3AM.
- Debugging without a REPL: when you can only observe outputs in CI logs,
  you learn to write clearly structured print statements fast

**What I resisted adding in Layer 1:**
Everything else. The planning agent, the web UI, the preferences system —
all of it was explicitly parked until the core loop ran unattended for a week.

This discipline is the hardest part. The temptation to add features before
the foundation is proven is constant. Resist it.

---

## The folder structure — designed on day one to stay extensible

Before Layer 2, I designed the folder structure. Not the code — the structure.
Because the folders are the architecture, and architecture is hard to change later.

```
tools/      → what the system can DO
              calendar.py    — date math, days until, find upcoming
              whatsapp.py    — send via Twilio
              memory.py      — load/write sent log, sync from Supabase
              preferences.py — pull past tone + context, inject into prompts
              health.py      — relationship health (never/overdue/ok/recent)

prompts/    → what the system can SAY
              messages.py    — REMINDER_TEMPLATE, WISH_TEMPLATE, generate_message()
              llm.py         — LLMProvider (abstract), OpenAIProvider, AnthropicProvider,
                               get_provider(config) factory

router/     → HOW it decides
              message_router.py  — rule-based: tone, channel, urgency, should_send
              planning_agent.py  — LLM-based: read notes, decide if adjustment needed

data/       → what the system KNOWS (Supabase tables, not flat files)
scripts/    → orchestration only — no business logic lives here
warmly/     → Next.js web UI (added in Layer 6)
tests/      → mirrors tools/ and router/ exactly
```

**The rule I enforced:** nothing bleeds into everything else. Tools don't call
each other. The orchestrator calls tools. Prompts don't know about routing.

**Why this compounds:** every layer I added had an obvious home. New capability?
New tool. New message type? Touch only `prompts/`. Swap LLM providers? One line
in `config.yaml`. The folder structure made adding layers cheap.

---

## Layers 2–6 — each one maps to a concept

Once Layer 1 ran cleanly for a week, I added one layer at a time.
Each layer was chosen because it mapped to a concept I wanted to make concrete.

---

**Layer 2 — Routing** *(the router pillar)*

The first version called GPT-4o with the same prompt for everyone.
A message to your mother and a message to a colleague came out the same.

I added a rule-based router: what tone should this message have? Should I send
at all — or was it already sent this year? What type of message — a 3-day heads-up
or a day-of wish?

```
route() → message_type, tone, should_send, channel, urgency
```

**What this taught me:** the boundary between rule-based and LLM-based decisions.
Tone is a finite decision — it fits in a lookup table. An `if/else` that costs
nothing beats a $0.02 LLM call for decisions with clear rules.

---

**Layer 3 — Planning agent** *(judgment vs. rules)*

The router can't read someone's notes and decide:
*"They mentioned a recent loss — maybe dial this back."*

That's a judgment call — exactly what rules can't handle.

I added a planning agent: an LLM that reads the person's notes before generation
and returns a structured recommendation. Should we proceed normally? Adjust the tone?
Skip entirely?

```
check_for_special_circumstances() → needs_adjustment, reason, instruction, urgency
```

**Fast path:** if notes are under 50 characters, skip the agent entirely.
No signal in the notes = no judgment needed = no LLM cost.

**What this taught me:** planning agents handle open-ended judgment.
Routers handle finite decisions. Build the router first. Add the agent only
when you hit a case the router genuinely can't handle.

---

**Layer 4 — Memory** *(four types, all concrete)*

Once the system was running, I mapped the four memory types from the papers
to actual implementations:

| Type | Definition | Implementation |
|---|---|---|
| Semantic | Timeless facts | `people` table — who someone is, their relationship, birthday |
| Episodic | Timestamped events | `sent_log` — what was sent, when, with what tone |
| Working | Current run state | In-RAM list of upcoming events during a single run |
| Procedural | How to do things | The code itself — calendar.py, message_router.py |

**What this taught me:** abstract concepts become concrete when you have to
implement them. I now think in memory types when I design any new system.

---

**Layer 5 — Feedback loop** *(how the system improves with use)*

After I sent a message through Warmly, the system forgot it happened.
The next generation started from scratch — no memory of what tone I used,
what context I added, whether the message landed well.

I added a write-back: every time I tap Send, it fires a background POST
to Supabase logging the tone I chose, the context I added, and the message sent.
The next generation for that person injects this history into the prompt.

```
User taps Send
  → window.open(WhatsApp)        — synchronous, on direct tap
  → POST /api/mark-sent [bg]     — fire and forget
      → logs: tone_selected, context_added, message_sent
      → next generation reads this history
```

**What this taught me:** design the feedback loop in week one.
It's not a feature — it's the mechanism by which the system improves.
I built it in week three. That was two weeks of worse outputs I didn't need.

---

**Layer 6 — Web UI (Warmly)** *(human in the loop)*

The system was useful but fragile: one delivery channel (WhatsApp digest),
no way to edit, no way to act without waiting for the daily cron.

I built Warmly in Next.js: a mobile-first page where I can read the draft,
adjust tone, add a personal memory, and send to WhatsApp — as text or a voice note.

**Hard-won lesson:** iOS Safari silently blocks `window.open()` after any `await`.
Pre-generate all URLs before async. Open WhatsApp on the direct user tap.
Upload anything in the background after.

**What this taught me:** the human-in-the-loop layer isn't just UX.
It's where the feedback loop closes — the write-back only exists because
there's a review moment to capture.

---

## Prompt engineering — what I improved after the layers were in place

Once the system was working, I went back and upgraded all the prompts using
techniques I'd been skipping:

**System / user message split**
The model's role (who it is) separated from the task (what to do right now).
Previously everything was in one user message — the model had no persistent
context about its job.

**Few-shot examples**
Three examples per template: warm/personal (sister), friendly/professional
(colleague), warm/personal (anniversary). Examples anchor output quality
more reliably than longer instructions.

**Chain-of-thought**
For wish messages and the planning agent: the model now reasons through
relationship → notes → tone before writing.
"What does this relationship suggest? Is there anything in the notes worth
referencing? What would make this feel personal?" — then the message.

**Temperature control**
- Message generation: `0.8` — enough creativity for natural variation
- Planning agent: `0.2` — deterministic, consistent structured output

**Explicit negative constraints**
Banned by name: "Hope this finds you well", "Wishing you all the best",
"May your day be filled with", "Hey [Name]!". The model still generated
these until I named them explicitly.

---

## The four documents — managing knowledge while building with AI

This is the part most build-in-public posts skip.

When you're building with Claude Code across multiple sessions, context needs
to live somewhere. I built a four-document system with distinct jobs:

```
Before you build
  /agentic-blueprint     6-step framework for structuring any new agentic project
                         Run this in Claude Code at the start of any project

While you build
  CLAUDE.md              Written for Claude — architecture, constraints,
                         hard-won lessons, what not to touch
                         Claude reads this every session

  SKILLS.md              Slash commands for repeatable operations
                         /br-debug, /warmly-deploy, /br-test
                         Updated when an operation becomes reliably repeatable

After you build
  LEARNING.md            Written for me — concepts, what made them click,
                         where to apply them next
                         One entry per session when something clicks
                         Read at the start of the next project
```

**The test for where something belongs:**

> "Is this helping Claude understand this project?
>  Or is this helping me design the next one?"

CLAUDE.md answers the first. LEARNING.md answers the second.

**The keeping-current ritual:**
- End of each session: one LEARNING.md entry if a concept clicked
- When a pattern proves reliable: add it to SKILLS.md
- When architecture changes: update CLAUDE.md before the next session
- Start of next project: run /agentic-blueprint, read LEARNING.md

Small updates per session. Never a big rewrite at the end.

---

## The mid-project pivot — personal to product

Halfway through, the system was working well and I decided to see what it
would take to open it to others. I added full Supabase auth: magic links,
middleware, user_id on every table, RLS policies, login page, auth callback.

Then I hit email rate limits. Explored four alternative auth approaches.
Eventually removed everything and went back to a personal tool.

One week of work produced nothing that shipped.

**The lesson:** the pivot wasn't wrong — it's a valid question to ask.
But it needed a trigger condition, written down on day one:

> "I will consider opening this to others when:
>  it runs unattended for 30 days, I've sent 20+ messages,
>  and the feedback loop is working."

Without a trigger, "should this be a product?" is an impulse.
With one, it's a decision you've already made — you just check the criteria.

---

## What I'd do differently

**Define graduation criteria on day one**
"Personal tool or product?" answered in the first spec prevents a week of rework.

**Write metrics before architecture**

| Type | Example |
|---|---|
| Learning | Can I explain the router vs. agent distinction without notes? |
| Build | Runs unattended 30 days. Zero missed birthdays. |
| Quality | No business logic in orchestrators. All core logic tested. |
| Scope | Features explored vs. shipped per phase. |

"Make concepts stick" is a goal. "Can explain all four memory types to a colleague"
is a metric. Write the metrics version.

**Won't-have list before the backlog**
I explored image generation, Google Photos, Gemini Flash, crypto tipping.
None shipped. A written won't-have list gives you permission to say no
in the moment instead of spending a session on something that gets cut.

**Supabase from day one**
Started with YAML files. Migrated when the web UI needed a real DB.
Pure rework. Start with the storage layer you'll actually need.

**Design the feedback loop in week one**
Not week three. It's not a feature — it's what makes the system improve.

---

## What this process produced

A working system that:
- Runs every morning at 7AM without me thinking about it
- Generates messages that know the person's relationship, history, tone preferences
- Lets me edit, adjust, add context, and send in under two minutes
- Gets slightly better with every send via the feedback loop
- Has 138 tests, a CLI dashboard, and a web UI with voice note support

More importantly: the agentic AI concepts I was reading about are now concrete.
I didn't just read about memory types — I have a Supabase table for each one.
I didn't just read about routers vs. planning agents — I built both and know
exactly when each earns its place.

All open source: **github.com/Learning-WoodyJessie/BirthdayReminders**

---

If you're trying to learn agentic AI by building:

1. Start with the minimal flow that does the actual job
2. Let it run. Prove it works before adding anything
3. Add one layer at a time, each mapped to a concept you want to learn
4. Design the folder structure before the code
5. Build the feedback loop early — it's the mechanism, not a feature
6. Write the won't-have list before the backlog

The reading makes sense. The building makes it yours.

— [Your name]

---
*All code: github.com/Learning-WoodyJessie/BirthdayReminders*
*Follow on [LinkedIn] · [Substack]*
