"""The privacy guard on the runtime URL: non-local endpoints are refused
unless the user explicitly opts in."""

from screenscore.runtime.ollama import _candidate_urls, _is_local_url


def test_local_urls_recognized():
    assert _is_local_url("http://localhost:11434")
    assert _is_local_url("http://127.0.0.1:11434")
    assert _is_local_url("http://host.docker.internal:11434")
    assert _is_local_url("http://ollama:11434")
    assert not _is_local_url("http://models.example.com:11434")
    assert not _is_local_url("https://api.somewhere.io")


def test_remote_ollama_url_is_blocked_by_default(monkeypatch):
    monkeypatch.setenv("OLLAMA_URL", "http://models.example.com:11434")
    monkeypatch.delenv("SCREENSCORE_ALLOW_REMOTE_RUNTIME", raising=False)
    candidates, blocked = _candidate_urls()
    assert "http://models.example.com:11434" not in candidates
    assert blocked is not None and "refused" in blocked
    assert "http://localhost:11434" in candidates  # discovery still works locally


def test_remote_ollama_url_allowed_with_explicit_opt_in(monkeypatch):
    monkeypatch.setenv("OLLAMA_URL", "http://models.example.com:11434")
    monkeypatch.setenv("SCREENSCORE_ALLOW_REMOTE_RUNTIME", "1")
    candidates, blocked = _candidate_urls()
    assert candidates[0] == "http://models.example.com:11434"
    assert blocked is None


def test_local_ollama_url_needs_no_opt_in(monkeypatch):
    monkeypatch.setenv("OLLAMA_URL", "http://127.0.0.1:9999")
    monkeypatch.delenv("SCREENSCORE_ALLOW_REMOTE_RUNTIME", raising=False)
    candidates, blocked = _candidate_urls()
    assert candidates[0] == "http://127.0.0.1:9999"
    assert blocked is None
