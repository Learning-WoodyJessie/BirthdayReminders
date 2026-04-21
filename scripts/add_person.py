#!/usr/bin/env python3
"""
add_person.py — interactive CLI to add a new person to data/people.yaml.

Usage:
    python scripts/add_person.py
"""

import yaml
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PEOPLE_PATH = ROOT / "data" / "people.yaml"


def prompt(label: str, required: bool = False, hint: str = "") -> str:
    suffix = f" [{hint}]" if hint else ""
    suffix += " (required)" if required else " (press Enter to skip)"
    while True:
        val = input(f"{label}{suffix}: ").strip()
        if val or not required:
            return val
        print("  This field is required.")


def main():
    print("\n── Add a new person to BirthdayReminders ──\n")

    name = prompt("Name", required=True)
    relationship = prompt("Relationship", required=True, hint="e.g. mother, best friend, colleague")
    birthday = prompt("Birthday", hint="YYYY-MM-DD or --MM-DD if year unknown")
    anniversary = prompt("Anniversary", hint="YYYY-MM-DD")
    notes = prompt("Notes", hint="hobbies, recent life events, shared memories")
    phone = prompt("WhatsApp phone", hint="+14155550001 — leave blank to skip direct messages")

    person = {"name": name, "relationship": relationship}
    person["birthday"] = birthday or None
    person["anniversary"] = anniversary or None
    person["notes"] = notes or None
    person["phone"] = phone or None

    # Load existing data
    with open(PEOPLE_PATH) as f:
        data = yaml.safe_load(f) or {}
    data.setdefault("people", [])
    data["people"].append(person)

    with open(PEOPLE_PATH, "w") as f:
        yaml.dump(data, f, allow_unicode=True, sort_keys=False, default_flow_style=False)

    print(f"\n✓ Added {name} to {PEOPLE_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
