"""
tests/test_planning_agent.py

Tests for router/planning_agent.py — LLM-based edge case detection.
LLM calls are mocked; no network, no cost.
"""

import pytest
from unittest.mock import MagicMock
from router.planning_agent import (
    check_for_special_circumstances,
    _no_adjustment,
    _parse_response,
)


def _provider(response_text: str):
    """Create a mock LLMProvider that returns response_text."""
    mock = MagicMock()
    mock.generate.return_value = response_text
    return mock


def _person(name="Alice", relationship="best friend", notes=""):
    return {"name": name, "relationship": relationship, "notes": notes}


# ── _no_adjustment ────────────────────────────────────────────────────────────

class TestNoAdjustment:
    def test_returns_expected_shape(self):
        result = _no_adjustment()
        assert result["needs_adjustment"] is False
        assert result["urgency"] == "normal"
        assert result["instruction"] is None

    def test_reason_is_none_string(self):
        assert _no_adjustment()["reason"] == "none"


# ── _parse_response ───────────────────────────────────────────────────────────

class TestParseResponse:
    def _valid(self, needs="yes", reason="going through divorce",
               instruction="avoid romance", urgency="sensitive"):
        return (
            f"NEEDS_ADJUSTMENT: {needs}\n"
            f"REASON: {reason}\n"
            f"INSTRUCTION: {instruction}\n"
            f"URGENCY: {urgency}"
        )

    def test_parses_yes(self):
        result = _parse_response(self._valid("yes"))
        assert result["needs_adjustment"] is True

    def test_parses_no(self):
        result = _parse_response(self._valid("no"))
        assert result["needs_adjustment"] is False

    def test_reason_captured(self):
        result = _parse_response(self._valid(reason="lost job recently"))
        assert result["reason"] == "lost job recently"

    def test_instruction_captured(self):
        result = _parse_response(self._valid(instruction="be extra encouraging"))
        assert result["instruction"] == "be extra encouraging"

    def test_instruction_none_string_becomes_python_none(self):
        result = _parse_response(self._valid(instruction="none"))
        assert result["instruction"] is None

    def test_urgency_normal(self):
        result = _parse_response(self._valid(urgency="normal"))
        assert result["urgency"] == "normal"

    def test_urgency_sensitive(self):
        result = _parse_response(self._valid(urgency="sensitive"))
        assert result["urgency"] == "sensitive"

    def test_urgency_skip(self):
        result = _parse_response(self._valid(urgency="skip"))
        assert result["urgency"] == "skip"

    def test_invalid_urgency_defaults_to_normal(self):
        result = _parse_response(self._valid(urgency="extreme"))
        assert result["urgency"] == "normal"


# ── check_for_special_circumstances ──────────────────────────────────────────

class TestCheckForSpecialCircumstances:
    def test_fast_path_for_empty_notes(self):
        person = _person(notes="")
        result = check_for_special_circumstances(person, "birthday", _provider(""))
        assert result["needs_adjustment"] is False

    def test_fast_path_for_short_notes(self):
        person = _person(notes="Loves hiking")   # < 50 chars
        result = check_for_special_circumstances(person, "birthday", _provider(""))
        assert result["needs_adjustment"] is False

    def test_llm_called_for_long_notes(self):
        long_notes = "Alice is going through a difficult divorce and has been struggling a lot lately with her emotions."
        person   = _person(notes=long_notes)
        provider = _provider(
            "NEEDS_ADJUSTMENT: yes\n"
            "REASON: going through divorce\n"
            "INSTRUCTION: avoid romantic references, focus on friendship\n"
            "URGENCY: sensitive"
        )
        result = check_for_special_circumstances(person, "anniversary", provider)
        provider.generate.assert_called_once()
        assert result["needs_adjustment"] is True
        assert result["urgency"] == "sensitive"

    def test_no_adjustment_returned_when_llm_says_no(self):
        long_notes = "Alice loves hiking, cooking Italian food, and is obsessed with her two cats Biscuit and Mochi."
        person   = _person(notes=long_notes)
        provider = _provider(
            "NEEDS_ADJUSTMENT: no\n"
            "REASON: none\n"
            "INSTRUCTION: none\n"
            "URGENCY: normal"
        )
        result = check_for_special_circumstances(person, "birthday", provider)
        assert result["needs_adjustment"] is False

    def test_graceful_fallback_on_provider_error(self):
        long_notes = "Alice has been through a lot recently. Her father passed away last month and she is grieving deeply."
        person   = _person(notes=long_notes)
        provider = MagicMock()
        provider.generate.side_effect = Exception("API timeout")
        result = check_for_special_circumstances(person, "birthday", provider)
        assert result["needs_adjustment"] is False   # safe fallback
        assert result["urgency"] == "normal"

    def test_skip_urgency_parsed_correctly(self):
        long_notes = "Bob and I had a serious falling out six months ago. We are not on speaking terms and I feel this anniversary message would be very unwelcome."
        person   = _person(name="Bob", notes=long_notes)
        provider = _provider(
            "NEEDS_ADJUSTMENT: yes\n"
            "REASON: serious estrangement\n"
            "INSTRUCTION: none\n"
            "URGENCY: skip"
        )
        result = check_for_special_circumstances(person, "anniversary", provider)
        assert result["urgency"] == "skip"
