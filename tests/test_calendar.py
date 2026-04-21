"""
tests/test_calendar.py

Tests for tools/calendar.py — date parsing, days_until, age_str, find_upcoming.
"""

import pytest
from datetime import date
from tools.calendar import parse_date, days_until, age_str, find_upcoming


# ── parse_date ────────────────────────────────────────────────────────────────

class TestParseDate:
    def test_full_date(self):
        d = parse_date("1990-07-22")
        assert d == date(1990, 7, 22)

    def test_unknown_year(self):
        d = parse_date("--07-22")
        assert d.month == 7
        assert d.day == 22
        assert d.year == 1900

    def test_none_returns_none(self):
        assert parse_date(None) is None

    def test_empty_string_returns_none(self):
        assert parse_date("") is None

    def test_invalid_returns_none(self):
        assert parse_date("not-a-date") is None

    def test_integer_input(self):
        # YAML sometimes parses dates as integers — should still work
        d = parse_date("2000-01-15")
        assert d == date(2000, 1, 15)


# ── days_until ────────────────────────────────────────────────────────────────

class TestDaysUntil:
    def test_same_day(self):
        today = date(2026, 4, 21)
        event = date(1990, 4, 21)
        assert days_until(event, today) == 0

    def test_tomorrow(self):
        today = date(2026, 4, 21)
        event = date(1990, 4, 22)
        assert days_until(event, today) == 1

    def test_three_days(self):
        today = date(2026, 4, 21)
        event = date(1990, 4, 24)
        assert days_until(event, today) == 3

    def test_year_boundary(self):
        # Event is Jan 1, today is Dec 30 — should be 2 days away
        today = date(2026, 12, 30)
        event = date(1990, 1, 1)
        assert days_until(event, today) == 2

    def test_past_date_this_year_wraps_to_next_year(self):
        today = date(2026, 4, 21)
        event = date(1990, 1, 15)  # already passed this year
        result = days_until(event, today)
        assert result > 0  # should be next year's occurrence


# ── age_str ───────────────────────────────────────────────────────────────────

class TestAgeStr:
    def test_known_year_returns_turning(self):
        event = date(1990, 4, 21)
        today = date(2026, 4, 21)
        assert age_str(event, today) == " (turning 36)"

    def test_unknown_year_returns_empty(self):
        event = date(1900, 4, 21)  # dummy year for --MM-DD
        today = date(2026, 4, 21)
        assert age_str(event, today) == ""


# ── find_upcoming ─────────────────────────────────────────────────────────────

class TestFindUpcoming:
    def _make_person(self, birthday, anniversary=None, name="Test Person",
                     relationship="friend"):
        return {
            "name": name,
            "relationship": relationship,
            "birthday": birthday,
            "anniversary": anniversary,
            "notes": None,
            "phone": None,
            "groups": [],
        }

    def test_finds_birthday_today(self):
        today = date(2026, 4, 21)
        people = [self._make_person("--04-21")]
        events = list(find_upcoming(people, [3, 0], today))
        assert len(events) == 1
        assert events[0]["occasion"] == "birthday"
        assert events[0]["days_away"] == 0

    def test_finds_birthday_in_3_days(self):
        today = date(2026, 4, 21)
        people = [self._make_person("--04-24")]
        events = list(find_upcoming(people, [3, 0], today))
        assert len(events) == 1
        assert events[0]["days_away"] == 3

    def test_skips_birthday_not_in_window(self):
        today = date(2026, 4, 21)
        people = [self._make_person("--05-15")]  # 24 days away
        events = list(find_upcoming(people, [3, 0], today))
        assert len(events) == 0

    def test_finds_anniversary(self):
        today = date(2026, 4, 21)
        people = [self._make_person("--01-01", anniversary="2010-04-21")]
        events = list(find_upcoming(people, [3, 0], today))
        assert any(e["occasion"] == "anniversary" for e in events)

    def test_both_birthday_and_anniversary_same_day(self):
        today = date(2026, 4, 21)
        people = [self._make_person("--04-21", anniversary="2010-04-21")]
        events = list(find_upcoming(people, [3, 0], today))
        assert len(events) == 2

    def test_multiple_people(self):
        today = date(2026, 4, 21)
        people = [
            self._make_person("--04-21", name="Alice"),
            self._make_person("--04-24", name="Bob"),
            self._make_person("--06-01", name="Carol"),  # not in window
        ]
        events = list(find_upcoming(people, [3, 0], today))
        names = [e["person"]["name"] for e in events]
        assert "Alice" in names
        assert "Bob" in names
        assert "Carol" not in names

    def test_null_birthday_skipped(self):
        today = date(2026, 4, 21)
        people = [self._make_person(None)]
        events = list(find_upcoming(people, [3, 0], today))
        assert len(events) == 0
