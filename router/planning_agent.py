"""
router/planning_agent.py

LLM-based planning agent for edge cases that rule-based routing can't handle.

The rule-based router handles 95% of cases well:
  - 3 days out → reminder
  - day-of → wish
  - close relationship → warm tone

But some situations require judgment:
  - "Alice is going through a divorce — be careful about the anniversary message"
  - "Bob just lost his job — add an encouraging note"
  - "Carol and I had a falling out — maybe skip this one"

This agent reads the person's notes, asks the LLM whether anything special
is happening, and returns an optional adjustment instruction.

Prompt engineering techniques applied:
  - System/user split: system defines the agent's role; user carries the specific case
  - Chain-of-thought: model reasons step-by-step before committing to a structured answer
  - Temperature: 0.2 — deterministic, structured output (not creative generation)
  - Few-shot: one example showing the reasoning + output format

Design principles:
  1. Only fires when the person has substantial notes (>50 chars).
     No notes → no LLM call → no latency cost.
  2. Returns a simple dict, not instructions for the orchestrator to execute.
     The orchestrator decides what to do with the output.
  3. Always has a graceful fallback — if the agent errors, no_adjustment is returned.
  4. The "skip" urgency is a suggestion, not an order — the orchestrator still
     decides whether to honour it.
"""

from typing import Optional
from prompts.llm import LLMProvider


# ── System prompt — defines the agent's role ──────────────────────────────────

PLANNING_SYSTEM = """\
You are a careful, empathetic personal assistant reviewing notes about someone before \
a birthday or anniversary message is sent to them.

Your only job is to flag situations where the standard warm message would be \
inappropriate, hurtful, or poorly timed — and to suggest a specific adjustment \
when needed.

You are conservative: if in doubt, proceed normally. The standard approach is \
usually right. Only flag something if the notes genuinely indicate it.\
"""


# ── Planning prompt — chain-of-thought before structured output ───────────────

PLANNING_PROMPT = """\
Review the following information about a message recipient before we send them \
a birthday or anniversary message.

[RECIPIENT]
Name:         {name}
Relationship: {relationship}
Occasion:     {occasion}
Notes:        {notes}

[CHAIN OF THOUGHT — reason through this before answering]
Step 1 — Scan for difficulty signals:
  Does the notes mention loss, illness, grief, divorce, job loss, estrangement,
  major conflict, or any situation where a celebratory message would land badly?

Step 2 — Scan for positive signals:
  Is there a recent milestone or achievement worth acknowledging alongside the occasion?

Step 3 — Assess the occasion fit:
  Does the occasion type (birthday vs. anniversary) interact with anything in the notes?
  (e.g. an anniversary message when notes mention a breakup would be actively harmful)

Step 4 — Make the call:
  - Normal: notes don't indicate anything unusual — send standard message
  - Sensitive: something warrants a careful tone adjustment — send but with instruction
  - Skip: notes indicate active grief, estrangement, or the message would cause harm

[EXAMPLE]
Notes: "We had a falling out last year over money. Haven't spoken in 8 months."
Reasoning:
  Step 1: Active estrangement — unresolved conflict mentioned explicitly
  Step 2: No positive signals
  Step 3: Birthday message to someone you're estranged from could reopen tension
  Step 4: Skip — message would likely feel unwelcome given the active estrangement
Output:
NEEDS_ADJUSTMENT: yes
REASON: Active estrangement — unresolved falling out, no contact for 8 months
INSTRUCTION: none
URGENCY: skip

[YOUR TURN]
Work through the steps above for the recipient described, then respond in this \
EXACT format (no other text before or after):

NEEDS_ADJUSTMENT: yes|no
REASON: one sentence (or "none" if no adjustment needed)
INSTRUCTION: specific tone or content instruction for the message writer (or "none")
URGENCY: normal|sensitive|skip

Rules:
- URGENCY=sensitive: send but adjust tone carefully per INSTRUCTION
- URGENCY=skip: do not send — occasion would cause harm or is unwelcome
- Only flag NEEDS_ADJUSTMENT=yes if something genuine is present — when in doubt, say no\
"""


def check_for_special_circumstances(
    person: dict,
    occasion: str,
    provider: LLMProvider,
) -> dict:
    """
    Ask the LLM whether this person's situation needs special message handling.

    Fast path: if notes are short or empty, returns no_adjustment immediately
    without making an LLM call.

    Args:
        person:   person dict from people.yaml
        occasion: "birthday" or "anniversary"
        provider: LLMProvider to use for the check

    Returns:
        {
          "needs_adjustment": bool,
          "reason":           str,
          "instruction":      str | None,
          "urgency":          str,  # "normal" | "sensitive" | "skip"
        }
    """
    notes = (person.get("notes") or "").strip()

    # Fast path — no notes worth analysing
    if len(notes) < 50:
        return _no_adjustment()

    prompt = PLANNING_PROMPT.format(
        name=person["name"],
        relationship=person["relationship"],
        occasion=occasion,
        notes=notes,
    )

    try:
        # Low temperature — we want deterministic structured output, not creativity
        raw = provider.generate(prompt, system=PLANNING_SYSTEM, temperature=0.2).strip()
        return _parse_response(raw)
    except Exception as e:
        print(f"  [planning_agent] check failed for {person['name']}: {e}")
        return _no_adjustment()


def _no_adjustment() -> dict:
    return {
        "needs_adjustment": False,
        "reason":           "none",
        "instruction":      None,
        "urgency":          "normal",
    }


def _parse_response(raw: str) -> dict:
    """
    Parse the structured LLM response into a dict.
    Falls back to no_adjustment on any parse error.
    """
    lines = {
        k.strip(): v.strip()
        for line in raw.splitlines()
        if ":" in line
        for k, v in [line.split(":", 1)]
    }

    needs       = lines.get("NEEDS_ADJUSTMENT", "no").lower() == "yes"
    reason      = lines.get("REASON",           "none")
    instruction = lines.get("INSTRUCTION",      "none")
    urgency     = lines.get("URGENCY",          "normal").lower()

    if urgency not in ("normal", "sensitive", "skip"):
        urgency = "normal"

    return {
        "needs_adjustment": needs,
        "reason":           reason,
        "instruction":      instruction if instruction != "none" else None,
        "urgency":          urgency,
    }
