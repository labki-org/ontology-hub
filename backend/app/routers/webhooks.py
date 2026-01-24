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
from sqlalchemy import select, update
from sqlmodel.ext.asyncio.session import AsyncSession

from app.config import settings
from app.database import async_session_maker
from app.models.v2 import Draft, DraftStatus, OntologyVersion
from app.services.draft_rebase import auto_rebase_drafts
from app.services.github import GitHubClient
from app.services.indexer import sync_repository
from app.services.ingest_v2 import sync_repository_v2

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

    expected_signature = "sha256=" + hmac.new(
        settings.GITHUB_WEBHOOK_SECRET.encode("utf-8"),
        body,
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected_signature, signature_header):
        raise HTTPException(status_code=403, detail="Invalid signature")

    return body


async def trigger_sync_background(httpx_client: Any) -> None:
    """Background task to sync repository (v1.0 - kept for backward compatibility).

    Creates its own database session since FastAPI BackgroundTasks
    run after the request context is closed.

    Args:
        httpx_client: Pre-configured httpx.AsyncClient from app.state
    """
    async with async_session_maker() as session:
        github_client = GitHubClient(httpx_client)
        try:
            result = await sync_repository(
                github_client=github_client,
                session=session,
                owner=settings.GITHUB_REPO_OWNER,
                repo=settings.GITHUB_REPO_NAME,
            )
            logger.info("Background sync complete: %s", result)
        except Exception as e:
            logger.error("Background sync failed: %s", e, exc_info=True)


# Deprecated: Use auto_rebase_drafts from app.services.draft_rebase instead
# Kept for backward compatibility but not called in v2.0 webhook flow
async def mark_drafts_stale(
    session: AsyncSession,
    old_commit_sha: str | None,
    new_commit_sha: str,
) -> int:
    """Mark active drafts as stale when canonical changes.

    DEPRECATED: Use auto_rebase_drafts() instead, which tests patch applicability
    rather than just marking all drafts as stale.

    Args:
        session: Database session
        old_commit_sha: Previous canonical commit (None if first ingest)
        new_commit_sha: New canonical commit

    Returns:
        Number of drafts marked stale
    """
    if not old_commit_sha:
        return 0

    result = await session.execute(
        update(Draft)
        .where(Draft.base_commit_sha == old_commit_sha)
        .where(Draft.status.in_([DraftStatus.DRAFT, DraftStatus.VALIDATED]))
        .values(rebase_status="stale")
    )
    await session.commit()
    return result.rowcount


async def trigger_sync_background_v2(httpx_client: Any) -> None:
    """Background task to sync repository using v2.0 ingest.

    Creates its own database session since FastAPI BackgroundTasks
    run after the request context is closed.

    Args:
        httpx_client: Pre-configured httpx.AsyncClient from app.state
    """
    async with async_session_maker() as session:
        github_client = GitHubClient(httpx_client)
        try:
            # Get previous commit SHA for draft staleness detection
            prev_version = (
                await session.execute(
                    select(OntologyVersion).order_by(OntologyVersion.created_at.desc())
                )
            ).scalars().first()
            old_commit_sha = prev_version.commit_sha if prev_version else None

            # Run v2.0 ingest
            result = await sync_repository_v2(
                github_client=github_client,
                session=session,
                owner=settings.GITHUB_REPO_OWNER,
                repo=settings.GITHUB_REPO_NAME,
            )
            logger.info("v2.0 sync complete: %s", result)

            # Auto-rebase drafts after canonical update
            if result.get("status") == "completed" and old_commit_sha:
                rebase_stats = await auto_rebase_drafts(
                    session, old_commit_sha, result["commit_sha"]
                )
                logger.info(
                    "Auto-rebase: %d clean, %d conflicts",
                    rebase_stats["rebased"],
                    rebase_stats["conflicted"],
                )

        except Exception as e:
            logger.error("v2.0 sync failed: %s", e, exc_info=True)


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

    # Get the httpx client from app state for the background task
    # IMPORTANT: Pass the raw httpx client, not wrapped GitHubClient
    # The background task will wrap it since session context differs
    httpx_client = request.app.state.github_http_client

    if httpx_client is None:
        logger.warning("GitHub webhook received but GITHUB_TOKEN not configured")
        return {
            "status": "skipped",
            "event": event_type,
            "reason": "GitHub integration not configured",
        }

    # Trigger background sync (v2.0)
    background_tasks.add_task(trigger_sync_background_v2, httpx_client)

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
