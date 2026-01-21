"""Tests for GitHub webhook handler.

Tests webhook signature verification, event handling, and background sync trigger:
- HMAC-SHA256 signature verification
- Push events trigger background sync
- Non-push events are acknowledged but ignored
- Invalid/missing signatures return 403
- Dev mode (no secret) skips verification
"""

import hashlib
import hmac
import json
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient


pytestmark = pytest.mark.asyncio


def create_signature(body: bytes, secret: str) -> str:
    """Create valid GitHub webhook signature.

    Args:
        body: Raw request body bytes
        secret: Webhook secret string

    Returns:
        HMAC-SHA256 signature in GitHub's format (sha256=...)
    """
    return "sha256=" + hmac.new(
        secret.encode("utf-8"),
        body,
        hashlib.sha256,
    ).hexdigest()


class TestWebhookSignatureVerification:
    """Tests for HMAC-SHA256 signature verification."""

    async def test_valid_signature_passes(self, client: AsyncClient):
        """POST with valid signature should return 200."""
        secret = "test-webhook-secret"
        payload = {"ref": "refs/heads/main", "commits": []}
        body = json.dumps(payload).encode("utf-8")
        signature = create_signature(body, secret)

        with patch("app.routers.webhooks.settings") as mock_settings:
            mock_settings.GITHUB_WEBHOOK_SECRET = secret
            mock_settings.GITHUB_REPO_OWNER = "test-owner"
            mock_settings.GITHUB_REPO_NAME = "test-repo"

            response = await client.post(
                "/api/v1/webhooks/github",
                content=body,
                headers={
                    "Content-Type": "application/json",
                    "x-hub-signature-256": signature,
                    "x-github-event": "ping",
                },
            )

        assert response.status_code == 200
        assert response.json()["status"] == "ignored"  # ping event

    async def test_invalid_signature_returns_403(self, client: AsyncClient):
        """POST with wrong signature should return 403."""
        secret = "test-webhook-secret"
        payload = {"ref": "refs/heads/main"}
        body = json.dumps(payload).encode("utf-8")
        wrong_signature = create_signature(body, "wrong-secret")

        with patch("app.routers.webhooks.settings") as mock_settings:
            mock_settings.GITHUB_WEBHOOK_SECRET = secret

            response = await client.post(
                "/api/v1/webhooks/github",
                content=body,
                headers={
                    "Content-Type": "application/json",
                    "x-hub-signature-256": wrong_signature,
                    "x-github-event": "push",
                },
            )

        assert response.status_code == 403
        assert response.json()["detail"] == "Invalid signature"

    async def test_missing_signature_header_returns_403(self, client: AsyncClient):
        """POST without signature header should return 403."""
        secret = "test-webhook-secret"
        payload = {"ref": "refs/heads/main"}

        with patch("app.routers.webhooks.settings") as mock_settings:
            mock_settings.GITHUB_WEBHOOK_SECRET = secret

            response = await client.post(
                "/api/v1/webhooks/github",
                json=payload,
                headers={
                    "x-github-event": "push",
                    # Missing x-hub-signature-256 header
                },
            )

        assert response.status_code == 403
        assert response.json()["detail"] == "Missing signature header"

    async def test_no_secret_skips_verification(self, client: AsyncClient):
        """Without GITHUB_WEBHOOK_SECRET, signature verification is skipped (dev mode)."""
        payload = {"ref": "refs/heads/main", "commits": []}

        with patch("app.routers.webhooks.settings") as mock_settings:
            mock_settings.GITHUB_WEBHOOK_SECRET = None  # Dev mode
            mock_settings.GITHUB_REPO_OWNER = "test-owner"
            mock_settings.GITHUB_REPO_NAME = "test-repo"

            response = await client.post(
                "/api/v1/webhooks/github",
                json=payload,
                headers={
                    "x-github-event": "ping",
                    # No signature header
                },
            )

        assert response.status_code == 200


