"""
tests/test_health.py

Tests for tools/health.py — relationship health tracking.
No disk I/O; sent_log and people lists passed directly.
"""

import pytest
from datetime import date
from tools.health import days_since_last_sent, get_relationship_health, health_summary_text


REF = date(2026, 4, 21)   # fixed reference date for deterministic tests


def _entry(person_name, sent_at=None, year=2026):
    e = {"person_name": person_name, "year": year}
    if sent_at:
        e["sent_at"] = sent_at
    return e


def _person(name, relationship="friend"):
    return {"name": name, "relationship": relationship}


# ── days_since_last_sent ──────────────────────────────────────────────────────

class TestDaysSinceLastSent:
    def test_returns_none_for_no_history(self):
        assert days_since_last_sent("Alice", [], REF) is None

    def test_exact_days_with_timestamp(self):
        log = [_entry("Alice", sent_at="2026-04-11T09:00:00")]
        assert days_since_last_sent("Alice", log, REF) == 10

    def test_uses_most_recent_of_multiple_entries(self):
        log = [
            _entry("Alice", sent_at="2026-01-01T09:00:00"),
            _entry("Alice", sent_at="2026-04-18T09:00:00"),
        ]
        assert days_since_last_sent("Alice", log, REF) == 3

    def test_ignores_other_people(self):
        log = [_entry("Bob", sent_at="2026-04-20T09:00:00")]
        assert days_since_last_sent("Alice", log, REF) is None

    def test_entry_without_sent_at_falls_back_to_year(self):
        # Year 2026 → estimates Jan 1, 2026 → 110 days from Apr 21
        log = [_entry("Alice", year=2026)]
        days = days_since_last_sent("Alice", log, REF)
        assert days is not None
        assert days > 0

    def test_same_day_returns_zero(self):
        log = [_entry("Alice", sent_at="2026-04-21T06:00:00")]
        assert days_since_last_sent("Alice", log, REF) == 0


# ── get_relationship_health ───────────────────────────────────────────────────

class TestGetRelationshipHealth:
    def test_never_status_for_no_history(self):
        people = [_person("Alice")]
        health = get_relationship_health(people, sent_log=[], reference_date=REF)
        assert health[0]["status"] == "never"
        assert health[0]["days_since"] is None
        assert health[0]["send_count"] == 0

    def test_recent_status_within_30_days(self):
        people = [_person("Alice")]
        log    = [_entry("Alice", sent_at="2026-04-15T09:00:00")]
        health = get_relationship_health(people, sent_log=log, reference_date=REF)
        assert health[0]["status"] == "recent"

    def test_ok_status_between_30_and_365(self):
        people = [_person("Alice")]
        log    = [_entry("Alice", sent_at="2026-01-01T09:00:00")]
        health = get_relationship_health(people, sent_log=log, reference_date=REF)
        assert health[0]["status"] == "ok"

    def test_overdue_status_over_365_days(self):
        people = [_person("Alice")]
        log    = [_entry("Alice", sent_at="2025-01-01T09:00:00")]
        health = get_relationship_health(people, sent_log=log, reference_date=REF)
        assert health[0]["status"] == "overdue"

    def test_send_count_correct(self):
        people = [_person("Alice")]
        log    = [_entry("Alice"), _entry("Alice"), _entry("Bob")]
        health = get_relationship_health(people, sent_log=log, reference_date=REF)
        assert health[0]["send_count"] == 2

    def test_never_sorted_first(self):
        people = [_person("Alice"), _person("Bob")]
        log    = [_entry("Bob", sent_at="2026-04-18T00:00:00")]
        health = get_relationship_health(people, sent_log=log, reference_date=REF)
        names = [r["name"] for r in health]
        assert names.index("Alice") < names.index("Bob")

    def test_empty_people_list(self):
        health = get_relationship_health([], sent_log=[], reference_date=REF)
        assert health == []


# ── health_summary_text ───────────────────────────────────────────────────────

class TestHealthSummaryText:
    def test_all_ok_shows_success(self):
        people = [_person("Alice")]
        log    = [_entry("Alice", sent_at="2026-03-01T00:00:00")]
        health = get_relationship_health(people, sent_log=log, reference_date=REF)
        text   = health_summary_text(health)
        assert "✅" in text

    def test_never_shown_in_summary(self):
        health = [{"name": "Alice", "status": "never", "days_since": None}]
        text   = health_summary_text(health)
        assert "Alice" in text
        assert "Never" in text or "never" in text.lower()

    def test_overdue_shown_with_days(self):
        health = [{"name": "Bob", "status": "overdue", "days_since": 400}]
        text   = health_summary_text(health)
        assert "Bob" in text
        assert "400" in text
