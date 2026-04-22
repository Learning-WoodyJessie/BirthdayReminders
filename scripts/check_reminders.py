#!/usr/bin/env python3
"""
scripts/check_reminders.py — thin orchestrator.

Load resources → find events → route → generate → store in Supabase
→ include Warmly edit link → send digest.
"""

import os
import sys
import yaml
from datetime import datetime
from datetime import date
from pathlib import Path
from zoneinfo import ZoneInfo

# ── project imports ───────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from tools.calendar        import find_upcoming
from tools.whatsapp        import send_whatsapp
from tools.warmly          import create_warmly_link
from prompts.messages      import generate_message
from router.message_router import route


# ── load resources ────────────────────────────────────────────────────────────

def load_yaml(path: Path) -> dict:
    with open(path) as f:
        return yaml.safe_load(f)


# ── main ──────────────────────────────────────────────────────────────────────

def main():
    today  = datetime.now(ZoneInfo("America/Los_Angeles")).date()
    config = load_yaml(ROOT / "config.yaml")
    data   = load_yaml(ROOT / "data" / "people.yaml")

    reminder_days: list[int] = config.get("reminder_days", [3, 0])
    my_number: str = os.environ.get("MY_WHATSAPP", "").strip()

    if not my_number:
        print("ERROR: MY_WHATSAPP not set.", file=sys.stderr)
        sys.exit(1)

    digest_parts: list[str] = []

    for event in find_upcoming(data.get("people", []), reminder_days, today):
        person    = event["person"]
        occasion  = event["occasion"]
        days_away = event["days_away"]
        age       = event["age_suffix"]

        print(f"\n→ {person['name']}: {occasion}{age} — "
              f"{'TODAY' if days_away == 0 else f'in {days_away} days'}")

        # ── router decides message type + tone ────────────────────────────────
        decision = route(person, occasion, days_away)

        # ── generate message via prompt layer ─────────────────────────────────
        message = generate_message(
            person       = person,
            occasion     = occasion,
            days_away    = days_away,
            message_type = decision["message_type"],
            tone         = decision["tone"],
        )

        # ── store in Supabase, get Warmly edit link ───────────────────────────
        warmly_link = create_warmly_link(person, occasion, message)

        # ── build digest section ──────────────────────────────────────────────
        section = f"{decision['label']}\n\n{message}"
        if warmly_link:
            section += f"\n\n✏️ *Personalise & send:*\n{warmly_link}"
        digest_parts.append(section)

    # ── send digest ───────────────────────────────────────────────────────────
    if not digest_parts:
        print("\nNo reminders for today.")
        return

    separator   = "\n\n" + "─" * 28 + "\n\n"
    full_digest = (
        f"🗓 *Reminders — {today.strftime('%B %d, %Y')}*\n\n"
        + separator.join(digest_parts)
    )

    print("\n── Sending digest ──")
    ok = send_whatsapp(my_number, full_digest, label="digest")
    if not ok:
        sys.exit(1)


if __name__ == "__main__":
    main()
