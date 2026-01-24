"""API routers for FastAPI application.

Each router handles a specific resource type with versioned endpoints.
"""

from app.routers.drafts import router as drafts_router
from app.routers.drafts_v2 import router as drafts_v2_router
from app.routers.entities import router as entities_router
from app.routers.graph import router as graph_router
from app.routers.modules import router as modules_router
from app.routers.oauth import router as oauth_router, register_oauth_client
from app.routers.versions import router as versions_router
from app.routers.webhooks import router as webhooks_router

__all__ = [
    "drafts_router",
    "drafts_v2_router",
    "entities_router",
    "graph_router",
    "modules_router",
    "oauth_router",
    "register_oauth_client",
    "versions_router",
    "webhooks_router",
]
