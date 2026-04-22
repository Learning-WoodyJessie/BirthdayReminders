# From reading to building: a TPM/AI engineer's learning journey

**Subtitle:** How I structured a project to make agentic AI concepts stick —
process, architecture, the four documents I used, and what I'd do differently.

---

I've been reading a lot about agentic AI systems lately. Memory, planning agents,
tool use, feedback loops. Good material. But there's a gap between understanding
something and actually having it.

The only way I've found to close that gap is to build something real with it.

So I picked a genuine problem — I miss birthdays, and when I remember I don't know
what to say — and built it end to end using Claude Code. This post is about the
process as much as the product.

---

## How I approached it — as a TPM and as an engineer

Most side projects start with "what should I build?" I started with three different
questions, wearing two hats.

**As a TPM:**
- What outcome do I actually want? *(never miss a birthday; send something that sounds like me in under 2 minutes)*
- Who is the user? *(me — single user, iPhone, WhatsApp, wants to review before sending)*
- What does done look like? *(concrete metrics, not vibes)*
- What is explicitly out of scope? *(write this down before building)*

**As an AI engineer:**
- What agentic concepts am I trying to learn?
- How does each layer of the system map to a concept?
- What architectural decisions need to be made on day one and never revisited?

That second question — mapping concepts to layers — changed how I designed everything.

---

## Learning objectives drove the architecture

Most side projects choose tech based on familiarity. I chose the architecture based
on what I wanted to understand.

I was trying to make five concepts concrete:

| Concept | Layer I built to learn it |
|---|---|
| Four types of AI memory | Supabase tables: `people` (semantic), `sent_log` (episodic) |
| Router vs. planning agent | `router/message_router.py` (rules) + `router/planning_agent.py` (LLM) |
| Feedback loops | Warmly write-back → Supabase → informs next generation |
| Prompt as product | `prompts/` folder, preferences injection, tone routing |
| Tool use + single responsibility | `tools/` folder, one capability per file |

This made every architectural decision purposeful. I wasn't picking a folder structure
for tidiness — I was building a system where each pillar of agentic AI had a concrete home.

---

## The end-to-end flow — drawn before any code

Before workstreams or tasks, I mapped the full flow. This answered the questions that
matter before you write anything: where does data come from, where does it go, what
are the decision points, where does the human step in?

```
GitHub Actions (7AM PST)
  → find upcoming birthdays and anniversaries
  → route: message type, tone, should send, channel    ← rule-based
  → plan: LLM reads notes, flags anything sensitive    ← judgment-based
  → generate: GPT-4o with past preferences injected
  → send WhatsApp digest with Warmly edit link
  → I tap link → edit message → send to recipient
  → write-back: tone used, context added, message sent ← feedback loop
  → next generation reads this history
```

Workstream breakdown came after this. Tasks came after that.

---

## The folder structure — the highest-leverage early decision

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

data/       → what the system KNOWS
              Supabase: people (semantic memory), sent_log (episodic memory)

scripts/    → orchestration only — no business logic
tests/      → mirrors tools/ and router/ exactly
```

**The rule I enforced:** nothing bleeds into everything else. Tools don't call each other.
The orchestrator calls tools. Prompts don't know about routing. Routing doesn't know
about storage.

Why this compounds: every time I added a layer, I knew exactly where it went.
New channel? Add a tool, update the router. New message type? Touch only `prompts/`.
Swap LLM providers? One line in `config.yaml` — the factory handles the rest.

---

## How the layers built up — and what each one taught

**Layer 1 — Automation** *(Day 1–2)*
GitHub Actions cron, 7AM PST. Taught me: environment secrets, workflow failures,
timezone math, debugging things you can't run locally.

**Layer 2 — Routing** *(Week 1)*
Rule-based router: what message type? What tone? Should I even send?
Taught me: when you don't need an LLM. Finite decisions with clear rules
don't need an agent. A `if/else` that costs nothing beats a $0.02 LLM call.

**Layer 3 — Planning agent** *(Week 1)*
The router can't read someone's notes and decide "they mentioned a recent loss —
maybe dial this back." That's a judgment call. The planning agent is an LLM that
reads the notes and returns a structured recommendation before generation.
Fast path: if notes < 50 characters, skip the agent entirely — no signal, no cost.

**Layer 4 — Memory** *(Week 1)*
Four types, all present in one project:
- Semantic: `people` table — facts that don't change
- Episodic: `sent_log` — what was sent, when, with what tone
- Working: in-RAM state during a single run
- Procedural: the code itself
The taxonomy stopped being abstract the moment I had a concrete implementation for each.

**Layer 5 — Feedback loop** *(Week 2)*
When I tap Send in the web UI, it writes back to Supabase: tone selected, context added,
message sent. The next time a message generates for that person, that history is injected
into the prompt. The system gets better with every send.
I designed this in week two. It should have been week one — it's the core value.

**Layer 6 — Web UI (Warmly)** *(Week 2)*
Next.js, Supabase, dark mobile-first UI. Edit the draft, adjust tone, add a memory,
send via WhatsApp as text or voice note. Taught me: iOS Safari blocks `window.open()`
after any `await`. Pre-generate URLs before async. Open WhatsApp on the direct user tap.

---

## The four documents — how I managed knowledge while building with AI

This is the part most "build in public" posts skip.

When you build with Claude Code, you end up with a lot of context that needs to live
somewhere. I built a four-document system with distinct jobs — no overlap, sustainable
to maintain.

```
Before you build
  /agentic-blueprint  → 6-step framework for structuring any new agentic project
                        Invoke in Claude Code at the start of any project
                        Contains: pillar mapping, folder structure, day-one decisions,
                        feedback loop design, won't-have list, phased plan template

