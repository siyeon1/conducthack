"""LLM provider abstraction (Track A). Import get_provider() to obtain an LLMProvider."""
from llm.factory import get_provider
from llm.provider import LLMProvider

__all__ = ["get_provider", "LLMProvider"]
