"""Model runtime interface.

Ollama is the default backend, but everything above this interface must not
know that. Adding llama.cpp (or any OpenAI-compatible local server) later
means adding one module here, nothing else.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import AsyncIterator


@dataclass
class RuntimeInfo:
    available: bool
    backend: str
    url: str | None = None
    version: str | None = None
    detail: str | None = None


class ModelRuntime(ABC):
    @abstractmethod
    async def info(self) -> RuntimeInfo:
        """Health/identity of the runtime. Never raises; reports unavailability."""

    @abstractmethod
    async def list_models(self) -> list[str]:
        """Locally installed model tags. Raises RuntimeError if unavailable."""

    @abstractmethod
    async def generate(
        self,
        model: str,
        prompt: str,
        *,
        system: str | None = None,
        json_format: bool = False,
        options: dict | None = None,
    ) -> str:
        """Single completion. Blocking call semantics; used by pipeline stages."""

    @abstractmethod
    def pull(self, model: str) -> AsyncIterator[dict]:
        """Stream pull progress events ({status, completed?, total?})."""