class TestPushEventHandling:
    """Tests for push event processing."""

    async def test_push_event_triggers_sync(self, client: AsyncClient):
        """Push event should trigger background sync."""
        payload = {
            "ref": "refs/heads/main",
            "forced": False,
            "commits": [
                {"added": ["categories/new.json"], "modified": [], "removed": []},
                {"added": [], "modified": ["properties/updated.json"], "removed": []},
            ],
        }

        with patch("app.routers.webhooks.settings") as mock_settings:
            mock_settings.GITHUB_WEBHOOK_SECRET = None  # Dev mode
            mock_settings.GITHUB_REPO_OWNER = "test-owner"
            mock_settings.GITHUB_REPO_NAME = "test-repo"

            # Set the httpx client directly on app state
            app = client._transport.app
            original_value = getattr(app.state, "github_http_client", None)
            app.state.github_http_client = AsyncMock()
            try:
                response = await client.post(
                    "/api/v1/webhooks/github",
                    json=payload,
                    headers={
                        "x-github-event": "push",
                    },
                )
            finally:
                app.state.github_http_client = original_value

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "accepted"
        assert data["event"] == "push"
        assert data["files_changed"] == 2
        assert data["forced"] is False
        assert "Sync triggered" in data["message"]

    async def test_push_event_counts_changed_files(self, client: AsyncClient):
        """Push event should count unique files across all commits."""
        payload = {
            "ref": "refs/heads/main",
            "forced": False,
            "commits": [
                {
                    "added": ["a.json", "b.json"],
                    "modified": ["c.json"],
                    "removed": ["d.json"],
                },
                {
                    "added": [],
                    "modified": ["c.json"],  # Duplicate
                    "removed": ["e.json"],
                },
            ],
        }

        with patch("app.routers.webhooks.settings") as mock_settings:
            mock_settings.GITHUB_WEBHOOK_SECRET = None
            mock_settings.GITHUB_REPO_OWNER = "test"
            mock_settings.GITHUB_REPO_NAME = "repo"

            app = client._transport.app
            original_value = getattr(app.state, "github_http_client", None)
            app.state.github_http_client = AsyncMock()
            try:
                response = await client.post(
                    "/api/v1/webhooks/github",
                    json=payload,
                    headers={"x-github-event": "push"},
                )
            finally:
                app.state.github_http_client = original_value

        # Unique files: a, b, c, d, e = 5
        assert response.json()["files_changed"] == 5

    async def test_force_push_flag_is_captured(self, client: AsyncClient):
        """Force push should be indicated in response."""
        payload = {
            "ref": "refs/heads/main",
            "forced": True,
            "commits": [],
        }

        with patch("app.routers.webhooks.settings") as mock_settings:
            mock_settings.GITHUB_WEBHOOK_SECRET = None
            mock_settings.GITHUB_REPO_OWNER = "test"
            mock_settings.GITHUB_REPO_NAME = "repo"

            app = client._transport.app
            original_value = getattr(app.state, "github_http_client", None)
            app.state.github_http_client = AsyncMock()
            try:
                response = await client.post(
                    "/api/v1/webhooks/github",
                    json=payload,
                    headers={"x-github-event": "push"},
                )
            finally:
                app.state.github_http_client = original_value

        assert response.json()["forced"] is True

    async def test_push_without_github_token_returns_skipped(
        self, client: AsyncClient
    ):
        """Push event should return skipped when GITHUB_TOKEN not configured."""
        payload = {"ref": "refs/heads/main", "commits": []}

        with patch("app.routers.webhooks.settings") as mock_settings:
            mock_settings.GITHUB_WEBHOOK_SECRET = None
            mock_settings.GITHUB_REPO_OWNER = "test"
            mock_settings.GITHUB_REPO_NAME = "repo"

            # github_http_client is None when GITHUB_TOKEN not set
            app = client._transport.app
            original_value = getattr(app.state, "github_http_client", None)
            app.state.github_http_client = None
            try:
                response = await client.post(
                    "/api/v1/webhooks/github",
                    json=payload,
                    headers={"x-github-event": "push"},
                )
            finally:
                app.state.github_http_client = original_value

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "skipped"
        assert "not configured" in data["reason"]


class TestNonPushEvents:
    """Tests for non-push event handling."""

    async def test_ping_event_ignored(self, client: AsyncClient):
        """Ping events should return ignored status."""
        payload = {"zen": "Anything added dilutes everything else."}

        with patch("app.routers.webhooks.settings") as mock_settings:
            mock_settings.GITHUB_WEBHOOK_SECRET = None

            response = await client.post(
                "/api/v1/webhooks/github",
                json=payload,
                headers={"x-github-event": "ping"},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ignored"
        assert data["event"] == "ping"

    async def test_pull_request_event_ignored(self, client: AsyncClient):
        """Pull request events should return ignored status."""
        payload = {"action": "opened", "number": 1}

        with patch("app.routers.webhooks.settings") as mock_settings:
            mock_settings.GITHUB_WEBHOOK_SECRET = None

            response = await client.post(
                "/api/v1/webhooks/github",
                json=payload,
                headers={"x-github-event": "pull_request"},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ignored"
        assert data["event"] == "pull_request"

    async def test_unknown_event_ignored(self, client: AsyncClient):
        """Unknown events should return ignored status."""
        payload = {"data": "test"}

        with patch("app.routers.webhooks.settings") as mock_settings:
            mock_settings.GITHUB_WEBHOOK_SECRET = None

            response = await client.post(
                "/api/v1/webhooks/github",
                json=payload,
                headers={"x-github-event": "custom_event"},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ignored"
        assert data["event"] == "custom_event"

    async def test_missing_event_header_treated_as_unknown(
        self, client: AsyncClient
    ):
        """Missing event header should be treated as unknown event."""
        payload = {"data": "test"}

        with patch("app.routers.webhooks.settings") as mock_settings:
            mock_settings.GITHUB_WEBHOOK_SECRET = None

            response = await client.post(
                "/api/v1/webhooks/github",
                json=payload,
                # No x-github-event header
            )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ignored"
        assert data["event"] == "unknown"
