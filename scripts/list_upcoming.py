#!/usr/bin/env python3
"""
list_upcoming.py — preview upcoming events without sending any messages.

Usage:
    python scripts/list_upcoming.py          # next 30 days (default)
    python scripts/list_upcoming.py 60       # next 60 days
    python scripts/list_upcoming.py 365      # full year ahead
"""

import sys
import yaml
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PEOPLE_PATH = ROOT / "data" / "people.yaml"


def parse_date(value) -> date | None:
    if not value:
        return None
    s = str(value).strip()
    if s.startswith("--"):
        s = "1900" + s[1:]
    try:
        return datetime.strptime(s, "%Y-%m-%d").date()
    except ValueError:
        return None


def days_until(event_date: date, today: date) -> int:
    this_year = event_date.replace(year=today.year)
    if this_year < today:
        this_year = event_date.replace(year=today.year + 1)
    return (this_year - today).days


def main():
    window = int(sys.argv[1]) if len(sys.argv) > 1 else 30
    today = date.today()

    with open(PEOPLE_PATH) as f:
        data = yaml.safe_load(f)

    events = []
    for person in data.get("people", []):
        for occasion, raw in [("birthday", person.get("birthday")),
                               ("anniversary", person.get("anniversary"))]:
            d = parse_date(raw)
            if not d:
                continue
            days = days_until(d, today)
            if days <= window:
                events.append((days, person["name"], occasion, person["relationship"]))

    events.sort()

    print(f"\nUpcoming events in the next {window} days (today: {today})\n")
    if not events:
        print("  None.")
        return

    for days, name, occasion, rel in events:
        when = "TODAY" if days == 0 else f"in {days} day{'s' if days != 1 else ''}"
        print(f"  {when:>12}  {name} ({rel}) — {occasion}")
    print()


if __name__ == "__main__":
    main()
