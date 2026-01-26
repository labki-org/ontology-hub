"""Tests for Version API endpoints.

Tests version listing and diff computation:
- GET /api/v1/versions - List GitHub releases
- GET /api/v1/versions/diff - Get diff between two versions
- GitHub client not configured handling
"""

from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestVersionsList:
    """Tests for GET /api/v1/versions."""

    async def test_list_releases_returns_503_without_github_client(self, client: AsyncClient):
        """GET returns 503 when GitHub client not configured."""
        response = await client.get("/api/v1/versions/")
        assert response.status_code == 503
        assert "GitHub client not configured" in response.json()["detail"]

    async def test_list_releases_returns_list(self, client: AsyncClient):
        """GET returns list of releases from GitHub."""
        mock_releases = [
            {
                "tag_name": "v1.1.0",
                "name": "Version 1.1.0",
                "created_at": "2024-02-01T12:00:00Z",
                "published_at": "2024-02-01T14:00:00Z",
                "body": "Release notes for v1.1.0",
            },
            {
                "tag_name": "v1.0.0",
                "name": "Version 1.0.0",
                "created_at": "2024-01-01T12:00:00Z",
                "published_at": "2024-01-01T14:00:00Z",
                "body": "Initial release",
            },
        ]

        mock_github_client = AsyncMock()
        mock_github_client.get_releases.return_value = mock_releases

        # Temporarily set github_client on app state
        client._transport.app.state.github_client = mock_github_client

        try:
            response = await client.get("/api/v1/versions/")
            assert response.status_code == 200

            data = response.json()
            assert len(data) == 2
            assert data[0]["tag_name"] == "v1.1.0"
            assert data[0]["name"] == "Version 1.1.0"
            assert data[0]["created_at"] == "2024-02-01T12:00:00Z"
            assert data[0]["published_at"] == "2024-02-01T14:00:00Z"
            assert data[0]["body"] == "Release notes for v1.1.0"
            assert data[1]["tag_name"] == "v1.0.0"
        finally:
            client._transport.app.state.github_client = None

    async def test_list_releases_handles_null_fields(self, client: AsyncClient):
        """GET handles releases with null optional fields."""
        mock_releases = [
            {
                "tag_name": "v0.1.0",
                "name": None,
                "created_at": "2024-01-01T12:00:00Z",
                "published_at": None,
                "body": None,
            },
        ]

        mock_github_client = AsyncMock()
        mock_github_client.get_releases.return_value = mock_releases

        client._transport.app.state.github_client = mock_github_client

        try:
            response = await client.get("/api/v1/versions/")
            assert response.status_code == 200

            data = response.json()
            assert len(data) == 1
            assert data[0]["tag_name"] == "v0.1.0"
            assert data[0]["name"] is None
            assert data[0]["published_at"] is None
            assert data[0]["body"] is None
        finally:
            client._transport.app.state.github_client = None


