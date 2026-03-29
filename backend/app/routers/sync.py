"""Sync status endpoint for checking DB freshness against GitHub."""

import asyncio
import logging
from typing import Literal

from fastapi import APIRouter, Request
from pydantic import BaseModel
from sqlmodel import col, select

from app.config import settings
from app.database import SessionDep
from app.dependencies.rate_limit import RATE_LIMITS, limiter
from app.models.v2 import OntologyVersion
from app.services.github import GitHubClient
from app.services.sync_status import (
    get_cached_github_sha,
    is_sync_in_progress,
    run_sync_with_lock,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sync", tags=["sync"])

SyncState = Literal["synced", "behind", "syncing", "error", "unknown"]


class SyncStatusResponse(BaseModel):
    """Response schema for sync status endpoint."""

    repo_owner: str
    repo_name: str
    repo_url: str
    db_commit_sha: str | None
    db_commit_url: str | None
    db_ingested_at: str | None
    github_commit_sha: str | None
    sync_state: SyncState
    error: str | None


def _build_response(
    *,
    db_commit_sha: str | None,
    db_ingested_at: str | None,
    github_commit_sha: str | None,
    sync_state: SyncState,
    error: str | None = None,
) -> SyncStatusResponse:
    repo_owner = settings.GITHUB_REPO_OWNER
    repo_name = settings.GITHUB_REPO_NAME
    repo_url = f"https://github.com/{repo_owner}/{repo_name}"
    return SyncStatusResponse(
        repo_owner=repo_owner,
        repo_name=repo_name,
        repo_url=repo_url,
        db_commit_sha=db_commit_sha,
        db_commit_url=f"{repo_url}/commit/{db_commit_sha}" if db_commit_sha else None,
        db_ingested_at=db_ingested_at,
        github_commit_sha=github_commit_sha,
        sync_state=sync_state,
        error=error,
    )


@router.get("/status", response_model=SyncStatusResponse)
@limiter.limit(RATE_LIMITS["entity_read"])
async def get_sync_status(
    request: Request,
    session: SessionDep,
) -> SyncStatusResponse:
    """Get sync status comparing DB state to GitHub.

    Returns repo info, current DB SHA, GitHub SHA, and sync state.
    Auto-triggers a background sync if the DB is behind GitHub.
    """
    query = select(OntologyVersion).order_by(col(OntologyVersion.created_at).desc()).limit(1)
    result = await session.execute(query)
    version = result.scalar_one_or_none()

    db_commit_sha = version.commit_sha if version else None
    db_ingested_at = version.ingested_at.isoformat() if version and version.ingested_at else None

    if is_sync_in_progress():
        return _build_response(
            db_commit_sha=db_commit_sha,
            db_ingested_at=db_ingested_at,
            github_commit_sha=None,
            sync_state="syncing",
        )

    httpx_client = request.app.state.github_http_client
    if httpx_client is None:
        return _build_response(
            db_commit_sha=db_commit_sha,
            db_ingested_at=db_ingested_at,
            github_commit_sha=None,
            sync_state="error",
            error="GitHub integration not configured. Set GITHUB_TOKEN.",
        )

    github_client = GitHubClient(httpx_client)
    github_sha, github_error = await get_cached_github_sha(
        github_client, settings.GITHUB_REPO_OWNER, settings.GITHUB_REPO_NAME
    )

    if github_error:
        return _build_response(
            db_commit_sha=db_commit_sha,
            db_ingested_at=db_ingested_at,
            github_commit_sha=None,
            sync_state="error",
            error=github_error,
        )

    if db_commit_sha is None:
        sync_state: SyncState = "unknown"
    elif db_commit_sha == github_sha:
        sync_state = "synced"
    else:
        sync_state = "behind"

    if sync_state in ("behind", "unknown"):
        asyncio.ensure_future(run_sync_with_lock(httpx_client))
        if is_sync_in_progress():
            sync_state = "syncing"

    return _build_response(
        db_commit_sha=db_commit_sha,
        db_ingested_at=db_ingested_at,
        github_commit_sha=github_sha,
        sync_state=sync_state,
    )
