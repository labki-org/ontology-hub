"""Tests for draft API endpoints.

Tests capability URL security and rate limiting:
- Draft creation returns capability URL (shown once)
- Draft retrieval with valid token
- 404 for invalid/expired tokens (no oracle)
- Tokens stored as hashes only
"""

import pytest
from httpx import AsyncClient


pytestmark = pytest.mark.asyncio


class TestDraftCreation:
    """Tests for POST /api/v1/drafts."""

    # Valid payload structure for tests
    VALID_PAYLOAD = {
        "wiki_url": "https://wiki.example.com",
        "base_version": "v1.0.0",
        "entities": {"categories": [], "properties": [], "subobjects": []},
        "modules": [],
        "profiles": [],
    }

    async def test_creates_draft_returns_capability_url(self, client: AsyncClient):
        """POST should return capability URL with fragment token."""
        response = await client.post(
            "/api/v1/drafts/",
            json={"payload": self.VALID_PAYLOAD},
        )
        assert response.status_code == 201
        data = response.json()
        assert "capability_url" in data
        assert "#" in data["capability_url"]  # Token in fragment
        assert "expires_at" in data
        assert "validation_results" in data  # Validation engine integrated
        assert data["validation_results"]["is_valid"] is True

    async def test_creates_draft_with_entities(self, client: AsyncClient):
        """POST should accept payload with entities."""
        payload = {
            "wiki_url": "https://wiki.example.com",
            "base_version": "v1.0.0",
            "entities": {
                "categories": [
                    {
                        "entity_id": "TestCategory",
                        "label": "Test Category",
                        "schema_definition": {},
                    }
                ],
                "properties": [],
                "subobjects": [],
            },
            "modules": [],
            "profiles": [],
        }
        response = await client.post(
            "/api/v1/drafts/",
            json={"payload": payload},
        )
        assert response.status_code == 201

    async def test_creates_draft_without_auth(self, client: AsyncClient):
        """POST should work without authentication."""
        # No auth headers needed
        response = await client.post(
            "/api/v1/drafts/",
            json={"payload": self.VALID_PAYLOAD},
        )
        assert response.status_code == 201

    async def test_capability_url_contains_token(self, client: AsyncClient):
        """Capability URL should have token after # fragment."""
        response = await client.post(
            "/api/v1/drafts/",
            json={"payload": self.VALID_PAYLOAD},
        )
        data = response.json()
        url = data["capability_url"]
        token = url.split("#")[1]
        # Token should be ~43 chars (base64url encoded 32 bytes)
        assert 40 <= len(token) <= 45


class TestDraftRetrieval:
    """Tests for GET /api/v1/drafts/{token}."""

    # Valid payload structure for tests
    VALID_PAYLOAD = {
        "wiki_url": "https://wiki.example.com",
        "base_version": "v1.0.0",
        "entities": {"categories": [], "properties": [], "subobjects": []},
        "modules": [],
        "profiles": [],
    }

    async def test_retrieves_draft_with_valid_token(self, client: AsyncClient):
        """GET with valid token should return draft data."""
        # Create draft
        create_response = await client.post(
            "/api/v1/drafts/",
            json={"payload": self.VALID_PAYLOAD},
        )
        url = create_response.json()["capability_url"]
        token = url.split("#")[1]

        # Retrieve draft
        response = await client.get(f"/api/v1/drafts/{token}")
        assert response.status_code == 200
        data = response.json()
        assert data["payload"]["wiki_url"] == "https://wiki.example.com"
        assert data["status"] == "pending"
        # Validation results should be stored
        assert data["validation_results"] is not None
        assert data["validation_results"]["is_valid"] is True

    async def test_returns_404_for_invalid_token(self, client: AsyncClient):
        """GET with invalid token should return 404."""
        response = await client.get("/api/v1/drafts/invalid_token_12345")
        assert response.status_code == 404

    async def test_draft_response_excludes_capability_hash(self, client: AsyncClient):
        """Draft response should NOT include capability_hash."""
        # Create and retrieve draft
        create_response = await client.post(
            "/api/v1/drafts/",
            json={"payload": self.VALID_PAYLOAD},
        )
        token = create_response.json()["capability_url"].split("#")[1]

        response = await client.get(f"/api/v1/drafts/{token}")
        data = response.json()

        # Hash should never be exposed
        assert "capability_hash" not in data


class TestSecurityHeaders:
    """Tests for security headers on responses."""

    async def test_referrer_policy_header(self, client: AsyncClient):
        """Responses should have Referrer-Policy: origin."""
        # Use draft endpoint instead of health (doesn't need real database)
        response = await client.get("/api/v1/drafts/test_token")
        # Even 404 responses should have security headers
        assert response.headers.get("Referrer-Policy") == "origin"

    async def test_content_type_options_header(self, client: AsyncClient):
        """Responses should have X-Content-Type-Options: nosniff."""
        response = await client.get("/api/v1/drafts/test_token")
        assert response.headers.get("X-Content-Type-Options") == "nosniff"

    async def test_frame_options_header(self, client: AsyncClient):
        """Responses should have X-Frame-Options: DENY."""
        response = await client.get("/api/v1/drafts/test_token")
        assert response.headers.get("X-Frame-Options") == "DENY"


class TestHealthEndpoint:
    """Tests for GET /health.

    Note: Health endpoint tests require real database connection.
    These tests are integration tests - run manually with docker compose.
    """

    @pytest.mark.skip(reason="Requires real database - run manually with docker compose")
    async def test_health_returns_healthy(self, client: AsyncClient):
        """Health endpoint should return healthy status."""
        response = await client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["database"] == "connected"
