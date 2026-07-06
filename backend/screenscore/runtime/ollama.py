"""Ollama adapter with URL auto-discovery.

Discovery order (first responsive wins):
  1. OLLAMA_URL env var (explicit override)
  2. http://localhost:11434            — native dev, Ollama on this machine
  3. http://host.docker.internal:11434 — app in Docker, Ollama on the host
                                         (the recommended macOS setup: host
                                         Ollama gets Metal; a container doesn't)
  4. http://ollama:11434               — the bundled compose service (Linux)
"""

import json
import os
from typing import AsyncIterator

import httpx

from .base import ModelRuntime, RuntimeInfo

DISCOVERY_TIMEOUT = 2.0
GENERATE_TIMEOUT = 600.0


def _candidate_urls() -> list[str]:
    urls = []
    if env := os.environ.get("OLLAMA_URL"):
        urls.append(env.rstrip("/"))
    urls += [
        "http://localhost:11434",
        "http://host.docker.internal:11434",
        "http://ollama:11434",
    ]
    # de-dupe, preserving order
    return list(dict.fromkeys(urls))


class OllamaRuntime(ModelRuntime):
    def __init__(self) -> None:
        self._url: str | None = None
        self._version: str | None = None

    async def _discover(self) -> str | None:
        if self._url:
            return self._url
        async with httpx.AsyncClient(timeout=DISCOVERY_TIMEOUT) as client:
            for url in _candidate_urls():
                try:
                    resp = await client.get(f"{url}/api/version")
                    resp.raise_for_status()
                    self._url = url
                    self._version = resp.json().get("version")
                    return url
                except (httpx.HTTPError, ValueError):
                    continue
        return None

    async def info(self) -> RuntimeInfo:
        url = await self._discover()
        if url is None:
            return RuntimeInfo(
                available=False,
                backend="ollama",
                detail="No Ollama server found. Install from https://ollama.com and start it, "
                       "or set OLLAMA_URL.",
            )
        return RuntimeInfo(available=True, backend="ollama", url=url, version=self._version)

    async def list_models(self) -> list[str]:
        url = await self._discover()
        if url is None:
            raise RuntimeError("Ollama is not reachable")
        async with httpx.AsyncClient(timeout=DISCOVERY_TIMEOUT * 5) as client:
            resp = await client.get(f"{url}/api/tags")
            resp.raise_for_status()
            return [m["name"] for m in resp.json().get("models", [])]

    async def generate(
        self,
        model: str,
        prompt: str,
        *,
        system: str | None = None,
        json_format: bool = False,
        options: dict | None = None,
    ) -> str:
        url = await self._discover()
        if url is None:
            raise RuntimeError("Ollama is not reachable")
        payload: dict = {"model": model, "prompt": prompt, "stream": False}
        if system:
            payload["system"] = system
        if json_format:
            payload["format"] = "json"
        if options:
            payload["options"] = options
        async with httpx.AsyncClient(timeout=GENERATE_TIMEOUT) as client:
            resp = await client.post(f"{url}/api/generate", json=payload)
            resp.raise_for_status()
            return resp.json()["response"]

    async def pull(self, model: str) -> AsyncIterator[dict]:
        url = await self._discover()
        if url is None:
            raise RuntimeError("Ollama is not reachable")
        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream("POST", f"{url}/api/pull", json={"model": model}) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if line.strip():
                        yield json.loads(line)
