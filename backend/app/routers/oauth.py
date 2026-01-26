"""OAuth router for GitHub authentication flow.

Handles OAuth login initiation and callback for PR creation.
OAuth tokens are held in session temporarily, never persisted.
"""

import logging
from datetime import datetime
from urllib.parse import quote

from authlib.integrations.base_client.errors import OAuthError
from authlib.integrations.starlette_client import OAuth
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from starlette.responses import RedirectResponse

from app.config import Settings, settings
from app.database import get_session
from app.dependencies.capability import hash_token
from app.models.v2 import Bundle, Draft, DraftChange, DraftStatus, Module, ModuleEntity
from app.services.draft_workflow import transition_to_submitted
from app.services.github import GitHubClient
from app.services.pr_builder import (
    build_files_from_draft_v2,
    generate_branch_name,
    generate_commit_message_v2,
    generate_pr_body_v2,
    generate_pr_title_with_version,
)
from app.services.validation.validator import validate_draft_v2

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
async def github_login(
    request: Request,
    draft_token: str,
    pr_title: str | None = None,
    user_comment: str | None = None,
    suggested_semver: str | None = None,
):
    """Initiate GitHub OAuth flow for PR creation.

    Stores draft_token, pr_title, user_comment, and suggested_semver in session
    and redirects to GitHub authorization.

    Args:
        request: FastAPI request with session
        draft_token: Draft capability token to associate with OAuth
        pr_title: Optional custom PR title
        user_comment: Optional comment to include in PR body
        suggested_semver: Optional suggested semver bump (patch/minor/major)

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

    # Store draft_token and optional params in session for retrieval after OAuth callback
    request.session["pending_draft_token"] = draft_token
    request.session["oauth_initiated_at"] = datetime.utcnow().isoformat()
    if pr_title:
        request.session["pending_pr_title"] = pr_title
    if user_comment:
        request.session["pending_user_comment"] = user_comment
    if suggested_semver:
        request.session["pending_suggested_semver"] = suggested_semver

    # Build callback URL
    redirect_uri = request.url_for("github_callback")

    # Redirect to GitHub authorization
    return await oauth.github.authorize_redirect(request, redirect_uri)


async def create_pr_from_draft(
    draft_token: str,
    github_token: str,
    session: AsyncSession,
    pr_title: str | None = None,
    user_comment: str | None = None,
    suggested_semver: str | None = None,
) -> str:
    """Create a GitHub PR from a draft using v2 models and services.

    Args:
        draft_token: Draft capability token
        github_token: User's GitHub OAuth access token
        session: Database session
        pr_title: Optional custom PR title
        user_comment: Optional comment to include in PR body
        suggested_semver: Optional suggested semver bump (patch/minor/major)

    Returns:
        PR URL (html_url)

    Raises:
        HTTPException: If draft is invalid or PR creation fails
    """
    # Retrieve draft via capability token hash (v2 pattern)
    token_hash = hash_token(draft_token)
    statement = select(Draft).where(Draft.capability_hash == token_hash)
    result = await session.execute(statement)
    draft = result.scalar_one_or_none()

    if draft is None:
        raise HTTPException(status_code=404, detail="Draft not found")

    # Check expiration
    if draft.expires_at < datetime.utcnow():
        raise HTTPException(status_code=404, detail="Draft not found")

    # Check draft status is VALIDATED (v2 requirement)
    if draft.status != DraftStatus.VALIDATED:
        raise HTTPException(
            status_code=400,
            detail=f"Draft must be validated before submitting. Current status: {draft.status.value}",
        )

    # Re-validate before creating PR
    validation = await validate_draft_v2(draft.id, session)
    if not validation.is_valid:
        raise HTTPException(
            status_code=400,
            detail=f"Draft validation failed. Errors: {[e.message for e in validation.errors]}",
        )

    # Load changes
    changes_query = select(DraftChange).where(DraftChange.draft_id == draft.id)
    changes_result = await session.execute(changes_query)
    changes = list(changes_result.scalars().all())

    if not changes:
        raise HTTPException(status_code=400, detail="Draft has no changes to submit.")

    # Gather affected module/bundle keys from changes
    affected_module_keys: set[str] = set()
    affected_bundle_keys: set[str] = set()

    for change in changes:
        if change.entity_type == "module":
            affected_module_keys.add(change.entity_key)
        elif change.entity_type == "bundle":
            affected_bundle_keys.add(change.entity_key)
        elif change.entity_type in ("category", "property", "subobject"):
            # Find which module(s) this entity belongs to
            module_entity_query = select(ModuleEntity).where(
                ModuleEntity.entity_type == change.entity_type,
                ModuleEntity.entity_key == change.entity_key,
            )
            module_entity_result = await session.execute(module_entity_query)
            for module_entity in module_entity_result.scalars():
                # Get module key from module_id
                module_query = select(Module).where(Module.id == module_entity.module_id)
                module_result = await session.execute(module_query)
                if module := module_result.scalar_one_or_none():
                    affected_module_keys.add(module.entity_key)

    # Load current versions for affected modules
    affected_modules: dict[str, str] = {}
    for key in affected_module_keys:
        module_query = select(Module).where(Module.entity_key == key)
        module_result = await session.execute(module_query)
        if module := module_result.scalar_one_or_none():
            affected_modules[key] = module.version or "unversioned"

    # Load current versions for affected bundles
    affected_bundles: dict[str, str] = {}
    for key in affected_bundle_keys:
        bundle_query = select(Bundle).where(Bundle.entity_key == key)
        bundle_result = await session.execute(bundle_query)
        if bundle := bundle_result.scalar_one_or_none():
            affected_bundles[key] = bundle.version or "unversioned"

    # Build files from draft using v2 service
    files = await build_files_from_draft_v2(draft.id, session)
    if not files:
        raise HTTPException(status_code=400, detail="No files to commit.")

    # Generate branch name
    branch_name = generate_branch_name(str(draft.id))

    # Generate commit message using v2 service
    commit_message = generate_commit_message_v2(changes)

    # Generate PR title with version context
    final_pr_title = generate_pr_title_with_version(
        changes=changes,
        base_commit_sha=draft.base_commit_sha,
        suggested_semver=suggested_semver or validation.suggested_semver,
        user_title=pr_title,
    )

    # Generate PR body using v2 service with version context
    pr_body = generate_pr_body_v2(
        changes=changes,
        validation=validation,
        draft_title=draft.title,
        user_comment=user_comment,
        base_commit_sha=draft.base_commit_sha,
        affected_modules=affected_modules if affected_modules else None,
        affected_bundles=affected_bundles if affected_bundles else None,
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
            pr_title=final_pr_title,
            pr_body=pr_body,
        )
    except Exception as e:
        logger.error(f"Failed to create PR: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create PR: {str(e)}") from e

    # Update draft status using v2 workflow transition
    await transition_to_submitted(draft.id, pr_url, session)
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
        ) from e

    # Retrieve draft_token and optional params from session
    draft_token = request.session.pop("pending_draft_token", None)
    if not draft_token:
        raise HTTPException(
            status_code=400,
            detail="No pending draft found. OAuth session may have expired.",
        )

    pr_title = request.session.pop("pending_pr_title", None)
    user_comment = request.session.pop("pending_user_comment", None)
    suggested_semver = request.session.pop("pending_suggested_semver", None)

    # Store access_token and completion time in session
    request.session["github_access_token"] = token["access_token"]
    request.session["oauth_completed_at"] = datetime.utcnow().isoformat()

    # Create PR from draft with optional pr_title, user_comment, and suggested_semver
    try:
        pr_url = await create_pr_from_draft(
            draft_token, token["access_token"], session, pr_title, user_comment, suggested_semver
        )
        # Success - redirect with PR URL
        redirect_url = f"{settings.FRONTEND_URL}/draft/{draft_token}?pr_url={quote(pr_url)}"
        return RedirectResponse(url=redirect_url)
    except HTTPException as e:
        # Handle known errors
        logger.warning(f"PR creation failed: {e.detail}")
        redirect_url = (
            f"{settings.FRONTEND_URL}/draft/{draft_token}?pr_error={quote(str(e.detail))}"
        )
        return RedirectResponse(url=redirect_url)
    except Exception as e:
        # Handle unexpected errors
        logger.error(f"Unexpected error creating PR: {e}")
        redirect_url = f"{settings.FRONTEND_URL}/draft/{draft_token}?pr_error={quote('Unexpected error creating PR')}"
        return RedirectResponse(url=redirect_url)
