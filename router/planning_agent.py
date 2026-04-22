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

PLANNING_PROMPT = """You are a thoughtful personal assistant helping someone send birthday and anniversary messages.

You have the following information about the recipient:

Name:         {name}
Relationship: {relationship}
Occasion:     {occasion}
Notes:        {notes}

Your job: decide if anything in the notes suggests the standard warm message needs adjustment.

Look for signals like:
- Life difficulties (loss, illness, divorce, job loss, grief)
- Recent positive milestones to celebrate (promotion, new baby, new home)
- Relationship tension or estrangement mentioned
- Cultural or religious context that affects tone

Respond in this EXACT format (no other text):
NEEDS_ADJUSTMENT: yes|no
REASON: one sentence explanation (or "none" if no adjustment needed)
INSTRUCTION: specific tone or content instruction for the message writer (or "none")
URGENCY: normal|sensitive|skip

Rules:
- URGENCY=sensitive: send but adjust tone carefully
- URGENCY=skip: this occasion should be skipped (major estrangement or active grief)
- Only say yes to NEEDS_ADJUSTMENT if the notes genuinely indicate something unusual
- When in doubt, return no — the standard approach is usually right
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
          "reason":           str,         # e.g. "going through divorce"
          "instruction":      str | None,  # e.g. "avoid romantic references"
          "urgency":          str,         # "normal" | "sensitive" | "skip"
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
        raw = provider.generate(prompt).strip()
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

    needs = lines.get("NEEDS_ADJUSTMENT", "no").lower() == "yes"
    reason      = lines.get("REASON",      "none")
    instruction = lines.get("INSTRUCTION", "none")
    urgency     = lines.get("URGENCY",     "normal").lower()

    if urgency not in ("normal", "sensitive", "skip"):
        urgency = "normal"

    return {
        "needs_adjustment": needs,
        "reason":           reason,
        "instruction":      instruction if instruction != "none" else None,
        "urgency":          urgency,
    }
