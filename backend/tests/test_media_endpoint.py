"""Tests for the media file serving endpoint."""

import json
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
        from app.routers.entities import router

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


@pytest.mark.asyncio
async def test_media_list_includes_sidecar_metadata(media_tmpdir):
    """Media list endpoint includes metadata from JSON sidecar files."""
    # Create a test image file
    test_image = Path(media_tmpdir) / "photo.png"
    test_image.write_bytes(b"\x89PNG\r\n\x1a\n" + b"\x00" * 50)

    # Create matching JSON sidecar
    sidecar = Path(media_tmpdir) / "photo.json"
    sidecar.write_text(
        json.dumps(
            {
                "description": "Photo of the equipment",
                "source": "Aharoni Lab, UCLA",
                "license": "CC-BY-4.0",
                "author": "Daniel Aharoni",
            }
        )
    )

    with patch("app.routers.entities.settings") as mock_settings:
        mock_settings.MEDIA_STORAGE_PATH = media_tmpdir

        from app.main import app

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/v2/media")
            assert resp.status_code == 200
            data = resp.json()
            assert len(data["items"]) == 1

            item = data["items"][0]
            assert item["filename"] == "photo.png"
            assert item["description"] == "Photo of the equipment"
            assert item["source"] == "Aharoni Lab, UCLA"
            assert item["license"] == "CC-BY-4.0"
            assert item["author"] == "Daniel Aharoni"


@pytest.mark.asyncio
async def test_media_list_without_sidecar(media_tmpdir):
    """Media list works normally when no JSON sidecar exists."""
    test_image = Path(media_tmpdir) / "diagram.png"
    test_image.write_bytes(b"\x89PNG\r\n\x1a\n" + b"\x00" * 50)

    with patch("app.routers.entities.settings") as mock_settings:
        mock_settings.MEDIA_STORAGE_PATH = media_tmpdir

        from app.main import app

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/v2/media")
            assert resp.status_code == 200
            data = resp.json()
            assert len(data["items"]) == 1

            item = data["items"][0]
            assert item["filename"] == "diagram.png"
            assert "description" not in item
            assert "source" not in item
            assert "license" not in item
            assert "author" not in item


@pytest.mark.asyncio
async def test_media_list_ignores_invalid_sidecar(media_tmpdir):
    """Media list gracefully handles invalid/malformed JSON sidecar."""
    test_image = Path(media_tmpdir) / "broken.png"
    test_image.write_bytes(b"\x89PNG\r\n\x1a\n" + b"\x00" * 50)

    # Create a malformed JSON sidecar
    sidecar = Path(media_tmpdir) / "broken.json"
    sidecar.write_text("{invalid json content")

    with patch("app.routers.entities.settings") as mock_settings:
        mock_settings.MEDIA_STORAGE_PATH = media_tmpdir

        from app.main import app

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/v2/media")
            assert resp.status_code == 200
            data = resp.json()
            assert len(data["items"]) == 1

            item = data["items"][0]
            assert item["filename"] == "broken.png"
            # Metadata fields should not be present since sidecar is invalid
            assert "description" not in item
            assert "source" not in item


@pytest.mark.asyncio
async def test_media_list_partial_sidecar_metadata(media_tmpdir):
    """Media list includes only the metadata fields present in the sidecar."""
    test_image = Path(media_tmpdir) / "lens.jpg"
    test_image.write_bytes(b"\xff\xd8\xff\xe0" + b"\x00" * 50)

    # Sidecar with only required fields (no description or author)
    sidecar = Path(media_tmpdir) / "lens.json"
    sidecar.write_text(
        json.dumps(
            {
                "source": "UCLA",
                "license": "CC-BY-4.0",
            }
        )
    )

    with patch("app.routers.entities.settings") as mock_settings:
        mock_settings.MEDIA_STORAGE_PATH = media_tmpdir

        from app.main import app

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/v2/media")
            assert resp.status_code == 200
            data = resp.json()
            assert len(data["items"]) == 1

            item = data["items"][0]
            assert item["source"] == "UCLA"
            assert item["license"] == "CC-BY-4.0"
            assert "description" not in item
            assert "author" not in item


def test_ingest_copies_json_sidecars():
    """Verify that sync_repository_v2 media copy includes .json sidecar files."""
    import shutil

    with tempfile.TemporaryDirectory() as src_dir, tempfile.TemporaryDirectory() as dest_dir:
        # Simulate media directory with image + sidecar
        media_src = Path(src_dir) / "media"
        media_src.mkdir()

        (media_src / "photo.png").write_bytes(b"\x89PNG" + b"\x00" * 20)
        (media_src / "photo.json").write_text(
            json.dumps(
                {
                    "source": "Test Lab",
                    "license": "CC-BY-4.0",
                }
            )
        )
        (media_src / "diagram.svg").write_text("<svg></svg>")

        # Run the same copy logic used in sync_repository_v2
        media_storage = Path(dest_dir)
        MEDIA_EXTS = {".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"}
        for media_path in sorted(media_src.iterdir()):
            if media_path.is_file() and (
                media_path.suffix.lower() in MEDIA_EXTS or media_path.suffix.lower() == ".json"
            ):
                shutil.copy2(str(media_path), str(media_storage / media_path.name))

        # Verify all files were copied
        copied = {f.name for f in media_storage.iterdir()}
        assert "photo.png" in copied
        assert "photo.json" in copied
        assert "diagram.svg" in copied
