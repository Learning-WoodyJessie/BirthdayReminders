"""
tools/health.py

Relationship health tracking — answers "when did we last reach out to each person
and are there any relationships that need attention?"

Built from the episodic sent_log.  No LLM calls — pure data analysis.
"""

from datetime import date, datetime
from typing import Optional


# ── Per-person last-contact ───────────────────────────────────────────────────

def days_since_last_sent(
    person_name: str,
    sent_log: list,
    reference_date: Optional[date] = None,
) -> Optional[int]:
    """
    Return the number of days since the last message was sent to this person.
    Returns None if no message has ever been sent.

    Args:
        person_name:    exact name (case-sensitive).
        sent_log:       pre-loaded sent_log list.
        reference_date: date to measure from (defaults to today).
    """
    ref = reference_date or date.today()
    entries = [e for e in sent_log if e.get("person_name") == person_name]
    if not entries:
        return None

    # Find the most recent sent_at timestamp
    latest = None
    for entry in entries:
        sent_at = entry.get("sent_at")
        if not sent_at:
            # Fall back to year alone — estimate as start of that year
            try:
                estimated = date(entry["year"], 1, 1)
                if latest is None or estimated > latest:
                    latest = estimated
            except (KeyError, TypeError, ValueError):
                pass
            continue

        try:
            dt = datetime.fromisoformat(str(sent_at)).date()
            if latest is None or dt > latest:
                latest = dt
        except (TypeError, ValueError):
            pass

    if latest is None:
        return None

    return (ref - latest).days


# ── Relationship health report ────────────────────────────────────────────────

def get_relationship_health(
    people: list,
    sent_log: list,
    reference_date: Optional[date] = None,
) -> list:
    """
    Return a health summary for every person in the contact list.

    Each entry:
        {
          "name":         str,
          "relationship": str,
          "send_count":   int,
          "days_since":   int | None,   # days since last contact (None = never)
          "status":       "never" | "overdue" | "recent" | "ok",
        }

    Status thresholds:
        never   → no message ever sent
        overdue → last sent more than 365 days ago
        recent  → last sent within 30 days
        ok      → between 30 and 365 days
    """
    ref = reference_date or date.today()
    report = []

    for person in people:
        name         = person.get("name", "")
        relationship = person.get("relationship", "")
        entries      = [e for e in sent_log if e.get("person_name") == name]
        send_count   = len(entries)
        days         = days_since_last_sent(name, sent_log, ref)

        if days is None:
            status = "never"
        elif days > 365:
            status = "overdue"
        elif days <= 30:
            status = "recent"
        else:
            status = "ok"

        report.append({
            "name":         name,
            "relationship": relationship,
            "send_count":   send_count,
            "days_since":   days,
            "status":       status,
        })

    # Sort: never first, then overdue, then ok, then recent
    order = {"never": 0, "overdue": 1, "ok": 2, "recent": 3}
    report.sort(key=lambda r: (order[r["status"]], r["name"]))
    return report


# ── Summary for CLI / digest ──────────────────────────────────────────────────

def health_summary_text(health: list) -> str:
    """Format relationship health as a short readable summary."""
    never   = [r for r in health if r["status"] == "never"]
    overdue = [r for r in health if r["status"] == "overdue"]

    lines = []
    if never:
        names = ", ".join(r["name"] for r in never)
        lines.append(f"  ⚠️  Never messaged: {names}")
    if overdue:
        names = ", ".join(
            f"{r['name']} ({r['days_since']}d ago)" for r in overdue
        )
        lines.append(f"  ⏰ Overdue (>1yr): {names}")

    if not lines:
        lines.append("  ✅ All relationships contacted within the past year")

    return "\n".join(lines)
