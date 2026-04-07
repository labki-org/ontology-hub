"""Tests for the media file serving endpoint."""

import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest
from httpx import ASGITransport, AsyncClient


@pytest.fixture
def media_tmpdir():
    """Create a temporary directory to act as media storage."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield tmpdir


@pytest.fixture
def app_with_media(media_tmpdir):
    """Create the FastAPI app with MEDIA_STORAGE_PATH pointed at temp dir."""
    with patch("app.config.settings") as mock_settings:
        # Copy real settings and override MEDIA_STORAGE_PATH
        from app.config import Settings

        real = Settings.model_construct(
            DATABASE_URL="sqlite+aiosqlite:///:memory:",
            MEDIA_STORAGE_PATH=media_tmpdir,
            CORS_ORIGINS="",
            GITHUB_TOKEN=None,
            GITHUB_REPO_OWNER="test",
            GITHUB_REPO_NAME="test",
            DEBUG=False,
        )
        mock_settings.MEDIA_STORAGE_PATH = media_tmpdir
        mock_settings.DATABASE_URL = real.DATABASE_URL

        # Re-import to pick up patched settings
        from app.routers.entities import get_media_file, router

        yield router, media_tmpdir


@pytest.mark.asyncio
async def test_media_404_for_missing_file(media_tmpdir):
    """Non-existent file returns 404."""
    with patch("app.routers.entities.settings") as mock_settings:
        mock_settings.MEDIA_STORAGE_PATH = media_tmpdir

        from app.main import app

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/v2/media/nonexistent.png")
            assert resp.status_code == 404


@pytest.mark.asyncio
async def test_media_200_for_existing_file(media_tmpdir):
    """Existing PNG file is served with correct content type."""
    # Create a test file
    test_file = Path(media_tmpdir) / "test.png"
    test_file.write_bytes(b"\x89PNG\r\n\x1a\n" + b"\x00" * 100)

    with patch("app.routers.entities.settings") as mock_settings:
        mock_settings.MEDIA_STORAGE_PATH = media_tmpdir

        from app.main import app

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/v2/media/test.png")
            assert resp.status_code == 200
            assert resp.headers["content-type"] == "image/png"
            assert "max-age=86400" in resp.headers.get("cache-control", "")


@pytest.mark.asyncio
async def test_media_400_for_path_traversal(media_tmpdir):
    """Path traversal attempts return 400."""
    with patch("app.routers.entities.settings") as mock_settings:
        mock_settings.MEDIA_STORAGE_PATH = media_tmpdir

        from app.main import app

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # Backslash in filename
            resp = await client.get("/api/v2/media/..%5Ctest.png")
            assert resp.status_code == 400

            # Double-dot sequence in filename
            resp = await client.get("/api/v2/media/..passwd")
            assert resp.status_code == 400


@pytest.mark.asyncio
async def test_media_svg_has_csp_header(media_tmpdir):
    """SVG files include Content-Security-Policy header."""
    test_file = Path(media_tmpdir) / "diagram.svg"
    test_file.write_text('<svg xmlns="http://www.w3.org/2000/svg"></svg>')

    with patch("app.routers.entities.settings") as mock_settings:
        mock_settings.MEDIA_STORAGE_PATH = media_tmpdir

        from app.main import app

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/v2/media/diagram.svg")
            assert resp.status_code == 200
            assert resp.headers.get("content-security-policy") == "default-src 'none'"
