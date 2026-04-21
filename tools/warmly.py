"""
tools/warmly.py

Stores a generated reminder in Supabase and returns a unique Warmly edit link.
The link lets the owner personalise the message before sending on WhatsApp.
"""

import os
import uuid
from datetime import date


def create_warmly_link(person: dict, occasion: str, message: str) -> str:
    """
    Store the reminder in Supabase and return a unique Warmly URL.
    Falls back to None if Supabase is not configured.
    """
    supabase_url = os.environ.get("SUPABASE_URL", "")
    supabase_key = os.environ.get("SUPABASE_SERVICE_KEY", "")
    warmly_base  = os.environ.get("WARMLY_BASE_URL", "")

    if not all([supabase_url, supabase_key, warmly_base]):
        return ""   # graceful fallback — digest still sends without link

    try:
        from supabase import create_client
        client = create_client(supabase_url, supabase_key)

        token = str(uuid.uuid4())
        client.table("reminders").insert({
            "token":        token,
            "person_name":  person["name"],
            "relationship": person["relationship"],
            "occasion":     occasion,
            "notes":        person.get("notes") or "",
            "message":      message,
            "phone":        person.get("phone") or "",
            "created_at":   date.today().isoformat(),
        }).execute()

        return f"{warmly_base}/send/{token}"
    except Exception as e:
        print(f"  [warmly] Could not create link: {e}")
        return ""
