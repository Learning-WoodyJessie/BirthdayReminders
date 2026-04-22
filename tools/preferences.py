"""
tools/preferences.py

Derives semantic preferences from the episodic sent_log.

The sent_log is raw history (what happened + when). Preferences are the
timeless facts we infer from that history — e.g. "the owner tends to add
nostalgic context" or "they preferred the warmer tone for close friends".

These are injected into the prompt by generate_message() so that future
messages get progressively better without the owner having to re-explain
their style each time.
"""

from collections import Counter
from typing import Optional

from tools.memory import load_sent_log


# ── Per-person preferences ────────────────────────────────────────────────────

def get_person_preferences(
    person_name: str,
    sent_log: Optional[list] = None,
) -> dict:
    """
    Return preference signals derived from past sends to this specific person.

    Returns:
        {
          "send_count":     int,          # total times messaged this person
          "preferred_tone": str | None,   # most-used tone button, if any
          "last_tone":      str | None,   # most recent tone selection
          "past_contexts":  list[str],    # context snippets the owner previously added
        }
    """
    if sent_log is None:
        sent_log = load_sent_log()

    entries = [e for e in sent_log if e.get("person_name") == person_name]

    tones    = [e["tone_selected"]  for e in entries if e.get("tone_selected")]
    contexts = [e["context_added"]  for e in entries if e.get("context_added")]

    preferred_tone = Counter(tones).most_common(1)[0][0] if tones else None

    return {
        "send_count":     len(entries),
        "preferred_tone": preferred_tone,
        "last_tone":      tones[-1] if tones else None,
        "past_contexts":  contexts,
    }


# ── Overall owner style ───────────────────────────────────────────────────────

def get_overall_preferences(sent_log: Optional[list] = None) -> dict:
    """
    Return aggregate preference signals across all sent messages.

    Returns:
        {
          "total_sends":          int,
          "preferred_tone":       str | None,
          "personalisation_rate": float,   # 0.0–1.0 — how often context is added
          "most_common_contexts": list[str],  # up to 3 most-used context snippets
        }
    """
    if sent_log is None:
        sent_log = load_sent_log()

    tones    = [e["tone_selected"] for e in sent_log if e.get("tone_selected")]
    contexts = [e["context_added"] for e in sent_log if e.get("context_added")]

    personalisation_rate = len(contexts) / len(sent_log) if sent_log else 0.0
    preferred_tone       = Counter(tones).most_common(1)[0][0] if tones else None

    return {
        "total_sends":          len(sent_log),
        "preferred_tone":       preferred_tone,
        "personalisation_rate": round(personalisation_rate, 2),
        "most_common_contexts": contexts[-3:],   # last 3, most recent first
    }


# ── Prompt section builder ────────────────────────────────────────────────────

def build_preferences_section(
    person_name: str,
    sent_log: Optional[list] = None,
) -> str:
    """
    Returns a formatted string to inject into the LLM prompt when past history
    exists for this person.  Returns empty string when there is no history.

    Example output:
        Past message history with Alice:
        - You have sent 2 birthday messages before.
        - Your preferred tone: warmer and more heartfelt
        - Personal context you added previously:
            • "We stayed up all night before our finals and laughed the whole time"
    """
    prefs = get_person_preferences(person_name, sent_log)

    if prefs["send_count"] == 0:
        return ""

    lines = [f"Past message history with {person_name}:"]
    count = prefs["send_count"]
    lines.append(f"- You have sent {count} message{'s' if count != 1 else ''} before.")

    if prefs["preferred_tone"]:
        lines.append(f"- Your preferred tone: {prefs['preferred_tone']}")

    if prefs["past_contexts"]:
        lines.append("- Personal context you added previously (use as inspiration, not verbatim):")
        for ctx in prefs["past_contexts"]:
            lines.append(f'    • "{ctx}"')

    return "\n".join(lines)
