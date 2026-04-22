"""
tools/memory.py

Persistent sent-log: tracks which (person, occasion) pairs have already
received a message this calendar year so the orchestrator can skip duplicates.

The log lives in data/sent_log.yaml as a plain YAML list:
  - person_name: "Alice"
    occasion: "birthday"
    year: 2026
    sent_at: "2026-04-05T09:00:00"   # optional, from Supabase sync
    context_added: "..."              # optional
    tone_selected: "..."              # optional
"""

import os
from datetime import date, datetime
from pathlib import Path
from typing import Optional
import yaml

# ── Path constants ────────────────────────────────────────────────────────────

_ROOT         = Path(__file__).resolve().parent.parent
SENT_LOG_PATH = _ROOT / "data" / "sent_log.yaml"
RUN_LOG_PATH  = _ROOT / "data" / "run_log.yaml"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _write_yaml(path: Path, data: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        yaml.dump(data, f, default_flow_style=False, allow_unicode=True)


# ── Sent-log: loader ──────────────────────────────────────────────────────────

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


# ── Sent-log: lookup ──────────────────────────────────────────────────────────

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


# ── Sent-log: writer ──────────────────────────────────────────────────────────

def append_sent_log(
    person_name: str,
    occasion: str,
    year: Optional[int] = None,
    sent_at: Optional[str] = None,
    context_added: Optional[str] = None,
    tone_selected: Optional[str] = None,
) -> None:
    """
    Append one entry to sent_log.yaml.

    Skips if an identical (person_name, occasion, year) already exists so
    repeated syncs remain idempotent.
    """
    current_year = year or date.today().year
    log = load_sent_log()

    # idempotency check
    for entry in log:
        if (
            entry.get("person_name") == person_name
            and entry.get("occasion") == occasion
            and entry.get("year") == current_year
        ):
            return  # already recorded

    entry: dict = {"person_name": person_name, "occasion": occasion, "year": current_year}
    if sent_at:        entry["sent_at"]        = sent_at
    if context_added:  entry["context_added"]  = context_added
    if tone_selected:  entry["tone_selected"]  = tone_selected

    log.append(entry)
    _write_yaml(SENT_LOG_PATH, log)


# ── Sent-log: Supabase sync ───────────────────────────────────────────────────

def sync_sent_log_from_supabase() -> int:
    """
    Pull all reminders marked whatsapp_sent=true from Supabase and merge them
    into sent_log.yaml.  Returns the number of new entries added.

    Requires SUPABASE_URL and SUPABASE_SERVICE_KEY env vars.
    Silent no-op (returns 0) if Supabase is not configured.
    """
    supabase_url = os.environ.get("SUPABASE_URL", "")
    supabase_key = os.environ.get("SUPABASE_SERVICE_KEY", "")
    if not all([supabase_url, supabase_key]):
        return 0

    try:
        from supabase import create_client
        client = create_client(supabase_url, supabase_key)

        result = (
            client.table("reminders")
            .select("person_name, occasion, sent_at, context_added, tone_selected")
            .eq("whatsapp_sent", True)
            .execute()
        )
        rows = result.data or []
    except Exception as e:
        print(f"  [memory] Supabase sync failed: {e}")
        return 0

    added = 0
    for row in rows:
        sent_at_str = row.get("sent_at") or ""
        # derive year from sent_at; fall back to current year
        try:
            year = datetime.fromisoformat(sent_at_str).year if sent_at_str else date.today().year
        except ValueError:
            year = date.today().year

        before = len(load_sent_log())
        append_sent_log(
            person_name   = row["person_name"],
            occasion      = row["occasion"],
            year          = year,
            sent_at       = sent_at_str or None,
            context_added = row.get("context_added") or None,
            tone_selected = row.get("tone_selected") or None,
        )
        if len(load_sent_log()) > before:
            added += 1

    return added


# ── Run log ───────────────────────────────────────────────────────────────────

def append_run_log(entry: dict) -> None:
    """
    Append a structured run record to data/run_log.yaml.

    Expected keys (all optional except run_date):
      run_date       str  e.g. "2026-04-21"
      events_found   int
      events_skipped int
      events_sent    int
      synced_from_supabase int
      digest_sent    bool
      error          str  (only on failure)
    """
    if not RUN_LOG_PATH.exists():
        log: list = []
    else:
        with open(RUN_LOG_PATH) as f:
            log = yaml.safe_load(f) or []

    log.append({**entry, "logged_at": datetime.utcnow().isoformat()})
    _write_yaml(RUN_LOG_PATH, log)
