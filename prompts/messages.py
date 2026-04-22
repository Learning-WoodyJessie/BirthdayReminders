"""
prompts/messages.py

Prompt templates and message generation.
Two message types:
  - "reminder"  : sent 3 days before — heads-up + draft to prepare
  - "wish"      : sent on the day    — actual ready-to-copy-paste message

Prompt engineering techniques applied:
  - System/user split: SYSTEM_PROMPT sets the model's role once; templates carry the task
  - Few-shot examples: 3 diverse examples per template show the model what good looks like
  - Negative constraints: explicit "do not" rules eliminate the most common failure modes
  - Temperature: 0.8 — enough creativity for variety, low enough for consistency
"""

import os
from openai import OpenAI  # kept for backward-compat (existing tests patch prompts.messages.OpenAI)

from prompts.llm import LLMProvider, OpenAIProvider


# ── System prompt — sets the model's role, used for all message generation ────

SYSTEM_PROMPT = """\
You are a thoughtful personal assistant helping someone send warm, genuine WhatsApp messages \
to the people they care about.

Your messages feel like they came from the sender — specific, personal, never generic or \
corporate. You write the way a caring human writes, not the way an AI tries to sound human.

Rules you always follow:
- Never mention AI, that this was generated, or that you are an assistant
- Never use filler phrases: "Hope this finds you well", "Wishing you all the best",
  "May your day be filled with", "Sending you lots of love" (unless it genuinely fits)
- Never start with "Hey [Name]!" — it reads as template-like
- No hashtags, no emojis unless the relationship clearly calls for them
- Output ONLY the message — no labels, no explanation, no quotes around it\
"""


# ── Few-shot examples — injected into templates to anchor output quality ──────

WISH_EXAMPLES = """\
[EXAMPLES — study the style, do not copy the content]

Occasion: birthday | Relationship: sister | Tone: warm and personal
"Happy birthday sis! 🎂 Can't believe another year has gone by — feels like yesterday \
we were kids making up stories at 2am and getting in trouble for it. Hope today is as \
brilliant as you are. Love you loads."

Occasion: birthday | Relationship: colleague | Tone: friendly and professional
"Happy birthday Sarah! Hope you're having a wonderful day — you really deserve a proper \
celebration after the year you've had. Enjoy every minute of it!"

Occasion: anniversary | Relationship: partner | Tone: warm and personal
"Happy anniversary, love. Every year with you feels like both forever and not nearly enough. \
So grateful it's you. Here's to many more."

[END EXAMPLES]\
"""

REMINDER_EXAMPLES = """\
[EXAMPLES — study the style, do not copy the content]

Occasion: birthday in 3 days | Relationship: best friend | Tone: warm and personal
"Just a heads-up — Jake's birthday is in 3 days (Sunday)! Here's a draft when you're ready:
'Happy birthday mate! Three decades in and you're still the most ridiculous person I know — \
in the best possible way. Hope it's a big one.'"

Occasion: anniversary in 3 days | Relationship: colleague | Tone: friendly and professional
"Reminder: it's Priya and Dev's anniversary on Thursday! Draft if you need one:
'Congrats on another year together — wishing you both a lovely celebration!'"

[END EXAMPLES]\
"""


# ── Prompt templates ──────────────────────────────────────────────────────────

REMINDER_TEMPLATE = """\
[CONTEXT]
Person:       {name}
Relationship: {relationship}
Occasion:     {occasion} — in {days_away} days
Notes:        {notes}
Tone:         {tone}
{preferences_section}
{examples}

[TASK]
Write a short reminder (2–3 sentences) for the sender:
1. Alert them the occasion is coming up in {days_away} days
2. Include a warm, ready-to-send draft they can copy and use on the day

The draft should reference something specific from the notes if it fits naturally.
Match the tone exactly. Output ONLY the reminder — no labels, no explanation.\
"""


WISH_TEMPLATE = """\
[CONTEXT]
Person:       {name}
Relationship: {relationship}
Occasion:     {occasion} — TODAY
Notes:        {notes}
Tone:         {tone}
{preferences_section}
{examples}

[CHAIN OF THOUGHT — work through this before writing]
1. What does the relationship suggest about the right warmth level?
2. Is there anything specific in the notes worth referencing naturally?
3. What would make this feel personal rather than generic?
Now write the message.

[TASK]
Write the actual wish (2–4 sentences), ready to send RIGHT NOW.
- Address them by first name
- Reference something from the notes if it fits naturally — don't force it
- Match the tone exactly
- Output ONLY the message — no labels, no explanation\
"""


# ── Template selector ─────────────────────────────────────────────────────────

def get_template(message_type: str) -> str:
    templates = {
        "reminder": REMINDER_TEMPLATE,
        "wish":     WISH_TEMPLATE,
    }
    if message_type not in templates:
        raise ValueError(f"Unknown message_type: {message_type!r}. Use 'reminder' or 'wish'.")
    return templates[message_type]


def _get_examples(message_type: str) -> str:
    return WISH_EXAMPLES if message_type == "wish" else REMINDER_EXAMPLES


# ── Generator ─────────────────────────────────────────────────────────────────

def generate_message(person: dict, occasion: str, days_away: int,
                     message_type: str, tone: str,
                     provider: LLMProvider = None,
                     preferences_section: str = "") -> str:
    """
    Generate a personalised message using the given LLM provider.

    Args:
        person:              person dict from people.yaml
        occasion:            "birthday" or "anniversary"
        days_away:           0 = today, 3 = in 3 days
        message_type:        "reminder" or "wish"
        tone:                e.g. "warm and personal" or "friendly and professional"
        provider:            LLMProvider instance. If None, falls back to OpenAIProvider
                             (uses the OpenAI module-level import so existing tests that
                             patch prompts.messages.OpenAI continue to work).
        preferences_section: optional block of past-history context to inject into prompt.
                             Built by tools.preferences.build_preferences_section().
    """
    template = get_template(message_type)
    section  = f"\n{preferences_section}\n" if preferences_section else ""
    examples = _get_examples(message_type)

    prompt = template.format(
        name=person["name"],
        relationship=person["relationship"],
        occasion=occasion,
        days_away=days_away,
        notes=person.get("notes") or "none provided",
        tone=tone,
        preferences_section=section,
        examples=examples,
    )

    if provider is not None:
        return provider.generate(prompt, system=SYSTEM_PROMPT, temperature=0.8)

    # Backward-compatible fallback: use the module-level OpenAI import so that
    # existing tests which patch `prompts.messages.OpenAI` still work correctly.
    client = OpenAI(api_key=os.environ["OPENAI_API_KEY"].strip())
    response = client.chat.completions.create(
        model="gpt-4o",
        max_tokens=300,
        temperature=0.8,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user",   "content": prompt},
        ],
    )
    return response.choices[0].message.content.strip()
