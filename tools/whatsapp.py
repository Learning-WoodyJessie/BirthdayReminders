"""
tools/whatsapp.py

WhatsApp delivery tool via Twilio.
Reads credentials from environment variables set in GitHub Secrets.
"""

import os
import sys


def send_whatsapp(to: str, message: str, label: str = "") -> bool:
    """
    Send a WhatsApp message via Twilio.

    Args:
        to:      recipient phone number in E.164 format e.g. +14155550001
        message: text body
        label:   optional log prefix e.g. "digest" or "direct→Sush"

    Returns:
        True on success, False on failure.
    """
    from twilio.rest import Client

    account_sid = os.environ["TWILIO_ACCOUNT_SID"]
    auth_token  = os.environ["TWILIO_AUTH_TOKEN"]
    from_number = os.environ["TWILIO_FROM"]

    client = Client(account_sid, auth_token)
    tag = f"[{label}] " if label else ""

    try:
        msg = client.messages.create(
            from_=f"whatsapp:{from_number}",
            to=f"whatsapp:{to}",
            body=message,
        )
        print(f"  {tag}✓ Sent to {to} (sid: {msg.sid})")
        return True
    except Exception as e:
        print(f"  {tag}✗ Error sending to {to}: {e}", file=sys.stderr)
        return False
