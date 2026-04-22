# Learning Journal

Personal concept journal — what I learned, what made it click, where I'd apply it next.
Not project documentation. Not for Claude. For me.

**How to keep this current:**
- Add an entry when a concept clicks during a build session
- Add a "Refined:" note when the concept deepens in a later project
- Review before starting a new project — pick one concept to go deeper on
- If you can't explain an entry in plain language, rewrite it until you can

---

## How to use this

At the start of a new project: read through entries and pick 1–2 concepts to go deeper on.
At the end of a build session: add one entry for something that clicked.
When a concept evolves: add a `Refined:` line to the existing entry — don't duplicate.

---

## Concepts

---

### Agentic Memory Types

**Learned via:** BirthdayReminders (April 2026)

**The four types:**

| Type | What it stores | How it appears in this project |
|---|---|---|
| Semantic | Timeless facts about the world | `people` table — who someone is, their relationship, birthday, notes |
| Episodic | Timestamped events that happened | `sent_log` — what was sent, when, with what tone and context |
| Working | State that only exists during the current run | The in-RAM list of upcoming events, current message string |
| Procedural | How to do things | The code itself — calendar.py, message_router.py |

**What made it click:**
Realising that `sent_log.yaml` was episodic memory and `people.yaml` was semantic memory — the same concepts from the papers, just concrete. The taxonomy stopped being abstract the moment I had a folder for each one.

**Where I'd apply it next:**
Any new agent project — map each memory type to a concrete storage decision before writing code. Ask: what do I need to remember forever (semantic), what do I need to remember happened (episodic), what do I only need for this session (working)?

---

### Router vs. Planning Agent

**Learned via:** BirthdayReminders (April 2026)

**The distinction:**

| | Rule-based Router | LLM Planning Agent |
|---|---|---|
| When to use | Decision space is finite; rules can be written down | Open-ended judgment; rules can't capture it |
| Example | Tone = warm if relationship is mother/father/sister | Read notes, decide if recent loss means skip this send |
| Cost | Free — pure Python | LLM call — latency + cost |
| Failure mode | Wrong rule = wrong decision | Hallucination = bad recommendation |

**Fast-path pattern:**
Skip the agent entirely when there's not enough signal to act on. In this project: if `notes` < 50 characters, skip the planning agent call. Short notes mean nothing sensitive is being shared — no judgment needed.

**What made it click:**
Building both in the same system. The router handles "what tone?" because tone rules fit in a table. The planning agent handles "should I send at all given these notes?" because no rule can read emotion from free text.

**Where I'd apply it next:**
Start every agentic project with a router. Add a planning agent only when you hit a judgment call the router genuinely can't handle. Don't use an LLM where a `if/else` works.

---

### Feedback Loops

**Learned via:** BirthdayReminders (April 2026)

**The pattern:**
```
User action (send / skip / edit tone)
  → write-back to storage (what tone, what context, what was sent)
  → next generation reads this history via preferences layer
  → system produces a better output next time
```

**Why it matters:**
Without a feedback loop, an AI system is stateless. Every generation starts from scratch. With it, the system learns your preferences over time — not through retraining, but through better context injection.

**The mistake I made:**
Designed this in week three. Should have been week one. The feedback loop is the core value of a system that improves with use. Everything else is scaffolding.

**Implementation rule:**
Fire the write-back on the user action, not on a timer. Fire and forget (`fetch().catch()`) — never block the primary user action on a write-back completing.

**Where I'd apply it next:**
Any system where a human reviews and approves AI output. The review moment is always a signal — capture it.

---

### Prompt as Product

**Learned via:** BirthdayReminders (April 2026)

**The shift:**
Early in the project I treated prompts as implementation details — strings you pass to an API. By the end I treated them as the product. The message quality doubled when I added preferences injection (past tone choices, past context) to the prompt.

**What a prompt actually is:**
The interface between your system's knowledge and the LLM's capability. The more context you inject — relationship, history, tone preferences, occasion, notes — the more personalised the output.

**The preferences injection pattern:**
```python
# build_preferences_section() pulls from sent_log
# and injects into every generate_message() call:

"Previous tone for this person: warmer and more heartfelt"
"Context they added last time: we stayed up all night before finals"
"Don't repeat this message structure: [last message]"
```

