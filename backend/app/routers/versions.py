"""Version history and diff API endpoints.

Provides endpoints to list GitHub releases and compute field-level
diffs between versions.
"""

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel
from typing import Any

from app.dependencies.rate_limit import RATE_LIMITS, limiter
from app.services.versions import get_entities_at_version, compute_entity_diff
from app.config import settings

router = APIRouter(prefix="/versions", tags=["versions"])


class ReleasePublic(BaseModel):
    """Public representation of a GitHub release."""

    tag_name: str
    name: str | None
    created_at: str
    published_at: str | None
    body: str | None


class ChangesByType(BaseModel):
    """Changes grouped by change type (added, modified, deleted)."""

    added: list[dict[str, Any]]
    modified: list[dict[str, Any]]
    deleted: list[dict[str, Any]]


class VersionDiffResponse(BaseModel):
    """Response for version diff endpoint."""

    old_version: str
    new_version: str
    categories: ChangesByType
    properties: ChangesByType
    subobjects: ChangesByType
    modules: ChangesByType
    profiles: ChangesByType


@router.get("/", response_model=list[ReleasePublic])
@limiter.limit(RATE_LIMITS["entity_list"])
async def list_releases(request: Request) -> list[ReleasePublic]:
    """List all releases from GitHub repository."""
    github_client = request.app.state.github_client
    if not github_client:
        raise HTTPException(status_code=503, detail="GitHub client not configured")

    owner, repo = settings.github_repo.split("/")
    releases = await github_client.get_releases(owner, repo)

    return [
        ReleasePublic(
            tag_name=r["tag_name"],
            name=r.get("name"),
            created_at=r["created_at"],
            published_at=r.get("published_at"),
            body=r.get("body"),
        )
        for r in releases
    ]


@router.get("/diff", response_model=VersionDiffResponse)
@limiter.limit(RATE_LIMITS["entity_read"])
async def get_version_diff(
    request: Request,
    old: str = Query(..., description="Old version tag"),
    new: str = Query(..., description="New version tag"),
) -> VersionDiffResponse:
    """Get field-level diff between two versions.

    Fetches all entities at both versions and computes the diff,
    grouping changes by entity type (categories, properties, subobjects,
    modules, profiles) and change type (added, modified, deleted).
    """
    github_client = request.app.state.github_client
    if not github_client:
        raise HTTPException(status_code=503, detail="GitHub client not configured")

    # Fetch entities at both versions
    old_entities = await get_entities_at_version(github_client, old)
    new_entities = await get_entities_at_version(github_client, new)

    # Compute diff
    diff = compute_entity_diff(old_entities, new_entities)

    # Group by entity type
    categories: dict[str, list] = {"added": [], "modified": [], "deleted": []}
    properties: dict[str, list] = {"added": [], "modified": [], "deleted": []}
    subobjects: dict[str, list] = {"added": [], "modified": [], "deleted": []}
    modules: dict[str, list] = {"added": [], "modified": [], "deleted": []}
    profiles: dict[str, list] = {"added": [], "modified": [], "deleted": []}

    type_mapping = {
        "categories": categories,
        "properties": properties,
        "subobjects": subobjects,
        "modules": modules,
        "profiles": profiles,
    }

    for change_type in ["added", "modified", "deleted"]:
        for change in diff[change_type]:
            et = change["entity_type"]
            if et in type_mapping:
                type_mapping[et][change_type].append(change)

    return VersionDiffResponse(
        old_version=old,
        new_version=new,
        categories=ChangesByType(**categories),
        properties=ChangesByType(**properties),
        subobjects=ChangesByType(**subobjects),
        modules=ChangesByType(**modules),
        profiles=ChangesByType(**profiles),
    )