class TestVersionDiff:
    """Tests for GET /api/v1/versions/diff."""

    async def test_diff_returns_503_without_github_client(self, client: AsyncClient):
        """GET returns 503 when GitHub client not configured."""
        response = await client.get("/api/v1/versions/diff?old=v1.0.0&new=v1.1.0")
        assert response.status_code == 503
        assert "GitHub client not configured" in response.json()["detail"]

    async def test_diff_requires_old_and_new_params(self, client: AsyncClient):
        """GET returns 422 when old/new params missing."""
        mock_github_client = AsyncMock()
        client._transport.app.state.github_client = mock_github_client

        try:
            # Missing both
            response = await client.get("/api/v1/versions/diff")
            assert response.status_code == 422

            # Missing new
            response = await client.get("/api/v1/versions/diff?old=v1.0.0")
            assert response.status_code == 422

            # Missing old
            response = await client.get("/api/v1/versions/diff?new=v1.1.0")
            assert response.status_code == 422
        finally:
            client._transport.app.state.github_client = None

    async def test_diff_returns_grouped_changes(self, client: AsyncClient):
        """GET returns changes grouped by entity type."""
        mock_github_client = AsyncMock()

        # Mock tree response for old version (v1.0.0)
        old_tree = [
            {"path": "categories/Person.json", "type": "blob", "sha": "abc"},
            {"path": "properties/has_name.json", "type": "blob", "sha": "def"},
        ]

        # Mock tree response for new version (v1.1.0)
        new_tree = [
            {"path": "categories/Person.json", "type": "blob", "sha": "abc2"},  # modified
            {"path": "categories/Organization.json", "type": "blob", "sha": "ghi"},  # added
            # has_name deleted
        ]

        def mock_get_tree(owner, repo, sha):
            if sha == "v1.0.0":
                return old_tree
            return new_tree

        mock_github_client.get_repository_tree = AsyncMock(side_effect=mock_get_tree)

        # Mock file content
        old_person = {"entity_id": "Person", "label": "Person"}
        old_has_name = {"entity_id": "has_name", "label": "Has Name"}
        new_person = {"entity_id": "Person", "label": "Person Entity"}  # modified label
        new_org = {"entity_id": "Organization", "label": "Organization"}

        def mock_get_file(owner, repo, path, ref):
            if ref == "v1.0.0":
                if "Person" in path:
                    return old_person
                return old_has_name
            else:
                if "Person" in path:
                    return new_person
                return new_org

        mock_github_client.get_file_at_ref = AsyncMock(side_effect=mock_get_file)

        client._transport.app.state.github_client = mock_github_client

        try:
            response = await client.get("/api/v1/versions/diff?old=v1.0.0&new=v1.1.0")
            assert response.status_code == 200

            data = response.json()
            assert data["old_version"] == "v1.0.0"
            assert data["new_version"] == "v1.1.0"

            # Check categories
            assert len(data["categories"]["added"]) == 1
            assert data["categories"]["added"][0]["entity_id"] == "Organization"
            assert len(data["categories"]["modified"]) == 1
            assert data["categories"]["modified"][0]["entity_id"] == "Person"
            assert len(data["categories"]["deleted"]) == 0

            # Check properties
            assert len(data["properties"]["added"]) == 0
            assert len(data["properties"]["modified"]) == 0
            assert len(data["properties"]["deleted"]) == 1
            assert data["properties"]["deleted"][0]["entity_id"] == "has_name"

            # Check other types are empty
            assert data["subobjects"] == {"added": [], "modified": [], "deleted": []}
            assert data["modules"] == {"added": [], "modified": [], "deleted": []}
            assert data["profiles"] == {"added": [], "modified": [], "deleted": []}
        finally:
            client._transport.app.state.github_client = None

    async def test_diff_includes_old_and_new_values(self, client: AsyncClient):
        """GET diff includes old/new values for changes."""
        mock_github_client = AsyncMock()

        old_tree = [{"path": "categories/Test.json", "type": "blob", "sha": "abc"}]
        new_tree = [{"path": "categories/Test.json", "type": "blob", "sha": "def"}]

        def mock_get_tree(owner, repo, sha):
            if sha == "v1.0.0":
                return old_tree
            return new_tree

        mock_github_client.get_repository_tree = AsyncMock(side_effect=mock_get_tree)

        old_test = {"entity_id": "Test", "label": "Old Label", "description": "Old"}
        new_test = {"entity_id": "Test", "label": "New Label", "description": "New"}

        def mock_get_file(owner, repo, path, ref):
            if ref == "v1.0.0":
                return old_test
            return new_test

        mock_github_client.get_file_at_ref = AsyncMock(side_effect=mock_get_file)

        client._transport.app.state.github_client = mock_github_client

        try:
            response = await client.get("/api/v1/versions/diff?old=v1.0.0&new=v1.1.0")
            assert response.status_code == 200

            data = response.json()
            modified = data["categories"]["modified"]
            assert len(modified) == 1
            assert modified[0]["old"]["label"] == "Old Label"
            assert modified[0]["new"]["label"] == "New Label"
        finally:
            client._transport.app.state.github_client = None

    async def test_diff_empty_when_no_changes(self, client: AsyncClient):
        """GET returns empty changes when versions are identical."""
        mock_github_client = AsyncMock()

        tree = [{"path": "categories/Person.json", "type": "blob", "sha": "abc"}]
        person = {"entity_id": "Person", "label": "Person"}

        mock_github_client.get_repository_tree = AsyncMock(return_value=tree)
        mock_github_client.get_file_at_ref = AsyncMock(return_value=person)

        client._transport.app.state.github_client = mock_github_client

        try:
            response = await client.get("/api/v1/versions/diff?old=v1.0.0&new=v1.0.0")
            assert response.status_code == 200

            data = response.json()
            # All should be empty since versions are identical
            for entity_type in ["categories", "properties", "subobjects", "modules", "profiles"]:
                assert data[entity_type]["added"] == []
                assert data[entity_type]["modified"] == []
                assert data[entity_type]["deleted"] == []
        finally:
            client._transport.app.state.github_client = None
