"""
router/message_router.py

Decides HOW to handle each event based on timing, relationship, and occasion.
Returns a routing decision that the orchestrator uses to pick the right prompt and delivery.
"""

from typing import Optional

from tools.memory import already_sent_this_year

# Relationships considered "close" — get warmer, more personal tone
CLOSE_RELATIONSHIPS = {
    "mother", "father", "mom", "dad", "sister", "brother",
    "best friend", "partner", "spouse", "husband", "wife",
    "daughter", "son", "grandmother", "grandfather",
}


def route(person: dict, occasion: str, days_away: int,
          sent_log: Optional[list] = None) -> dict:
    """
    Decide message type, tone, and digest label for this event.

    Args:
        person:    person dict from people.yaml
        occasion:  "birthday" or "anniversary"
        days_away: days until the event (0 = today)
        sent_log:  pre-loaded sent log list (or None to load from disk)

    Returns:
        {
          "message_type": "reminder" | "wish",
          "tone":         "warm and personal" | "friendly and professional",
          "label":        human-readable label for the digest e.g. "Sush's birthday — TODAY 🎉",
          "should_send":  bool — False if already sent this year,
          "channel":      "warmly" | "digest_only",
          "urgency":      "high" | "normal",
        }
    """
    message_type = _get_message_type(days_away)
    tone         = _get_tone(person["relationship"])
    label        = _get_label(person["name"], occasion, days_away)
    should_send  = _should_send(person["name"], occasion, sent_log)
    channel      = _get_channel(person)
    urgency      = _get_urgency(days_away)

    return {
        "message_type": message_type,
        "tone":         tone,
        "label":        label,
        "should_send":  should_send,
        "channel":      channel,
        "urgency":      urgency,
    }


def _get_message_type(days_away: int) -> str:
    """0 = day-of wish, anything else = advance reminder."""
    return "wish" if days_away == 0 else "reminder"


def _get_tone(relationship: str) -> str:
    """Map relationship to prompt tone."""
    if relationship.lower().strip() in CLOSE_RELATIONSHIPS:
        return "warm and personal"
    return "friendly and professional"


def _get_label(name: str, occasion: str, days_away: int) -> str:
    """Human-readable label for the WhatsApp digest."""
    timing = "TODAY 🎉" if days_away == 0 else f"in {days_away} day{'s' if days_away != 1 else ''}"
    return f"*{name}*'s {occasion} — {timing}"


def _should_send(person_name: str, occasion: str,
                 sent_log: Optional[list] = None) -> bool:
    """Return False if a message was already sent for this person+occasion this year."""
    return not already_sent_this_year(person_name, occasion, sent_log)


def _get_channel(person: dict) -> str:
    """Return 'warmly' when the person has a phone number, 'digest_only' otherwise."""
    phone = person.get("phone")
    if phone and str(phone).strip():
        return "warmly"
    return "digest_only"


def _get_urgency(days_away: int) -> str:
    """Return 'high' for day-of events, 'normal' otherwise."""
    return "high" if days_away == 0 else "normal"
