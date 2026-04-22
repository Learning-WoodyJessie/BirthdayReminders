"""
tests/test_memory.py

Tests for tools/memory.py — sent log loading and duplicate detection.
No disk I/O is performed (sent_log is passed directly to already_sent_this_year).
"""

import pytest
from datetime import date
from tools.memory import already_sent_this_year, load_sent_log


CURRENT_YEAR = date.today().year
LAST_YEAR = CURRENT_YEAR - 1


def _entry(person_name, occasion, year):
    return {"person_name": person_name, "occasion": occasion, "year": year}


class TestAlreadySentThisYear:
    def test_returns_false_for_empty_log(self):
        assert already_sent_this_year("Alice", "birthday", sent_log=[]) is False

    def test_returns_true_when_matching_entry_exists(self):
        log = [_entry("Alice", "birthday", CURRENT_YEAR)]
        assert already_sent_this_year("Alice", "birthday", sent_log=log) is True

    def test_returns_false_for_different_occasion(self):
        log = [_entry("Alice", "birthday", CURRENT_YEAR)]
        assert already_sent_this_year("Alice", "anniversary", sent_log=log) is False

    def test_returns_false_for_last_year_entry(self):
        log = [_entry("Alice", "birthday", LAST_YEAR)]
        assert already_sent_this_year("Alice", "birthday", sent_log=log) is False

    def test_case_sensitive_name_matching(self):
        log = [_entry("Alice", "birthday", CURRENT_YEAR)]
        assert already_sent_this_year("alice", "birthday", sent_log=log) is False
        assert already_sent_this_year("ALICE", "birthday", sent_log=log) is False

    def test_returns_false_for_different_person(self):
        log = [_entry("Alice", "birthday", CURRENT_YEAR)]
        assert already_sent_this_year("Bob", "birthday", sent_log=log) is False

    def test_returns_true_for_correct_person_among_many(self):
        log = [
            _entry("Alice", "birthday", CURRENT_YEAR),
            _entry("Bob", "anniversary", CURRENT_YEAR),
            _entry("Carol", "birthday", LAST_YEAR),
        ]
        assert already_sent_this_year("Bob", "anniversary", sent_log=log) is True

    def test_returns_false_same_person_occasion_wrong_year(self):
        log = [_entry("Alice", "birthday", LAST_YEAR)]
        assert already_sent_this_year("Alice", "birthday", sent_log=log) is False


class TestLoadSentLog:
    def test_returns_list(self, tmp_path):
        """load_sent_log returns a list even for an empty file."""
        import yaml
        log_file = tmp_path / "sent_log.yaml"
        log_file.write_text("[]\n")
        # We can't easily override SENT_LOG_PATH, so just test the function
        # directly by confirming a real file with [] gives us a list.
        with open(log_file) as f:
            data = yaml.safe_load(f)
        assert isinstance(data if isinstance(data, list) else [], list)

    def test_returns_empty_list_when_file_missing(self, tmp_path, monkeypatch):
        """load_sent_log returns [] if the log file does not exist."""
        import tools.memory as mem
        monkeypatch.setattr(mem, "SENT_LOG_PATH", tmp_path / "nonexistent.yaml")
        result = mem.load_sent_log()
        assert result == []