**Where I'd apply it next:**
Any project where output quality matters. Before optimising the model or the temperature, optimise what you're injecting. Context beats model choice most of the time.

---

### Folder Structure as Architecture

**Learned via:** BirthdayReminders (April 2026)

**The pattern:**
```
tools/      → what the system can DO (one file per capability, no cross-deps)
prompts/    → what the system can SAY (all LLM interaction lives here)
router/     → HOW it decides (decision logic only, no execution)
data/       → what the system KNOWS (storage layer)
scripts/    → orchestration only (thin, no business logic)
tests/      → mirrors tools/ and router/ exactly
```

**The rule that matters:**
Nothing bleeds into everything else. Tools don't call each other. The orchestrator calls tools. Prompts don't know about routing. Routing doesn't know about storage.

**Why it compounds:**
Every time you add a capability, you know exactly where it goes. Adding voice notes? New tool. New message type? Touch only `prompts/`. New channel? Add a tool, update the router. You never have to read the whole codebase to add a feature.

**Where I'd apply it next:**
Use this as the starting structure for any agentic Python project. Define the folders before the first file.

---

### Personal Tool vs. Product — Graduation Criteria

**Learned via:** BirthdayReminders (April 2026)

**The mistake:**
Built full Supabase auth mid-project (magic links, middleware, user_id scoping on every table, RLS policies, login page) because it felt like the right time to open the app to others. Hit email rate limits. Explored four alternative auth approaches. Removed everything and went back to a personal tool. One week of work produced nothing that shipped.

**The lesson:**
The pivot from personal to product is valid — but it needs a trigger condition defined upfront, not an impulse mid-project.

**The question to answer on day one:**
> "At what point would this be worth opening to others? What would need to be true?"

**Example graduation criteria:**
- Runs unattended for 30 days
- Used by me 20+ times (core loop proven)
- Feedback loop working (system improves with use)
- Someone else asks for access

Define these before you start. When you hit them, do a proper product spec before retrofitting. Don't retrofit incrementally.

**Where I'd apply it next:**
Ask this question at the start of every personal project, even if the answer is "not in this build." Writing it down stops it from becoming an impulse.

---

### iOS Safari and Async

**Learned via:** BirthdayReminders — Warmly web UI (April 2026)

**The rule:**
`window.open()` called after any `await` is silently blocked on iOS Safari. No error. No warning. Just nothing happens.

**The fix:**
```typescript
// ✅ Correct — open WhatsApp BEFORE any async
function sendOnWhatsApp() {
  const url = buildWaUrl(message)  // synchronous
  window.open(url, '_blank')        // fires on direct user tap
  setSent(true)

  fetch('/api/mark-sent', { ... })  // async happens after
    .catch(e => console.error(e))
}

// ❌ Wrong — blocked on iOS
async function sendOnWhatsApp() {
  await fetch('/api/mark-sent', { ... })  // iOS blocks window.open after this
  window.open(url, '_blank')
}
```

**For file uploads with pre-known URLs:**
Generate the filename and public URL before any async. Open the share target synchronously. Upload in background.

**Where I'd apply it next:**
Any mobile web app that opens external URLs (WhatsApp, Maps, App Store, phone dialer) in response to a user action. Always open on the direct tap, never after await.

---

### Metrics for Personal Projects

**Learned via:** BirthdayReminders (April 2026)

**The problem:**
Standard product metrics (DAU, retention, conversion) don't apply to personal projects. "Make concepts stick" is a goal, not a metric. Without concrete metrics, you don't know when you're done.

**Four metric types for personal learning projects:**

| Type | Question | Example |
|---|---|---|
| Learning | Did the concept land? | Can I explain the router vs. agent distinction without notes? |
| Build | Does it work without me? | Runs unattended for 30 days. Zero missed birthdays. |
| Quality | Would I show this to an engineer? | Tests cover all core logic. No business logic in orchestrators. |
| Scope | Did I ship what I planned? | How many features explored vs. shipped per phase? |

**Write these before you start.** They tell you when you're done — which personal projects almost never have.

---

*Last updated: April 2026 — BirthdayReminders project*
*Next review: start of next project*