While you build
  CLAUDE.md           → written for Claude, not for me
                        Architecture, constraints, hard-won lessons, what not to touch
                        Claude reads this at the start of every session
                        Updated when architecture changes or lessons are learned

  SKILLS.md           → slash commands for repeatable operations
                        /br-debug, /warmly-deploy, /br-test, /agentic-blueprint
                        Updated when a new operation becomes repeatable

After you build
  LEARNING.md         → written for me, not for Claude
                        Concepts, what made them click, where to apply them next
                        Updated: one entry per session when something clicks
                        Read at the start of the next project
```

**The test for which document an entry belongs in:**

> "Is this helping Claude understand this project,
>  or is this helping me design the next one?"

CLAUDE.md answers the first. LEARNING.md answers the second.
SKILLS.md answers: "what can I invoke to get something done?"
/agentic-blueprint answers: "how do I start?"

**The keeping-current system:**
- After each session: one LEARNING.md entry if something clicked
- When a pattern proves reliable: add it to SKILLS.md
- When architecture changes: update CLAUDE.md before the next session
- At the start of each new project: run /agentic-blueprint, read LEARNING.md

---

## The mid-project pivot — personal to product

Halfway through, the system was working well and I decided to see what it would take
to open it to others. I added full Supabase auth: magic links, middleware, user_id
on every table, RLS policies, login page.

Then I hit email rate limits. Explored four alternative auth approaches over several
sessions. Eventually removed everything and went back to a personal tool.

One week of work produced nothing that shipped.

**The lesson:** the pivot wasn't wrong — it's a valid question. But it needed a trigger
condition, written down on day one:

> "I will consider opening this to others when:
>  it runs unattended for 30 days, I've sent 20+ messages through it,
>  and the feedback loop is working."

Without a trigger, "should this be a product?" becomes an impulse. With one, it's a
decision you've already made — you just check the criteria.

---

## What I'd do differently — honest reflection

**Define graduation criteria on day one**
"Personal tool or product?" answered in the first spec prevents a week of auth rework.

**Metrics before architecture**
I had goals. I didn't have metrics. They're different.

| Metric type | Example |
|---|---|
| Learning | Can I explain the router vs. agent distinction without notes? |
| Build | Runs unattended 30 days. Zero missed birthdays. |
| Quality | No business logic in orchestrators. Tests cover all core logic. |
| Scope | Features explored vs. features shipped per phase. |

**Won't-have list before the backlog**
I explored image generation, Google Photos, Gemini Flash, crypto tipping.
None shipped. A written won't-have list gives you permission to say no in
the moment instead of spending a session on something that gets cut.

**Supabase from day one**
Started with YAML files. Migrated everything when the web UI needed a real DB.
Pure rework. Start with the storage layer you'll actually need.

**One LLM provider, locked**
Switched three times in the first week. The abstraction layer made it cheap —
but indecision still has a cost. Pick one, move on.

**Design the feedback loop in week one**
It's not a feature. It's the mechanism by which the system improves. If it's
an afterthought, the system doesn't learn.

---

## What this process produced

A working system that:
- Runs every morning at 7AM without me thinking about it
- Generates messages that know the person's relationship, history, tone preferences
- Lets me edit, adjust, add context, and send in under two minutes
- Improves slightly with every send via the feedback loop
- Has 138 tests, a CLI dashboard, and a web UI with voice note support

More importantly: the agentic AI concepts I was reading about are now concrete.
Memory types aren't abstract — I have a Supabase table for each one.
The router vs. planning agent distinction isn't theoretical — I built both
and know exactly when each earns its place.

---

All open source: **github.com/Learning-WoodyJessie/BirthdayReminders**

If you're trying to learn agentic AI by building — start from outcomes,
let learning objectives drive architecture, draw the flow before the backlog,
write the won't-have list before the backlog, and decide your graduation
criteria before you write the first line.

The reading makes sense. The building makes it yours.

— [Your name]

---

*Cross-posted from [Substack URL] · Follow on LinkedIn [handle]*
