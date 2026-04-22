"""
tools/memory.py

Persistent sent-log: tracks which (person, occasion) pairs have already
received a message this calendar year so the orchestrator can skip duplicates.

The log lives in data/sent_log.yaml as a plain YAML list:
  - person_name: "Alice"
    occasion: "birthday"
    year: 2026
"""

from datetime import date
from pathlib import Path
from typing import Optional
import yaml

# ── Path constant ─────────────────────────────────────────────────────────────

SENT_LOG_PATH: Path = Path(__file__).resolve().parent.parent / "data" / "sent_log.yaml"


# ── Loader ────────────────────────────────────────────────────────────────────

def load_sent_log() -> list:
    """
    Load the sent log from disk.

    Returns an empty list if the file does not exist or is empty.
    """
    if not SENT_LOG_PATH.exists():
        return []
    with open(SENT_LOG_PATH) as f:
        data = yaml.safe_load(f)
    return data if isinstance(data, list) else []


# ── Lookup ────────────────────────────────────────────────────────────────────

def already_sent_this_year(
    person_name: str,
    occasion: str,
    sent_log: Optional[list] = None,
) -> bool:
    """
    Return True if a message was already sent for this person+occasion in the
    current calendar year.

    Args:
        person_name: exact name string (case-sensitive).
        occasion:    "birthday" or "anniversary".
        sent_log:    pre-loaded log list. If None, loads from disk automatically.
    """
    if sent_log is None:
        sent_log = load_sent_log()

    current_year = date.today().year

    for entry in sent_log:
        if (
            entry.get("person_name") == person_name
            and entry.get("occasion") == occasion
            and entry.get("year") == current_year
        ):
            return True

    return False
