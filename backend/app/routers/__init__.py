"""API routers for FastAPI application.

Each router handles a specific resource type with versioned endpoints.
"""

from app.routers.draft_changes import router as draft_changes_router
from app.routers.drafts import router as drafts_router
from app.routers.graph import router as graph_router
from app.routers.mediawiki_import import router as mediawiki_import_router
from app.routers.oauth import register_oauth_client
from app.routers.oauth import router as oauth_router
from app.routers.webhooks import router as webhooks_router

__all__ = [
    "draft_changes_router",
    "drafts_router",
    "graph_router",
    "mediawiki_import_router",
    "oauth_router",
    "register_oauth_client",
    "webhooks_router",
]
