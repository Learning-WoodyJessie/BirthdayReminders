#!/usr/bin/env python3
"""
check_reminders.py — core daily script.

Reads data/people.yaml, finds upcoming birthdays/anniversaries within
configured reminder windows, generates a personalised Claude message,
and:
  1. Sends you (the owner) a WhatsApp digest with all upcoming events.
  2. On day-of, sends a direct WhatsApp message to the person (if phone set).
  3. On day-of, posts to any WhatsApp groups listed for that person.
"""

import os
import sys
import yaml
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONFIG_PATH = ROOT / "config.yaml"
PEOPLE_PATH = ROOT / "data" / "people.yaml"


# ── helpers ──────────────────────────────────────────────────────────────────

def load_yaml(path: Path) -> dict:
    with open(path) as f:
        return yaml.safe_load(f)


def days_until(event_date: date, today: date) -> int:
    """Days until the next occurrence of a month-day event."""
    this_year = event_date.replace(year=today.year)
    if this_year < today:
        this_year = event_date.replace(year=today.year + 1)
    return (this_year - today).days


def parse_date(value) -> date | None:
    """Accept YYYY-MM-DD or --MM-DD strings."""
    if not value:
        return None
    s = str(value).strip()
    if s.startswith("--"):
        s = "1900" + s[1:]
    try:
        return datetime.strptime(s, "%Y-%m-%d").date()
    except ValueError:
        return None


def age_str(event_date: date, today: date) -> str:
    if event_date.year == 1900:
        return ""
    age = today.year - event_date.year
    return f" (turning {age})"


# ── Claude message generation ─────────────────────────────────────────────────

def generate_message(person: dict, occasion: str, days_away: int,
                     audience: str = "direct") -> str:
    """
    audience:
      "owner"  — reminder to you, framed as 'don't forget…'
      "direct" — message to send directly to the person
      "group"  — message suitable for a WhatsApp group
    """
    from openai import OpenAI

    key = os.environ.get("OPENAI_API_KEY", "").strip().strip('"').strip("'")
    if not key:
        raise ValueError("OPENAI_API_KEY is empty or missing")
    client = OpenAI(api_key=key)

    timing = (
        "today is their special day" if days_away == 0
        else f"their {occasion} is in {days_away} day{'s' if days_away != 1 else ''}"
    )

    audience_instructions = {
        "owner": (
            "Write a short reminder for the sender (2-3 sentences). "
            "Remind them the occasion is coming up and include a ready-to-send message they can copy."
        ),
        "direct": (
            "Write a warm, personal WhatsApp message to send DIRECTLY to this person (2-4 sentences). "
            "Address them by first name. Sound genuine and human, not corporate. "
            "Reference specific details from the notes where natural."
        ),
        "group": (
            "Write a cheerful WhatsApp group message celebrating this person (2-3 sentences). "
            "Address the person by first name. Keep it warm, upbeat, and inclusive for a group setting. "
            "No hashtags."
        ),
    }

    prompt = f"""You are helping someone send a heartfelt WhatsApp message.

Person: {person['name']}
Relationship: {person['relationship']}
Occasion: {occasion}
Timing: {timing}
Notes: {person.get('notes') or 'none provided'}

{audience_instructions[audience]}
Match the warmth/formality to the relationship. No excessive emojis. Sound human."""

    response = client.chat.completions.create(
        model="gpt-4o",
        max_tokens=300,
        messages=[{"role": "user", "content": prompt}]
    )
    return response.choices[0].message.content.strip()


# ── WhatsApp sending ──────────────────────────────────────────────────────────

def send_whatsapp(to: str, message: str, label: str = "") -> bool:
    """Send a WhatsApp message via Twilio."""
    from twilio.rest import Client

    account_sid = os.environ["TWILIO_ACCOUNT_SID"]
    auth_token  = os.environ["TWILIO_AUTH_TOKEN"]
    from_number = os.environ["TWILIO_FROM"]   # e.g. +14155238886 (sandbox) or your Twilio number

    client = Client(account_sid, auth_token)
    tag = f"[{label}] " if label else ""
    try:
        msg = client.messages.create(
            from_=f"whatsapp:{from_number}",
            to=f"whatsapp:{to}",
            body=message,
        )
        print(f"  {tag}✓ Sent to {to} (sid: {msg.sid})")
        return True
    except Exception as e:
        print(f"  {tag}✗ Error sending to {to}: {e}", file=sys.stderr)
        return False


# ── main ─────────────────────────────────────────────────────────────────────

def main():
    today = date.today()
    config = load_yaml(CONFIG_PATH)
    data = load_yaml(PEOPLE_PATH)

    reminder_days: list[int] = config.get("reminder_days", [7, 3, 0])
    my_number: str = os.environ.get("MY_WHATSAPP") or config.get("my_whatsapp", "")

    if not my_number:
        print("ERROR: MY_WHATSAPP not set. Add it as a GitHub Secret.", file=sys.stderr)
        sys.exit(1)

    people = data.get("people", [])
    digest_parts: list[str] = []
    errors: list[str] = []

    for person in people:
        name = person["name"]

        for occasion, raw_date in [("birthday", person.get("birthday")),
                                   ("anniversary", person.get("anniversary"))]:
            event_date = parse_date(raw_date)
            if not event_date:
                continue

            days_away = days_until(event_date, today)
            if days_away not in reminder_days:
                continue

            age = age_str(event_date, today) if occasion == "birthday" else ""
            print(f"\n→ {name}: {occasion}{age} — {'TODAY' if days_away == 0 else f'in {days_away} days'}")

            # 1. Generate owner reminder message
            owner_msg = generate_message(person, occasion, days_away, audience="owner")
            label = (
                f"*{name}*'s {occasion}{age} — "
                + ("TODAY 🎉" if days_away == 0 else f"in {days_away} day{'s' if days_away != 1 else ''}")
            )
            digest_parts.append(f"{label}\n\n{owner_msg}")

    # ── Send owner digest ──
    if not digest_parts:
        print("\nNo reminders for today.")
        return

    separator = "\n\n" + "─" * 28 + "\n\n"
    full_digest = (
        f"🗓 *Reminders — {today.strftime('%B %d, %Y')}*\n\n"
        + separator.join(digest_parts)
    )

    print("\n── Sending owner digest ──")
    send_whatsapp(my_number, full_digest, label="digest")

    if errors:
        print("\nErrors encountered:", file=sys.stderr)
        for e in errors:
            print(f"  • {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
