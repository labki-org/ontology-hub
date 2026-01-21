"""API routers for FastAPI application.

Each router handles a specific resource type with versioned endpoints.
"""

from app.routers.drafts import router as drafts_router
from app.routers.entities import router as entities_router
from app.routers.webhooks import router as webhooks_router

__all__ = ["drafts_router", "entities_router", "webhooks_router"]
