"""Draft overlay service for computing effective entity views.

This service loads draft changes and applies them to canonical data
to produce effective views for query endpoints. Server-side overlay
computation ensures frontend never performs draft merging.
"""

import uuid
from copy import deepcopy
from typing import Annotated, Optional

import jsonpatch
from fastapi import Depends, Query
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.database import SessionDep
from app.models.v2 import ChangeType, DraftChange


class DraftOverlayService:
    """Compute effective views by applying draft changes to canonical entities.

    When a draft_id is provided, this service:
    1. Loads all draft changes for the draft (cached per-request)
    2. For each entity query, applies the appropriate overlay:
       - CREATE: Return replacement_json with _change_status="added"
       - DELETE: Return canonical with _change_status="deleted", _deleted=True
       - UPDATE: Apply JSON Patch to canonical, return with _change_status="modified"
       - No change: Return canonical with _change_status="unchanged"

    Usage:
        draft_ctx = DraftOverlayService(session, draft_id=uuid)
        effective = await draft_ctx.apply_overlay(canonical, "category", "Person")
    """

    def __init__(
        self, session: AsyncSession, draft_id: Optional[uuid.UUID] = None
    ) -> None:
        """Initialize draft overlay service.

        Args:
            session: Async database session
            draft_id: Optional draft UUID for effective view computation.
                      If None, all queries return canonical data only.
        """
        self.session = session
        self.draft_id = draft_id
        self._draft_changes: Optional[dict[str, DraftChange]] = None

    async def _load_draft_changes(self) -> dict[str, DraftChange]:
        """Load all changes for this draft, keyed by '{entity_type}:{entity_key}'.

        Changes are cached for the lifetime of this service instance
        (typically one request).

        Returns:
            Dict mapping "entity_type:entity_key" to DraftChange objects
        """
        if self._draft_changes is not None:
            return self._draft_changes

        if not self.draft_id:
            self._draft_changes = {}
            return self._draft_changes

        query = select(DraftChange).where(DraftChange.draft_id == self.draft_id)
        result = await self.session.execute(query)
        changes = result.scalars().all()

        self._draft_changes = {
            f"{change.entity_type}:{change.entity_key}": change for change in changes
        }
        return self._draft_changes

    async def apply_overlay(
        self,
        canonical: Optional[object],
        entity_type: str,
        entity_key: str,
    ) -> Optional[dict]:
        """Apply draft changes to canonical entity, return effective JSON with change_status.

        This is the main method for computing effective views. It handles all
        draft change types:
        - CREATE: Return replacement_json with _change_status="added"
        - DELETE: Return canonical with _change_status="deleted", _deleted=True
        - UPDATE: Deep copy canonical, apply JSON Patch, return with _change_status="modified"
        - No change: Return canonical JSON with _change_status="unchanged"

        Args:
            canonical: SQLModel instance with canonical_json attribute, or None
            entity_type: Entity type string (e.g., "category", "property")
            entity_key: Entity key to look up in draft changes

        Returns:
            Effective entity dict with _change_status metadata, or None if:
            - Entity doesn't exist in canonical AND no draft creates it
            - DELETE of non-existent entity

        Note:
            Always deep copies before applying JSON Patch to avoid mutating
            cached/shared data.
        """
        changes = await self._load_draft_changes()
        change_key = f"{entity_type}:{entity_key}"
        draft_change = changes.get(change_key)

        # No draft context or no changes for this entity
        if not draft_change:
            if canonical is not None:
                # Return canonical with "unchanged" status
                canonical_json = getattr(canonical, "canonical_json", None)
                if canonical_json:
                    result = deepcopy(canonical_json)
                    result["_change_status"] = "unchanged"
                    return result
            return None

        # Draft creates new entity
        if draft_change.change_type == ChangeType.CREATE:
            if draft_change.replacement_json:
                result = deepcopy(draft_change.replacement_json)
                result["_change_status"] = "added"
                return result
            return None

        # Draft deletes entity
        if draft_change.change_type == ChangeType.DELETE:
            if canonical is not None:
                canonical_json = getattr(canonical, "canonical_json", None)
                if canonical_json:
                    result = deepcopy(canonical_json)
                    result["_change_status"] = "deleted"
                    result["_deleted"] = True
                    return result
            # Deleted entity that doesn't exist in canonical (shouldn't happen)
            return None

        # Draft updates entity (apply JSON Patch)
        if draft_change.change_type == ChangeType.UPDATE:
            if canonical is None:
                # Update to non-existent entity (shouldn't happen)
                return None

            canonical_json = getattr(canonical, "canonical_json", None)
            if not canonical_json:
                return None

            # Deep copy to avoid mutating cached canonical data
            base = deepcopy(canonical_json)

            # Apply JSON Patch operations
            try:
                patch_ops = draft_change.patch
                if patch_ops:
                    patch = jsonpatch.JsonPatch(patch_ops)
                    result = patch.apply(base)
                else:
                    result = base
                result["_change_status"] = "modified"
                return result
            except jsonpatch.JsonPatchException as e:
                # Patch failed - return canonical with error marker
                # This indicates draft is stale or invalid
                result = deepcopy(canonical_json)
                result["_change_status"] = "unchanged"
                result["_patch_error"] = str(e)
                return result

        return None

    async def get_draft_creates(self, entity_type: str) -> list[dict]:
        """Get all CREATE changes for an entity type.

        Used for list queries to include draft-created entities
        alongside canonical entities.

        Args:
            entity_type: Entity type to filter (e.g., "category", "property")

        Returns:
            List of replacement_json dicts with _change_status="added"
        """
        if not self.draft_id:
            return []

        # Query draft changes for this entity type with CREATE change type
        query = (
            select(DraftChange)
            .where(DraftChange.draft_id == self.draft_id)
            .where(DraftChange.change_type == ChangeType.CREATE)
            .where(DraftChange.entity_type == entity_type)
        )
        result = await self.session.execute(query)
        changes = result.scalars().all()

        creates = []
        for change in changes:
            if change.replacement_json:
                entity = deepcopy(change.replacement_json)
                entity["_change_status"] = "added"
                creates.append(entity)

        return creates

    async def is_deleted(self, entity_type: str, entity_key: str) -> bool:
        """Check if an entity is deleted in the draft.

        Useful for filtering list queries where deleted entities
        should be marked but shown.

        Args:
            entity_type: Entity type string
            entity_key: Entity key to check

        Returns:
            True if entity has DELETE change in draft
        """
        changes = await self._load_draft_changes()
        change_key = f"{entity_type}:{entity_key}"
        draft_change = changes.get(change_key)

        if draft_change and draft_change.change_type == ChangeType.DELETE:
            return True
        return False

    async def get_draft_aware_inherited_properties(
        self,
        session: AsyncSession,
        category_entity_key: str,
        canonical_category_id: Optional[uuid.UUID],
    ) -> list[dict]:
        """Compute inherited properties with draft parent changes applied.

        When a draft modifies a category's parents (via JSON Patch on the
        "parents" field), this method:
        1. Gets canonical inherited properties from category_property_effective
        2. Detects draft changes to this category's parents
        3. Walks the draft-modified inheritance graph to compute additional
           inherited properties from draft-added parents
        4. Excludes properties that would be inherited from draft-removed parents

        Args:
            session: Async database session
            category_entity_key: Entity key of the category to compute inheritance for
            canonical_category_id: UUID of canonical category, or None if draft-created

        Returns:
            List of PropertyProvenance-compatible dicts with:
            - entity_key: property entity_key
            - label: property label
            - is_direct: False (all inherited)
            - is_inherited: True
            - is_required: bool
            - source_category: entity_key of source
            - inheritance_depth: int

            Returns empty list if no draft context or no parent changes in draft.
        """
        from sqlalchemy import text

        # No draft context - caller should use canonical query
        if not self.draft_id:
            return []

        # Load draft changes
        changes = await self._load_draft_changes()
        change_key = f"category:{category_entity_key}"
        draft_change = changes.get(change_key)

        # No change for this category in draft - caller can use canonical
        if not draft_change:
            return []

        # Only UPDATE changes can modify parents
        if draft_change.change_type != ChangeType.UPDATE:
            return []

        # Check if patch modifies parents
        patch_ops = draft_change.patch or []
        modifies_parents = any(
            op.get("path", "").startswith("/parents") for op in patch_ops
        )

        if not modifies_parents:
            return []

        # Get canonical parents list
        canonical_parents: list[str] = []
        if canonical_category_id:
            canonical_parents_query = text("""
                SELECT c.entity_key
                FROM category_parent cp
                JOIN categories c ON c.id = cp.parent_id
                WHERE cp.category_id = :category_id
            """)
            result = await session.execute(
                canonical_parents_query, {"category_id": canonical_category_id}
            )
            canonical_parents = [row[0] for row in result.fetchall()]

        # Apply patch to get effective parents
        canonical_json = {"parents": canonical_parents}
        try:
            patch = jsonpatch.JsonPatch(patch_ops)
            effective_json = patch.apply(deepcopy(canonical_json))
            effective_parents: list[str] = effective_json.get("parents", [])
        except jsonpatch.JsonPatchException:
            # Patch failed - return empty, caller will use canonical
            return []

        # If parents unchanged after patch, caller can use canonical
        if set(effective_parents) == set(canonical_parents):
            return []

        # Parents changed - compute inheritance manually
        # Walk the parent chain to collect all ancestors with depth
        # Visited tracks (entity_key, depth) to find min depth per category
        ancestors: dict[str, int] = {}  # entity_key -> min depth
        visited: set[str] = set()

        async def walk_parents(parent_keys: list[str], depth: int) -> None:
            """Recursively walk parent chain, tracking depth."""
            for parent_key in parent_keys:
                if parent_key in visited:
                    continue
                visited.add(parent_key)

                # Track min depth for this ancestor
                if parent_key not in ancestors or depth < ancestors[parent_key]:
                    ancestors[parent_key] = depth

                # Check if this parent has draft changes to its parents
                parent_change_key = f"category:{parent_key}"
                parent_change = changes.get(parent_change_key)

                grandparent_keys: list[str] = []

                if parent_change and parent_change.change_type == ChangeType.UPDATE:
                    # Apply patch to get effective grandparents
                    parent_patch = parent_change.patch or []
                    if any(
                        op.get("path", "").startswith("/parents")
                        for op in parent_patch
                    ):
                        # Get canonical grandparents
                        gp_query = text("""
                            SELECT c2.entity_key
                            FROM categories c
                            JOIN category_parent cp ON cp.category_id = c.id
                            JOIN categories c2 ON c2.id = cp.parent_id
                            WHERE c.entity_key = :entity_key
                        """)
                        gp_result = await session.execute(
                            gp_query, {"entity_key": parent_key}
                        )
                        canonical_grandparents = [row[0] for row in gp_result.fetchall()]

                        try:
                            gp_patch = jsonpatch.JsonPatch(parent_patch)
                            gp_effective = gp_patch.apply(
                                {"parents": canonical_grandparents}
                            )
                            grandparent_keys = gp_effective.get("parents", [])
                        except jsonpatch.JsonPatchException:
                            grandparent_keys = canonical_grandparents
                    else:
                        # No parent changes in this category's patch
                        gp_query = text("""
                            SELECT c2.entity_key
                            FROM categories c
                            JOIN category_parent cp ON cp.category_id = c.id
                            JOIN categories c2 ON c2.id = cp.parent_id
                            WHERE c.entity_key = :entity_key
                        """)
                        gp_result = await session.execute(
                            gp_query, {"entity_key": parent_key}
                        )
                        grandparent_keys = [row[0] for row in gp_result.fetchall()]
                else:
                    # No draft change for this parent - use canonical
                    gp_query = text("""
                        SELECT c2.entity_key
                        FROM categories c
                        JOIN category_parent cp ON cp.category_id = c.id
                        JOIN categories c2 ON c2.id = cp.parent_id
                        WHERE c.entity_key = :entity_key
                    """)
                    gp_result = await session.execute(
                        gp_query, {"entity_key": parent_key}
                    )
                    grandparent_keys = [row[0] for row in gp_result.fetchall()]

                if grandparent_keys:
                    await walk_parents(grandparent_keys, depth + 1)

        # Start walking from effective parents at depth 1
        await walk_parents(effective_parents, 1)

        # Now collect properties from all ancestors
        properties: list[dict] = []

        # Get direct properties for the category itself (depth=0)
        if canonical_category_id:
            direct_props_query = text("""
                SELECT p.entity_key, p.label, cp.is_required
                FROM category_property cp
                JOIN properties p ON p.id = cp.property_id
                WHERE cp.category_id = :category_id
            """)
            direct_result = await session.execute(
                direct_props_query, {"category_id": canonical_category_id}
            )
            for row in direct_result.fetchall():
                properties.append({
                    "entity_key": row[0],
                    "label": row[1],
                    "is_direct": True,
                    "is_inherited": False,
                    "is_required": row[2],
                    "source_category": category_entity_key,
                    "inheritance_depth": 0,
                })

        # Get properties from each ancestor
        for ancestor_key, depth in ancestors.items():
            # Get ancestor's direct properties
            ancestor_props_query = text("""
                SELECT p.entity_key, p.label, cp.is_required
                FROM category_property cp
                JOIN properties p ON p.id = cp.property_id
                JOIN categories c ON c.id = cp.category_id
                WHERE c.entity_key = :entity_key
            """)
            ancestor_result = await session.execute(
                ancestor_props_query, {"entity_key": ancestor_key}
            )
            for row in ancestor_result.fetchall():
                properties.append({
                    "entity_key": row[0],
                    "label": row[1],
                    "is_direct": False,
                    "is_inherited": True,
                    "is_required": row[2],
                    "source_category": ancestor_key,
                    "inheritance_depth": depth,
                })

        # Deduplicate properties - keep the one with min depth
        seen_props: dict[str, dict] = {}
        for prop in properties:
            prop_key = prop["entity_key"]
            if prop_key not in seen_props:
                seen_props[prop_key] = prop
            elif prop["inheritance_depth"] < seen_props[prop_key]["inheritance_depth"]:
                seen_props[prop_key] = prop

        # Return sorted by depth, then label
        result = list(seen_props.values())
        result.sort(key=lambda p: (p["inheritance_depth"], p["label"]))
        return result


async def get_draft_context(
    session: SessionDep,
    draft_id: Optional[uuid.UUID] = Query(
        None, description="Draft UUID for effective view"
    ),
) -> DraftOverlayService:
    """FastAPI dependency for draft overlay context.

    Provides a DraftOverlayService instance for query endpoints.
    If draft_id is None, the service returns canonical data only.
    If draft_id is provided, the service merges draft changes.

    Usage in endpoint:
        @router.get("/categories/{entity_key}")
        async def get_category(
            entity_key: str,
            draft_ctx: DraftContextDep,
        ):
            ...
    """
    return DraftOverlayService(session=session, draft_id=draft_id)


# Type alias for dependency injection
DraftContextDep = Annotated[DraftOverlayService, Depends(get_draft_context)]
