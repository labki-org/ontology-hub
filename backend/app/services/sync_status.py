"""Sync status service with cached GitHub SHA checks and sync coordination.

Provides:
- Cached GitHub SHA lookups (30s TTL) to minimize API calls
- asyncio.Lock to prevent concurrent sync operations
- Shared sync-with-rebase function used by both webhooks and status endpoint
"""

import asyncio
import logging
import time
from dataclasses import dataclass

from sqlalchemy import select
from sqlmodel import col

from app.config import settings
from app.database import async_session_maker
from app.models.v2 import OntologyVersion
from app.services.draft_rebase import auto_rebase_drafts
from app.services.github import GitHubClient
from app.services.ingest import sync_repository_v2

logger = logging.getLogger(__name__)

# Module-level sync lock — prevents concurrent sync operations within this process
_sync_lock = asyncio.Lock()

# Cache TTL in seconds
_CACHE_TTL = 30.0


@dataclass
class _GitHubShaCache:
    """Cached result of a GitHub SHA lookup."""

    sha: str | None = None
    error: str | None = None
    checked_at: float = 0.0

    def is_fresh(self) -> bool:
        return (time.monotonic() - self.checked_at) < _CACHE_TTL


_github_sha_cache = _GitHubShaCache()


async def get_cached_github_sha(
    github_client: GitHubClient, owner: str, repo: str
) -> tuple[str | None, str | None]:
    """Get the latest commit SHA from GitHub with 30s caching.

    Returns:
        Tuple of (sha, error). One will be None.
    """
    global _github_sha_cache

    if _github_sha_cache.is_fresh():
        return _github_sha_cache.sha, _github_sha_cache.error

    try:
        sha = await github_client.get_latest_commit_sha(owner, repo)
        _github_sha_cache = _GitHubShaCache(sha=sha, error=None, checked_at=time.monotonic())
        return sha, None
    except Exception as e:
        error_msg = f"GitHub unreachable: {e}"
        logger.warning("Failed to fetch GitHub SHA: %s", e)
        _github_sha_cache = _GitHubShaCache(sha=None, error=error_msg, checked_at=time.monotonic())
        return None, error_msg


async def run_sync_with_lock() -> bool:
    """Run a full sync+rebase, protected by the module-level lock.

    Returns:
        True if sync was started, False if another sync is already running.
    """
    if _sync_lock.locked():
        logger.info("Sync already in progress, skipping")
        return False

    async with _sync_lock, async_session_maker() as session:
        try:
            # Get previous commit SHA for draft rebase
            prev_version = (
                (
                    await session.execute(
                        select(OntologyVersion).order_by(col(OntologyVersion.created_at).desc())
                    )
                )
                .scalars()
                .first()
            )
            old_commit_sha = prev_version.commit_sha if prev_version else None

            # Run sync
            result = await sync_repository_v2(
                session=session,
                owner=settings.GITHUB_REPO_OWNER,
                repo=settings.GITHUB_REPO_NAME,
                github_token=settings.GITHUB_TOKEN,
            )
            logger.info("Sync complete: %s", result)

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
            logger.error("Sync failed: %s", e, exc_info=True)

    return True


def is_sync_in_progress() -> bool:
    """Check if a sync operation is currently running."""
    return _sync_lock.locked()
