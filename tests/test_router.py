"""
tests/test_router.py

Tests for router/message_router.py — routing decisions based on timing,
relationship type, and occasion.
"""

import pytest
from datetime import date
from router.message_router import route, _get_message_type, _get_tone, _get_label


# ── message type ──────────────────────────────────────────────────────────────

class TestMessageType:
    def test_day_of_is_wish(self):
        assert _get_message_type(0) == "wish"

    def test_three_days_is_reminder(self):
        assert _get_message_type(3) == "reminder"

    def test_seven_days_is_reminder(self):
        assert _get_message_type(7) == "reminder"


# ── tone ──────────────────────────────────────────────────────────────────────

class TestTone:
    def test_mother_is_warm(self):
        assert _get_tone("mother") == "warm and personal"

    def test_best_friend_is_warm(self):
        assert _get_tone("best friend") == "warm and personal"

    def test_partner_is_warm(self):
        assert _get_tone("partner") == "warm and personal"

    def test_colleague_is_professional(self):
        assert _get_tone("colleague") == "friendly and professional"

    def test_unknown_is_professional(self):
        assert _get_tone("acquaintance") == "friendly and professional"

    def test_case_insensitive(self):
        assert _get_tone("Mother") == "warm and personal"
        assert _get_tone("BEST FRIEND") == "warm and personal"


# ── label ─────────────────────────────────────────────────────────────────────

class TestLabel:
    def test_today_label(self):
        label = _get_label("Sush", "birthday", 0)
        assert "Sush" in label
        assert "TODAY" in label

    def test_three_days_label(self):
        label = _get_label("Sush", "birthday", 3)
        assert "Sush" in label
        assert "3 days" in label

    def test_one_day_label(self):
        label = _get_label("Sush", "anniversary", 1)
        assert "1 day" in label
        assert "days" not in label.replace("1 day", "")  # singular


# ── route (full integration) ──────────────────────────────────────────────────

class TestRoute:
    def _make_person(self, relationship):
        return {"name": "Sush", "relationship": relationship}

    def test_birthday_today_close_relationship(self):
        decision = route(self._make_person("best friend"), "birthday", 0)
        assert decision["message_type"] == "wish"
        assert decision["tone"] == "warm and personal"
        assert "Sush" in decision["label"]
        assert "TODAY" in decision["label"]

    def test_birthday_3_days_professional(self):
        decision = route(self._make_person("colleague"), "birthday", 3)
        assert decision["message_type"] == "reminder"
        assert decision["tone"] == "friendly and professional"

    def test_anniversary_today(self):
        decision = route(self._make_person("partner"), "anniversary", 0)
        assert decision["message_type"] == "wish"
        assert decision["tone"] == "warm and personal"
        assert "anniversary" in decision["label"]


# ── enhanced routing (should_send, channel, urgency) ─────────────────────────

class TestRouteEnhanced:
    """Tests for the three new fields added to route() output."""

    def _make_person(self, relationship="friend", phone=None):
        p = {"name": "Sush", "relationship": relationship}
        if phone is not None:
            p["phone"] = phone
        return p

    def _make_log_entry(self, person_name, occasion, year):
        return {"person_name": person_name, "occasion": occasion, "year": year}

    # ── should_send ───────────────────────────────────────────────────────────

    def test_should_send_true_when_no_history(self):
        decision = route(self._make_person(), "birthday", 3, sent_log=[])
        assert decision["should_send"] is True

    def test_should_send_false_when_already_sent_this_year(self):
        current_year = date.today().year
        log = [self._make_log_entry("Sush", "birthday", current_year)]
        decision = route(self._make_person(), "birthday", 3, sent_log=log)
        assert decision["should_send"] is False

    def test_should_send_true_for_different_occasion(self):
        current_year = date.today().year
        log = [self._make_log_entry("Sush", "birthday", current_year)]
        decision = route(self._make_person(), "anniversary", 3, sent_log=log)
        assert decision["should_send"] is True

    def test_should_send_true_for_last_year_entry(self):
        last_year = date.today().year - 1
        log = [self._make_log_entry("Sush", "birthday", last_year)]
        decision = route(self._make_person(), "birthday", 3, sent_log=log)
        assert decision["should_send"] is True

    # ── channel ───────────────────────────────────────────────────────────────

    def test_channel_warmly_when_phone_present(self):
        person = self._make_person(phone="+14155550001")
        decision = route(person, "birthday", 3, sent_log=[])
        assert decision["channel"] == "warmly"

    def test_channel_digest_only_when_no_phone(self):
        person = self._make_person()  # no phone key
        decision = route(person, "birthday", 3, sent_log=[])
        assert decision["channel"] == "digest_only"

    # ── urgency ───────────────────────────────────────────────────────────────

    def test_urgency_high_when_days_away_zero(self):
        decision = route(self._make_person(), "birthday", 0, sent_log=[])
        assert decision["urgency"] == "high"

    def test_urgency_normal_when_days_away_three(self):
        decision = route(self._make_person(), "birthday", 3, sent_log=[])
        assert decision["urgency"] == "normal"
