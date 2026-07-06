import pytest


@pytest.fixture
def data_dir(tmp_path, monkeypatch):
    """Isolated data dir + fake model runtime for every test."""
    monkeypatch.setenv("SCREENSCORE_DATA_DIR", str(tmp_path / "data"))
    monkeypatch.setenv("SCREENSCORE_FAKE_LLM", "1")
    return tmp_path / "data"


@pytest.fixture
async def app(data_dir):
    from screenscore.main import create_app

    application = create_app()
    yield application
    application.state.conn.close()


@pytest.fixture
async def client(app):
    import httpx

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
