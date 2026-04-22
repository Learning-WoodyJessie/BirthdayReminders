#!/usr/bin/env python3
"""
scripts/status.py — Quick health check of BirthdayReminders.

Reads local state only — no API calls, no network, no cost.

Usage:
  python scripts/status.py
  python scripts/status.py --full     # include relationship health detail
"""

import sys
import yaml
import argparse
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from tools.memory      import load_sent_log, RUN_LOG_PATH
from tools.health      import get_relationship_health, health_summary_text
from tools.calendar    import find_upcoming


def load_yaml(path: Path) -> object:
    if not path.exists():
        return None
    with open(path) as f:
        return yaml.safe_load(f)


def main():
    parser = argparse.ArgumentParser(description="BirthdayReminders status check")
    parser.add_argument("--full", action="store_true", help="Show full relationship health table")
    args = parser.parse_args()

    print("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print("  BirthdayReminders — System Status")
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")

    # ── Contacts ──────────────────────────────────────────────────────────────
    data    = load_yaml(ROOT / "data" / "people.yaml") or {}
    people  = data.get("people", [])
    config  = load_yaml(ROOT / "config.yaml") or {}
    print(f"  Contacts:    {len(people)} people in data/people.yaml")

    # ── Upcoming events ───────────────────────────────────────────────────────
    reminder_days = config.get("reminder_days", [3, 0])
    upcoming_30   = find_upcoming(people, list(range(31)), date.today())
    print(f"  Upcoming:    {len(upcoming_30)} event(s) in the next 30 days")
    for ev in upcoming_30[:5]:
        days = ev["days_away"]
        timing = "TODAY" if days == 0 else f"in {days}d"
        print(f"               • {ev['person']['name']} — {ev['occasion']} ({timing})")
    if len(upcoming_30) > 5:
        print(f"               … and {len(upcoming_30) - 5} more")

    # ── Sent log ──────────────────────────────────────────────────────────────
    sent_log = load_sent_log()
    this_year = [e for e in sent_log if e.get("year") == date.today().year]
    print(f"\n  Sent log:    {len(sent_log)} total entries | {len(this_year)} this year")

    # ── Run log ───────────────────────────────────────────────────────────────
    run_log = load_yaml(RUN_LOG_PATH) or []
    if run_log:
        last = run_log[-1]
        ok   = "✅" if last.get("digest_sent") else "❌"
        print(f"  Last run:    {last.get('run_date', '?')}  {ok}  "
              f"found={last.get('events_found', '?')}  "
              f"sent={last.get('events_sent', '?')}  "
              f"skipped={last.get('events_skipped', '?')}")
        print(f"  Total runs:  {len(run_log)}")
    else:
        print("  Last run:    no runs recorded yet")

    # ── LLM config ────────────────────────────────────────────────────────────
    llm = config.get("llm", {})
    provider = llm.get("provider", "openai")
    model    = llm.get("model", "gpt-4o")
    print(f"\n  LLM:         {provider} / {model}")
    print(f"  Schedule:    {', '.join(str(d) for d in reminder_days)} day(s) before + day-of")
    print(f"  Warmly:      https://birthday-reminders-pi.vercel.app")

    # ── Relationship health ───────────────────────────────────────────────────
    health = get_relationship_health(people, sent_log)
    print(f"\n  Relationship health:")
    print(health_summary_text(health))

    if args.full:
        print("\n  ── Full health table ─────────────────────────────────────")
        print(f"  {'Name':<20} {'Relationship':<20} {'Sends':>5} {'Days':>6}  Status")
        print(f"  {'─'*20} {'─'*20} {'─'*5} {'─'*6}  {'─'*8}")
        for r in health:
            days_str  = str(r["days_since"]) if r["days_since"] is not None else "never"
            status_icon = {
                "never": "⚪ never", "overdue": "🔴 overdue",
                "ok": "🟡 ok", "recent": "🟢 recent"
            }.get(r["status"], r["status"])
            print(f"  {r['name']:<20} {r['relationship']:<20} {r['send_count']:>5} "
                  f"{days_str:>6}  {status_icon}")

    print("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")


if __name__ == "__main__":
    main()
