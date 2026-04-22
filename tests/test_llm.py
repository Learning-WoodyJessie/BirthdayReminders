"""
tests/test_llm.py

Tests for prompts/llm.py — LLM provider factory and provider classes.
No real API calls are made.
"""

import pytest
from prompts.llm import get_provider, OpenAIProvider, AnthropicProvider, LLMProvider


class TestGetProvider:
    def test_openai_provider_returned(self):
        config = {"llm": {"provider": "openai", "model": "gpt-4o"}}
        provider = get_provider(config)
        assert isinstance(provider, OpenAIProvider)

    def test_anthropic_provider_returned(self):
        config = {"llm": {"provider": "anthropic", "model": "claude-opus-4-5"}}
        provider = get_provider(config)
        assert isinstance(provider, AnthropicProvider)

    def test_unknown_provider_raises(self):
        config = {"llm": {"provider": "gemini", "model": "gemini-pro"}}
        with pytest.raises(ValueError, match="Unknown LLM provider"):
            get_provider(config)

    def test_defaults_to_openai_when_llm_section_missing(self):
        config = {}
        provider = get_provider(config)
        assert isinstance(provider, OpenAIProvider)

    def test_defaults_to_openai_when_llm_section_is_none(self):
        config = {"llm": None}
        provider = get_provider(config)
        assert isinstance(provider, OpenAIProvider)


class TestProviderAttributes:
    def test_openai_provider_model(self):
        provider = OpenAIProvider(model="gpt-4o")
        assert provider.model == "gpt-4o"

    def test_openai_provider_default_model(self):
        provider = OpenAIProvider()
        assert provider.model == "gpt-4o"

    def test_anthropic_provider_model(self):
        provider = AnthropicProvider(model="claude-opus-4-5")
        assert provider.model == "claude-opus-4-5"

    def test_anthropic_provider_default_model(self):
        provider = AnthropicProvider()
        assert provider.model == "claude-opus-4-5"

    def test_openai_provider_is_llm_provider(self):
        provider = OpenAIProvider()
        assert isinstance(provider, LLMProvider)

    def test_anthropic_provider_is_llm_provider(self):
        provider = AnthropicProvider()
        assert isinstance(provider, LLMProvider)

    def test_get_provider_openai_model_set(self):
        config = {"llm": {"provider": "openai", "model": "gpt-4o"}}
        provider = get_provider(config)
        assert provider.model == "gpt-4o"

    def test_get_provider_anthropic_model_set(self):
        config = {"llm": {"provider": "anthropic", "model": "claude-opus-4-5"}}
        provider = get_provider(config)
        assert provider.model == "claude-opus-4-5"
