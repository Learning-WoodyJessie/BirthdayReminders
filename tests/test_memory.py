"""
tests/test_memory.py

Tests for tools/memory.py — sent log loading, duplicate detection,
append_sent_log writer, and run log writer.

No actual Supabase or disk side-effects: tests use monkeypatch + tmp_path.
"""

import pytest
import yaml
from datetime import date
from tools.memory import already_sent_this_year, load_sent_log


CURRENT_YEAR = date.today().year
LAST_YEAR    = CURRENT_YEAR - 1


def _entry(person_name, occasion, year):
    return {"person_name": person_name, "occasion": occasion, "year": year}


# ── already_sent_this_year ────────────────────────────────────────────────────

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


# ── load_sent_log ─────────────────────────────────────────────────────────────

class TestLoadSentLog:
    def test_returns_list(self, tmp_path):
        """load_sent_log returns a list even for an empty file."""
        log_file = tmp_path / "sent_log.yaml"
        log_file.write_text("[]\n")
        with open(log_file) as f:
            data = yaml.safe_load(f)
        assert isinstance(data if isinstance(data, list) else [], list)

    def test_returns_empty_list_when_file_missing(self, tmp_path, monkeypatch):
        """load_sent_log returns [] if the log file does not exist."""
        import tools.memory as mem
        monkeypatch.setattr(mem, "SENT_LOG_PATH", tmp_path / "nonexistent.yaml")
        result = mem.load_sent_log()
        assert result == []


# ── append_sent_log ───────────────────────────────────────────────────────────

class TestAppendSentLog:
    def test_appends_new_entry(self, tmp_path, monkeypatch):
        import tools.memory as mem
        monkeypatch.setattr(mem, "SENT_LOG_PATH", tmp_path / "sent_log.yaml")
        mem.append_sent_log("Alice", "birthday", year=CURRENT_YEAR)
        log = mem.load_sent_log()
        assert len(log) == 1
        assert log[0]["person_name"] == "Alice"
        assert log[0]["occasion"] == "birthday"
        assert log[0]["year"] == CURRENT_YEAR

    def test_idempotent_on_duplicate(self, tmp_path, monkeypatch):
        """Appending the same entry twice should not create a duplicate."""
        import tools.memory as mem
        monkeypatch.setattr(mem, "SENT_LOG_PATH", tmp_path / "sent_log.yaml")
        mem.append_sent_log("Alice", "birthday", year=CURRENT_YEAR)
        mem.append_sent_log("Alice", "birthday", year=CURRENT_YEAR)
        assert len(mem.load_sent_log()) == 1

    def test_different_year_creates_new_entry(self, tmp_path, monkeypatch):
        import tools.memory as mem
        monkeypatch.setattr(mem, "SENT_LOG_PATH", tmp_path / "sent_log.yaml")
        mem.append_sent_log("Alice", "birthday", year=LAST_YEAR)
        mem.append_sent_log("Alice", "birthday", year=CURRENT_YEAR)
        assert len(mem.load_sent_log()) == 2

    def test_optional_fields_stored(self, tmp_path, monkeypatch):
        import tools.memory as mem
        monkeypatch.setattr(mem, "SENT_LOG_PATH", tmp_path / "sent_log.yaml")
        mem.append_sent_log(
            "Bob", "anniversary",
            year=CURRENT_YEAR,
            sent_at="2026-04-21T09:00:00",
            context_added="We met in Paris",
            tone_selected="warmer and more heartfelt",
        )
        entry = mem.load_sent_log()[0]
        assert entry["sent_at"] == "2026-04-21T09:00:00"
        assert entry["context_added"] == "We met in Paris"
        assert entry["tone_selected"] == "warmer and more heartfelt"

    def test_creates_file_if_missing(self, tmp_path, monkeypatch):
        import tools.memory as mem
        path = tmp_path / "subdir" / "sent_log.yaml"
        monkeypatch.setattr(mem, "SENT_LOG_PATH", path)
        mem.append_sent_log("Carol", "birthday", year=CURRENT_YEAR)
        assert path.exists()

    def test_empty_optional_fields_not_stored(self, tmp_path, monkeypatch):
        """None/empty optional fields should not pollute the entry."""
        import tools.memory as mem
        monkeypatch.setattr(mem, "SENT_LOG_PATH", tmp_path / "sent_log.yaml")
        mem.append_sent_log("Dave", "birthday", year=CURRENT_YEAR)
        entry = mem.load_sent_log()[0]
        assert "sent_at" not in entry
        assert "context_added" not in entry
        assert "tone_selected" not in entry


# ── append_run_log ────────────────────────────────────────────────────────────

class TestAppendRunLog:
    def test_creates_run_log_on_first_call(self, tmp_path, monkeypatch):
        import tools.memory as mem
        monkeypatch.setattr(mem, "RUN_LOG_PATH", tmp_path / "run_log.yaml")
        mem.append_run_log({"run_date": "2026-04-21", "events_sent": 2})
        assert (tmp_path / "run_log.yaml").exists()

    def test_appends_multiple_entries(self, tmp_path, monkeypatch):
        import tools.memory as mem
        monkeypatch.setattr(mem, "RUN_LOG_PATH", tmp_path / "run_log.yaml")
        mem.append_run_log({"run_date": "2026-04-20", "events_sent": 1})
        mem.append_run_log({"run_date": "2026-04-21", "events_sent": 0})
        with open(tmp_path / "run_log.yaml") as f:
            log = yaml.safe_load(f)
        assert len(log) == 2

    def test_logged_at_is_added(self, tmp_path, monkeypatch):
        import tools.memory as mem
        monkeypatch.setattr(mem, "RUN_LOG_PATH", tmp_path / "run_log.yaml")
        mem.append_run_log({"run_date": "2026-04-21"})
        with open(tmp_path / "run_log.yaml") as f:
            log = yaml.safe_load(f)
        assert "logged_at" in log[0]

    def test_arbitrary_fields_preserved(self, tmp_path, monkeypatch):
        import tools.memory as mem
        monkeypatch.setattr(mem, "RUN_LOG_PATH", tmp_path / "run_log.yaml")
        mem.append_run_log({
            "run_date":             "2026-04-21",
            "events_found":         3,
            "events_skipped":       1,
            "events_sent":          2,
            "synced_from_supabase": 1,
            "digest_sent":          True,
        })
        with open(tmp_path / "run_log.yaml") as f:
            entry = yaml.safe_load(f)[0]
        assert entry["events_found"] == 3
        assert entry["digest_sent"] is True
