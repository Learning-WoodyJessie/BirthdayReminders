"""
tools/calendar.py

Calendar tools: parse dates, calculate days until events, find upcoming occasions.
"""

from datetime import date, datetime
from pathlib import Path
from typing import Iterator
import yaml


def parse_date(value) -> date | None:
    """Accept YYYY-MM-DD or --MM-DD (unknown year) strings."""
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
    """Days until the next occurrence of a month-day event."""
    this_year = event_date.replace(year=today.year)
    if this_year < today:
        this_year = event_date.replace(year=today.year + 1)
    return (this_year - today).days


def age_str(event_date: date, today: date) -> str:
    """Return ' (turning 35)' if birth year is known, else ''."""
    if event_date.year == 1900:
        return ""
    age = today.year - event_date.year
    return f" (turning {age})"


def find_upcoming(people: list[dict], reminder_days: list[int],
                  today: date) -> Iterator[dict]:
    """
    Yield event dicts for every person/occasion that falls within reminder_days.

    Each yielded dict contains:
      person, occasion, event_date, days_away, age_suffix
    """
    for person in people:
        for occasion, raw in [("birthday",    person.get("birthday")),
                               ("anniversary", person.get("anniversary"))]:
            event_date = parse_date(raw)
            if not event_date:
                continue
            days_away = days_until(event_date, today)
            if days_away not in reminder_days:
                continue
            yield {
                "person":     person,
                "occasion":   occasion,
                "event_date": event_date,
                "days_away":  days_away,
                "age_suffix": age_str(event_date, today) if occasion == "birthday" else "",
            }
