import pytest


@pytest.fixture
def data_dir(tmp_path, monkeypatch):
    """Isolated data dir + instant stub pipeline for every test."""
    monkeypatch.setenv("SCREENSCORE_DATA_DIR", str(tmp_path / "data"))
    monkeypatch.setenv("SCREENSCORE_STUB_DELAY", "0")
    return tmp_path / "data"
