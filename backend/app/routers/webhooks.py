"""GitHub webhook handler with HMAC signature verification.

Handles webhook events from GitHub, specifically push events that
trigger repository re-indexing when the canonical schema repository changes.
"""

import hashlib
import hmac
import json
import logging
from typing import Any

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request

from app.config import settings
from app.services.sync_status import run_sync_with_lock

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


async def verify_github_signature(request: Request) -> bytes:
    """Verify GitHub webhook signature and return raw body.

    Uses HMAC-SHA256 with constant-time comparison to prevent timing attacks.

    Args:
        request: FastAPI request object

    Returns:
        Raw request body bytes

    Raises:
        HTTPException: 403 if signature is missing or invalid
    """
    # If no webhook secret configured, skip verification (dev mode)
    if not settings.GITHUB_WEBHOOK_SECRET:
        return await request.body()

    signature_header = request.headers.get("x-hub-signature-256")
    if not signature_header:
        raise HTTPException(status_code=403, detail="Missing signature header")

    body = await request.body()

    expected_signature = (
        "sha256="
        + hmac.new(
            settings.GITHUB_WEBHOOK_SECRET.encode("utf-8"),
            body,
            hashlib.sha256,
        ).hexdigest()
    )

    if not hmac.compare_digest(expected_signature, signature_header):
        raise HTTPException(status_code=403, detail="Invalid signature")

    return body


async def trigger_sync_background_v2() -> None:
    """Background task to sync repository using v2.0 ingest.

    Delegates to the shared run_sync_with_lock function which handles
    session creation, sync execution, draft rebasing, and concurrency.
    """
    await run_sync_with_lock()


@router.post("/github")
async def github_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
) -> dict[str, Any]:
    """Handle GitHub webhook events.

    Verifies HMAC-SHA256 signature, processes push events by triggering
    background repository sync. Other events are acknowledged but ignored.

    Args:
        request: FastAPI request with webhook payload
        background_tasks: FastAPI background tasks for async sync

    Returns:
        Status response indicating event handling result
    """
    # Verify signature and get raw body
    body = await verify_github_signature(request)
    payload = json.loads(body)

    # Check event type
    event_type = request.headers.get("x-github-event", "unknown")

    if event_type != "push":
        return {"status": "ignored", "event": event_type}

    # Extract changed files for logging
    changed_files: set[str] = set()
    for commit in payload.get("commits", []):
        changed_files.update(commit.get("added", []))
        changed_files.update(commit.get("modified", []))
        changed_files.update(commit.get("removed", []))

    # Check for force push
    is_forced = payload.get("forced", False)

    # Trigger background sync (v2.0)
    background_tasks.add_task(trigger_sync_background_v2)

    logger.info(
        "Webhook received: push event with %d changed files (forced=%s)",
        len(changed_files),
        is_forced,
    )

    return {
        "status": "accepted",
        "event": event_type,
        "files_changed": len(changed_files),
        "forced": is_forced,
        "message": "Sync triggered in background",
    }
