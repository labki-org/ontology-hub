"""OAuth router for GitHub authentication flow.

Handles OAuth login initiation and callback for PR creation.
OAuth tokens are held in session temporarily, never persisted.
"""

from datetime import datetime

from authlib.integrations.starlette_client import OAuth
from authlib.integrations.base_client.errors import OAuthError
from fastapi import APIRouter, HTTPException, Request
from starlette.responses import RedirectResponse

from app.config import Settings


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


@router.get("/github/callback", name="github_callback")
async def github_callback(request: Request):
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

    # Store access_token in session temporarily (next plan will use it for PR creation)
    request.session["github_access_token"] = token["access_token"]
    request.session["oauth_completed_at"] = datetime.utcnow().isoformat()

    # Get frontend URL from settings via request.app.state or config
    from app.config import settings

    # Redirect to frontend draft page
    redirect_url = f"{settings.FRONTEND_URL}/draft/{draft_token}?oauth=success"
    return RedirectResponse(url=redirect_url)
