"""
router/message_router.py

Decides HOW to handle each event based on timing, relationship, and occasion.
Returns a routing decision that the orchestrator uses to pick the right prompt and delivery.
"""

# Relationships considered "close" — get warmer, more personal tone
CLOSE_RELATIONSHIPS = {
    "mother", "father", "mom", "dad", "sister", "brother",
    "best friend", "partner", "spouse", "husband", "wife",
    "daughter", "son", "grandmother", "grandfather",
}


def route(person: dict, occasion: str, days_away: int) -> dict:
    """
    Decide message type, tone, and digest label for this event.

    Returns:
        {
          "message_type": "reminder" | "wish",
          "tone":         "warm and personal" | "friendly and professional",
          "label":        human-readable label for the digest e.g. "Sush's birthday — TODAY 🎉"
        }
    """
    message_type = _get_message_type(days_away)
    tone         = _get_tone(person["relationship"])
    label        = _get_label(person["name"], occasion, days_away)

    return {
        "message_type": message_type,
        "tone":         tone,
        "label":        label,
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
