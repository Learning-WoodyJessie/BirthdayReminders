"""
tests/test_prompts.py

Tests for prompts/messages.py — template selection and prompt formatting.
These tests do NOT call the OpenAI API (no network, no cost).
generate_message() is tested via mocking.
"""

import pytest
from unittest.mock import patch, MagicMock
from prompts.messages import get_template, generate_message, REMINDER_TEMPLATE, WISH_TEMPLATE


# ── template selection ────────────────────────────────────────────────────────

class TestGetTemplate:
    def test_reminder_template_returned(self):
        t = get_template("reminder")
        assert t == REMINDER_TEMPLATE
        assert "{days_away}" in t
        assert "{name}" in t

    def test_wish_template_returned(self):
        t = get_template("wish")
        assert t == WISH_TEMPLATE
        assert "{name}" in t
        assert "{occasion}" in t

    def test_invalid_type_raises(self):
        with pytest.raises(ValueError, match="Unknown message_type"):
            get_template("invalid")


# ── template formatting ───────────────────────────────────────────────────────

class TestTemplateFormatting:
    def _person(self, notes=None):
        return {
            "name": "Sush",
            "relationship": "best friend",
            "notes": notes,
        }

    def test_reminder_contains_person_name(self):
        from prompts.messages import REMINDER_EXAMPLES
        person = self._person("loves hiking")
        t = get_template("reminder")
        filled = t.format(
            name=person["name"],
            relationship=person["relationship"],
            occasion="birthday",
            days_away=3,
            notes=person["notes"],
            tone="warm and personal",
            preferences_section="",
            examples=REMINDER_EXAMPLES,
        )
        assert "Sush" in filled
        assert "3" in filled
        assert "birthday" in filled
        assert "loves hiking" in filled

    def test_wish_contains_today_context(self):
        from prompts.messages import WISH_EXAMPLES
        person = self._person()
        t = get_template("wish")
        filled = t.format(
            name=person["name"],
            relationship=person["relationship"],
            occasion="birthday",
            days_away=0,
            notes="none provided",
            tone="warm and personal",
            preferences_section="",
            examples=WISH_EXAMPLES,
        )
        assert "TODAY" in filled
        assert "Sush" in filled

    def test_none_notes_replaced_with_fallback(self):
        person = self._person(notes=None)
        notes = person.get("notes") or "none provided"
        assert notes == "none provided"


# ── generate_message (mocked OpenAI) ─────────────────────────────────────────

class TestGenerateMessage:
    def _person(self):
        return {
            "name": "Sush",
            "relationship": "best friend",
            "notes": "Super chill, 25 years of friendship",
        }

    @patch("prompts.messages.OpenAI")
    def test_generate_wish_calls_openai(self, mock_openai_class):
        mock_client = MagicMock()
        mock_openai_class.return_value = mock_client
        mock_client.chat.completions.create.return_value = MagicMock(
            choices=[MagicMock(message=MagicMock(content="Happy birthday Sush!"))]
        )

        import os
        os.environ["OPENAI_API_KEY"] = "sk-test-fake"

        result = generate_message(
            person=self._person(),
            occasion="birthday",
            days_away=0,
            message_type="wish",
            tone="warm and personal",
        )

        assert result == "Happy birthday Sush!"
        mock_client.chat.completions.create.assert_called_once()
        call_kwargs = mock_client.chat.completions.create.call_args
        assert call_kwargs.kwargs["model"] == "gpt-4o"

    @patch("prompts.messages.OpenAI")
    def test_generate_reminder_uses_reminder_template(self, mock_openai_class):
        mock_client = MagicMock()
        mock_openai_class.return_value = mock_client
        mock_client.chat.completions.create.return_value = MagicMock(
            choices=[MagicMock(message=MagicMock(content="Don't forget Sush's birthday!"))]
        )

        import os
        os.environ["OPENAI_API_KEY"] = "sk-test-fake"

        result = generate_message(
            person=self._person(),
            occasion="birthday",
            days_away=3,
            message_type="reminder",
            tone="warm and personal",
        )

        assert "Sush" in result
        # Verify user message (messages[1]) contained reminder context
        # messages[0] is the system prompt, messages[1] is the user prompt
        call_kwargs = mock_client.chat.completions.create.call_args
        user_content = call_kwargs.kwargs["messages"][1]["content"]
        assert "3" in user_content
        assert "reminder" in user_content.lower() or "days" in user_content.lower()
