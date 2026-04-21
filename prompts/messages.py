"""
prompts/messages.py

Prompt templates and message generation.
Two message types:
  - "reminder"  : sent 3 days before — heads-up + draft to prepare
  - "wish"      : sent on the day    — actual ready-to-copy-paste message
"""

import os
from openai import OpenAI


# ── Prompt templates ──────────────────────────────────────────────────────────

REMINDER_TEMPLATE = """You are helping someone prepare a heartfelt WhatsApp message for an upcoming occasion.

Person:       {name}
Relationship: {relationship}
Occasion:     {occasion} — in {days_away} days
Notes:        {notes}
Tone:         {tone}

Write a short reminder (2-3 sentences) for the sender:
1. Alert them the occasion is coming up in {days_away} days
2. Include a warm, ready-to-send draft message they can copy and send on the day
Match the tone to the relationship. No hashtags. Sound human."""


WISH_TEMPLATE = """You are helping someone send a heartfelt WhatsApp message today.

Person:       {name}
Relationship: {relationship}
Occasion:     {occasion} — TODAY
Notes:        {notes}
Tone:         {tone}

Write the actual wish message (2-4 sentences) ready to copy and send RIGHT NOW.
Address them by first name. Reference specific details from notes where natural.
Match the tone to the relationship. No hashtags. Sound human, not corporate."""


# ── Template selector ─────────────────────────────────────────────────────────

def get_template(message_type: str) -> str:
    templates = {
        "reminder": REMINDER_TEMPLATE,
        "wish":     WISH_TEMPLATE,
    }
    if message_type not in templates:
        raise ValueError(f"Unknown message_type: {message_type!r}. Use 'reminder' or 'wish'.")
    return templates[message_type]


# ── Generator ─────────────────────────────────────────────────────────────────

def generate_message(person: dict, occasion: str, days_away: int,
                     message_type: str, tone: str) -> str:
    """
    Generate a personalised message using OpenAI GPT-4o.

    Args:
        person:       person dict from people.yaml
        occasion:     "birthday" or "anniversary"
        days_away:    0 = today, 3 = in 3 days
        message_type: "reminder" or "wish"
        tone:         e.g. "warm and personal" or "friendly and professional"
    """
    client = OpenAI(api_key=os.environ["OPENAI_API_KEY"].strip())

    template = get_template(message_type)
    prompt = template.format(
        name=person["name"],
        relationship=person["relationship"],
        occasion=occasion,
        days_away=days_away,
        notes=person.get("notes") or "none provided",
        tone=tone,
    )

    response = client.chat.completions.create(
        model="gpt-4o",
        max_tokens=300,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.choices[0].message.content.strip()
