"""
tests/test_preferences.py

Tests for tools/preferences.py — deriving preferences from sent_log.
No disk I/O: sent_log is passed directly to each function.
"""

import pytest
from datetime import date
from tools.preferences import (
    get_person_preferences,
    get_overall_preferences,
    build_preferences_section,
)

CURRENT_YEAR = date.today().year


def _entry(person_name, occasion="birthday", tone=None, context=None):
    e = {"person_name": person_name, "occasion": occasion, "year": CURRENT_YEAR}
    if tone:    e["tone_selected"]  = tone
    if context: e["context_added"]  = context
    return e


# ── get_person_preferences ────────────────────────────────────────────────────

class TestGetPersonPreferences:
    def test_empty_log_returns_zeroes(self):
        prefs = get_person_preferences("Alice", sent_log=[])
        assert prefs["send_count"] == 0
        assert prefs["preferred_tone"] is None
        assert prefs["last_tone"] is None
        assert prefs["past_contexts"] == []

    def test_counts_sends_for_correct_person(self):
        log = [_entry("Alice"), _entry("Alice"), _entry("Bob")]
        prefs = get_person_preferences("Alice", sent_log=log)
        assert prefs["send_count"] == 2

    def test_preferred_tone_is_most_common(self):
        log = [
            _entry("Alice", tone="warmer and more heartfelt"),
            _entry("Alice", tone="warmer and more heartfelt"),
            _entry("Alice", tone="funnier and more playful"),
        ]
        prefs = get_person_preferences("Alice", sent_log=log)
        assert prefs["preferred_tone"] == "warmer and more heartfelt"

    def test_last_tone_is_most_recent_entry(self):
        log = [
            _entry("Alice", tone="warmer and more heartfelt"),
            _entry("Alice", tone="funnier and more playful"),
        ]
        prefs = get_person_preferences("Alice", sent_log=log)
        assert prefs["last_tone"] == "funnier and more playful"

    def test_past_contexts_collected(self):
        log = [
            _entry("Alice", context="We laughed all night"),
            _entry("Alice", context="That trip to Paris"),
        ]
        prefs = get_person_preferences("Alice", sent_log=log)
        assert "We laughed all night" in prefs["past_contexts"]
        assert "That trip to Paris"   in prefs["past_contexts"]

    def test_does_not_include_other_people(self):
        log = [_entry("Bob", context="Bob's memory")]
        prefs = get_person_preferences("Alice", sent_log=log)
        assert prefs["send_count"] == 0
        assert prefs["past_contexts"] == []

    def test_entries_without_tone_ignored_for_preferred(self):
        log = [_entry("Alice")]   # no tone_selected
        prefs = get_person_preferences("Alice", sent_log=log)
        assert prefs["preferred_tone"] is None

    def test_entries_without_context_ignored(self):
        log = [_entry("Alice")]   # no context_added
        prefs = get_person_preferences("Alice", sent_log=log)
        assert prefs["past_contexts"] == []


# ── get_overall_preferences ───────────────────────────────────────────────────

class TestGetOverallPreferences:
    def test_empty_log(self):
        prefs = get_overall_preferences(sent_log=[])
        assert prefs["total_sends"] == 0
        assert prefs["preferred_tone"] is None
        assert prefs["personalisation_rate"] == 0.0

    def test_total_sends_counted(self):
        log = [_entry("Alice"), _entry("Bob"), _entry("Carol")]
        prefs = get_overall_preferences(sent_log=log)
        assert prefs["total_sends"] == 3

    def test_personalisation_rate_calculated(self):
        log = [
            _entry("Alice", context="Some memory"),
            _entry("Bob"),    # no context
            _entry("Carol", context="Another memory"),
        ]
        prefs = get_overall_preferences(sent_log=log)
        assert prefs["personalisation_rate"] == round(2 / 3, 2)

    def test_most_common_contexts_capped_at_3(self):
        log = [_entry("A", context=f"ctx {i}") for i in range(6)]
        prefs = get_overall_preferences(sent_log=log)
        assert len(prefs["most_common_contexts"]) == 3

    def test_preferred_tone_most_frequent(self):
        log = [
            _entry("Alice", tone="warmer and more heartfelt"),
            _entry("Bob",   tone="warmer and more heartfelt"),
            _entry("Carol", tone="funnier and more playful"),
        ]
        prefs = get_overall_preferences(sent_log=log)
        assert prefs["preferred_tone"] == "warmer and more heartfelt"


# ── build_preferences_section ─────────────────────────────────────────────────

class TestBuildPreferencesSection:
    def test_empty_when_no_history(self):
        result = build_preferences_section("Alice", sent_log=[])
        assert result == ""

    def test_includes_person_name(self):
        log = [_entry("Alice")]
        result = build_preferences_section("Alice", sent_log=log)
        assert "Alice" in result

    def test_includes_send_count(self):
        log = [_entry("Alice"), _entry("Alice")]
        result = build_preferences_section("Alice", sent_log=log)
        assert "2" in result

    def test_includes_preferred_tone(self):
        log = [_entry("Alice", tone="warmer and more heartfelt")]
        result = build_preferences_section("Alice", sent_log=log)
        assert "warmer and more heartfelt" in result

    def test_includes_past_context(self):
        log = [_entry("Alice", context="We stayed up all night")]
        result = build_preferences_section("Alice", sent_log=log)
        assert "We stayed up all night" in result

    def test_empty_for_different_person(self):
        log = [_entry("Bob", tone="funnier and more playful")]
        result = build_preferences_section("Alice", sent_log=log)
        assert result == ""

    def test_no_preferred_tone_line_when_none(self):
        log = [_entry("Alice")]  # no tone
        result = build_preferences_section("Alice", sent_log=log)
        assert "preferred tone" not in result

    def test_no_context_section_when_none(self):
        log = [_entry("Alice", tone="warmer and more heartfelt")]
        result = build_preferences_section("Alice", sent_log=log)
        assert "inspiration" not in result
