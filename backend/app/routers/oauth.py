"""OAuth router for GitHub authentication flow.

Handles OAuth login initiation and callback for PR creation.
OAuth tokens are held in session temporarily, never persisted.
"""

import logging
from datetime import datetime
from urllib.parse import quote

from authlib.integrations.starlette_client import OAuth
from authlib.integrations.base_client.errors import OAuthError
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import RedirectResponse

from app.config import Settings, settings
from app.database import get_session
from app.dependencies.capability import validate_capability_token
from app.models.draft import DraftPayload, DraftDiffResponse, DraftStatus
from app.services.pr_builder import (
    build_files_from_draft,
    generate_branch_name,
    generate_commit_message,
    generate_pr_body,
)
from app.services.github import GitHubClient

logger = logging.getLogger(__name__)


# OAuth client - registration happens on startup when settings available
oauth = OAuth()


def register_oauth_client(settings: Settings) -> None:
    """Register GitHub OAuth client with Authlib.

    Called from main.py lifespan after settings loaded.

    Args:
        settings: Application settings with OAuth credentials
    """
    oauth.register(
        name="github",
        client_id=settings.GITHUB_CLIENT_ID,
        client_secret=settings.GITHUB_CLIENT_SECRET,
        access_token_url="https://github.com/login/oauth/access_token",
        authorize_url="https://github.com/login/oauth/authorize",
        api_base_url="https://api.github.com/",
        client_kwargs={"scope": "public_repo"},
    )


router = APIRouter(prefix="/oauth", tags=["oauth"])


@router.get("/github/login")
async def github_login(request: Request, draft_token: str):
    """Initiate GitHub OAuth flow for PR creation.

    Stores draft_token in session and redirects to GitHub authorization.

    Args:
        request: FastAPI request with session
        draft_token: Draft capability token to associate with OAuth

    Returns:
        Redirect to GitHub authorization page

    Raises:
        HTTPException: 503 if OAuth not configured
    """
    # Check if OAuth is configured
    if not oauth._clients:
        raise HTTPException(
            status_code=503,
            detail="GitHub OAuth not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET environment variables.",
        )

    # Store draft_token in session for retrieval after OAuth callback
    request.session["pending_draft_token"] = draft_token
    request.session["oauth_initiated_at"] = datetime.utcnow().isoformat()

    # Build callback URL
    redirect_uri = request.url_for("github_callback")

    # Redirect to GitHub authorization
    return await oauth.github.authorize_redirect(request, redirect_uri)


async def create_pr_from_draft(
    draft_token: str, github_token: str, session: AsyncSession
) -> str:
    """Create a GitHub PR from a draft.

    Args:
        draft_token: Draft capability token
        github_token: User's GitHub OAuth access token
        session: Database session

    Returns:
        PR URL (html_url)

    Raises:
        HTTPException: If draft is invalid or PR creation fails
    """
    # Validate draft via capability token
    draft = await validate_capability_token(draft_token, session)

    # Check draft status is pending
    if draft.status != DraftStatus.PENDING:
        raise HTTPException(
            status_code=400,
            detail=f"Draft already {draft.status.value}. Only pending drafts can be submitted.",
        )

    # Parse payload
    try:
        payload = DraftPayload(**draft.payload)
    except Exception as e:
        logger.error(f"Failed to parse draft payload: {e}")
        raise HTTPException(status_code=500, detail="Invalid draft payload")

    # Parse diff_preview
    try:
        diff = DraftDiffResponse(**draft.diff_preview) if draft.diff_preview else None
    except Exception as e:
        logger.error(f"Failed to parse draft diff: {e}")
        diff = None

    if not diff:
        raise HTTPException(status_code=500, detail="Draft missing diff preview")

    # Build files from draft
    files = build_files_from_draft(payload)

    if not files:
        raise HTTPException(status_code=400, detail="Draft contains no file changes")

    # Generate branch name
    branch_name = generate_branch_name(str(draft.id))

    # Generate commit message
    commit_message = generate_commit_message(diff)

    # Generate PR title and body
    pr_title = f"Schema update from {payload.wiki_url}"
    pr_body = generate_pr_body(
        diff,
        draft.validation_results or {},
        payload.wiki_url,
        payload.base_version,
    )

    # Create PR via GitHub API
    try:
        pr_url = await GitHubClient(None).create_pr_with_token(  # type: ignore
            token=github_token,
            owner=settings.GITHUB_REPO_OWNER,
            repo=settings.GITHUB_REPO_NAME,
            branch_name=branch_name,
            files=files,
            commit_message=commit_message,
            pr_title=pr_title,
            pr_body=pr_body,
        )
    except Exception as e:
        logger.error(f"Failed to create PR: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create PR: {str(e)}")

    # Update draft status and store PR URL
    draft.status = DraftStatus.SUBMITTED
    draft.pr_url = pr_url
    session.add(draft)
    await session.commit()

    return pr_url


@router.get("/github/callback", name="github_callback")
async def github_callback(request: Request, session: AsyncSession = Depends(get_session)):
    """Handle GitHub OAuth callback.

    Exchanges authorization code for access token and redirects to frontend.

    Args:
        request: FastAPI request with session

    Returns:
        Redirect to frontend draft page with oauth=success

    Raises:
        HTTPException: 400 if OAuth fails or no pending draft found
    """
    # Exchange authorization code for access token
    try:
        token = await oauth.github.authorize_access_token(request)
    except OAuthError as e:
        raise HTTPException(
            status_code=400,
            detail=f"OAuth authorization failed: {str(e)}",
        )

    # Retrieve draft_token from session
    draft_token = request.session.pop("pending_draft_token", None)
    if not draft_token:
        raise HTTPException(
            status_code=400,
            detail="No pending draft found. OAuth session may have expired.",
        )

    # Store access_token and completion time in session
    request.session["github_access_token"] = token["access_token"]
    request.session["oauth_completed_at"] = datetime.utcnow().isoformat()

    # Create PR from draft
    try:
        pr_url = await create_pr_from_draft(draft_token, token["access_token"], session)
        # Success - redirect with PR URL
        redirect_url = f"{settings.FRONTEND_URL}/draft/{draft_token}?pr_url={quote(pr_url)}"
        return RedirectResponse(url=redirect_url)
    except HTTPException as e:
        # Handle known errors
        logger.warning(f"PR creation failed: {e.detail}")
        redirect_url = f"{settings.FRONTEND_URL}/draft/{draft_token}?pr_error={quote(str(e.detail))}"
        return RedirectResponse(url=redirect_url)
    except Exception as e:
        # Handle unexpected errors
        logger.error(f"Unexpected error creating PR: {e}")
        redirect_url = f"{settings.FRONTEND_URL}/draft/{draft_token}?pr_error={quote('Unexpected error creating PR')}"
        return RedirectResponse(url=redirect_url)
