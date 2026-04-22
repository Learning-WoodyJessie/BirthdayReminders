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
from tools.memory          import load_sent_log, sync_sent_log_from_supabase, append_run_log
from prompts.messages      import generate_message
from prompts.llm           import get_provider
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

    # ── sync sent_log from Supabase (feedback loop) ──────────────────────────
    print("── Syncing sent log from Supabase…")
    synced = sync_sent_log_from_supabase()
    if synced:
        print(f"   ↳ Merged {synced} new sent record(s) into sent_log.yaml")

    # ── load sent log + LLM provider ─────────────────────────────────────────
    sent_log = load_sent_log()
    provider = get_provider(config)

    digest_parts: list[str] = []
    events_found   = 0
    events_skipped = 0
    events_sent    = 0

    for event in find_upcoming(data.get("people", []), reminder_days, today):
        person    = event["person"]
        occasion  = event["occasion"]
        days_away = event["days_away"]
        age       = event["age_suffix"]
        events_found += 1

        print(f"\n→ {person['name']}: {occasion}{age} — "
              f"{'TODAY' if days_away == 0 else f'in {days_away} days'}")

        # ── router decides message type + tone ────────────────────────────────
        decision = route(person, occasion, days_away, sent_log=sent_log)

        # ── skip if already sent this year ────────────────────────────────────
        if not decision["should_send"]:
            print(f"   ↳ Skipping — already sent {occasion} message to "
                  f"{person['name']} this year.")
            events_skipped += 1
            continue

        # ── generate message via prompt layer ─────────────────────────────────
        message = generate_message(
            person       = person,
            occasion     = occasion,
            days_away    = days_away,
            message_type = decision["message_type"],
            tone         = decision["tone"],
            provider     = provider,
        )

        # ── store in Supabase, get Warmly edit link ───────────────────────────
        warmly_link = create_warmly_link(person, occasion, message)

        # ── build digest section ──────────────────────────────────────────────
        section = f"{decision['label']}\n\n{message}"
        if warmly_link:
            section += f"\n\n✏️ *Personalise & send:*\n{warmly_link}"
        digest_parts.append(section)
        events_sent += 1

    # ── send digest ───────────────────────────────────────────────────────────
    if not digest_parts:
        print("\nNo reminders for today.")
        append_run_log({
            "run_date":            today.isoformat(),
            "events_found":        events_found,
            "events_skipped":      events_skipped,
            "events_sent":         events_sent,
            "synced_from_supabase": synced,
            "digest_sent":         False,
        })
        return

    separator   = "\n\n" + "─" * 28 + "\n\n"
    full_digest = (
        f"🗓 *Reminders — {today.strftime('%B %d, %Y')}*\n\n"
        + separator.join(digest_parts)
    )

    print("\n── Sending digest ──")
    ok = send_whatsapp(my_number, full_digest, label="digest")

    # ── write run log ─────────────────────────────────────────────────────────
    append_run_log({
        "run_date":             today.isoformat(),
        "events_found":         events_found,
        "events_skipped":       events_skipped,
        "events_sent":          events_sent,
        "synced_from_supabase": synced,
        "digest_sent":          ok,
    })

    if not ok:
        sys.exit(1)


if __name__ == "__main__":
    main()
