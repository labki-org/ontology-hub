"""API routers for FastAPI application.

Each router handles a specific resource type with versioned endpoints.
"""

from app.routers.drafts import router as drafts_router

__all__ = ["drafts_router"]
