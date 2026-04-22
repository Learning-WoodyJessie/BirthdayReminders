"""
prompts/llm.py

LLM provider abstraction.
Supports OpenAI (default) and Anthropic.
The anthropic import is deferred inside the method so the SDK is optional.

Best practices applied:
  - System/user message split: system sets role, user carries the task
  - Temperature control: passed per-call so generation vs. planning use different values
  - Backward compatible: system=None and temperature=0.8 are safe defaults
"""

import os
from abc import ABC, abstractmethod


# ── Abstract base ─────────────────────────────────────────────────────────────

class LLMProvider(ABC):
    """Abstract base class for LLM providers."""

    @abstractmethod
    def generate(self, prompt: str, system: str = None, temperature: float = 0.8) -> str:
        """
        Send prompt and return the text response.

        Args:
            prompt:      The user-facing task prompt (context + instructions)
            system:      Optional system message — sets the model's role and
                         persistent behaviour. Separated from prompt so the model
                         treats them differently (role vs. task).
            temperature: Sampling temperature.
                         0.8 = default for creative message generation (varied, natural)
                         0.2 = use for planning agent (deterministic, structured output)
        """


# ── OpenAI provider ───────────────────────────────────────────────────────────

class OpenAIProvider(LLMProvider):
    """Wraps OpenAI chat completions (gpt-4o by default)."""

    def __init__(self, model: str = "gpt-4o"):
        self.model = model

    def generate(self, prompt: str, system: str = None, temperature: float = 0.8) -> str:
        from openai import OpenAI  # imported here so tests can patch at module level

        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        client = OpenAI(api_key=os.environ["OPENAI_API_KEY"].strip())
        response = client.chat.completions.create(
            model=self.model,
            max_tokens=300,
            temperature=temperature,
            messages=messages,
        )
        return response.choices[0].message.content.strip()


# ── Anthropic provider ────────────────────────────────────────────────────────

class AnthropicProvider(LLMProvider):
    """Wraps Anthropic Messages API (claude-opus-4-5 by default).

    The `anthropic` package is imported inside generate() so that it's
    entirely optional — the project runs fine without it as long as this
    provider is not actually used.
    """

    def __init__(self, model: str = "claude-opus-4-5"):
        self.model = model

    def generate(self, prompt: str, system: str = None, temperature: float = 0.8) -> str:
        import anthropic  # optional dependency — imported lazily

        client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"].strip())
        kwargs = dict(
            model=self.model,
            max_tokens=300,
            temperature=temperature,
            messages=[{"role": "user", "content": prompt}],
        )
        if system:
            kwargs["system"] = system  # Anthropic uses a top-level system param

        message = client.messages.create(**kwargs)
        return message.content[0].text.strip()


# ── Factory ───────────────────────────────────────────────────────────────────

def get_provider(config: dict) -> LLMProvider:
    """
    Build and return an LLMProvider from the config dict.

    Reads config["llm"]["provider"] and config["llm"]["model"].
    Defaults to OpenAIProvider("gpt-4o") when the llm section is absent.

    Raises:
        ValueError: if provider name is not recognised.
    """
    llm_cfg = config.get("llm", {}) or {}
    provider_name = llm_cfg.get("provider", "openai").lower().strip()
    model = llm_cfg.get("model", None)

    if provider_name == "openai":
        return OpenAIProvider(model=model or "gpt-4o")

    if provider_name == "anthropic":
        return AnthropicProvider(model=model or "claude-opus-4-5")

    raise ValueError(
        f"Unknown LLM provider: {provider_name!r}. "
        "Supported values are 'openai' and 'anthropic'."
    )
