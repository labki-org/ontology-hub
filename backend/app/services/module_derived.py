"""Module derived entities computation service.

Computes derived entities (properties, subobjects, templates, resources) for a module
based on its categories. When a module's categories change, this service
auto-populates the derived entity arrays.

Module members:
- Manual: categories, dependencies (explicitly added by user)
- Derived: properties, subobjects, templates, resources (computed from categories' requirements)

Phase 27 Extension:
- Transitive derivation: follows category refs in properties (Allows_value_from_category)
- Resource inclusion: resources belonging to derived categories
- Cycle-safe: uses visited set pattern with max_depth cap
"""

import uuid
from copy import deepcopy
from typing import Any

import jsonpatch
from sqlalchemy import text
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.v2 import Category, ChangeType, DraftChange, Property, Resource, Subobject
from app.services.resource_validation import get_entity_categories


async def compute_module_derived_entities(
    session: AsyncSession,
    category_keys: list[str],
    draft_id: uuid.UUID | None = None,
    max_depth: int = 10,  # noqa: ARG001 — kept for API compatibility
    track_provenance: bool = False,
) -> dict[str, list[str] | dict[str, str]]:
    """Compute derived entities from a list of category keys.

    For each category, collects:
    - All properties (required + optional, direct + inherited)
    - All subobjects (required + optional)
    - Templates referenced by properties' has_display_template
    - Resources belonging to the category

    Transitive expansion:
    - Follows category refs in properties (Allows_value_from_category, allowed_values.from_category)
    - Continues until no new categories discovered or max_depth reached
    - Uses visited set to prevent cycles

    Args:
        session: Async database session
        category_keys: List of category entity_keys (manual module categories)
        draft_id: Optional draft UUID for draft-aware resolution
        max_depth: Maximum derivation depth (default 10, safety cap)
        track_provenance: Whether to include provenance tracking in result

    Returns:
        Dictionary with:
        - "properties": deduplicated list of property entity_keys
        - "subobjects": deduplicated list of subobject entity_keys
        - "templates": deduplicated list of template entity_keys
        - "resources": deduplicated list of resource entity_keys
        - "provenance": (optional) dict mapping entity_key to derivation reason
    """
    if not category_keys:
        result: dict[str, Any] = {
            "properties": [],
            "subobjects": [],
            "templates": [],
            "resources": [],
        }
        if track_provenance:
            result["provenance"] = {}
        return result

    # Load draft changes if draft_id provided (for draft-aware resolution)
    draft_changes: dict[str, DraftChange] = {}
    if draft_id:
        query = select(DraftChange).where(DraftChange.draft_id == draft_id)
        result_query = await session.execute(query)
        for change in result_query.scalars().all():
            draft_changes[f"{change.entity_type}:{change.entity_key}"] = change

    # Collect properties/subobjects/resources only from the explicit categories
    # (and their inheritance chains via _get_category_members).
    # Referenced categories (via Allows_value_from_category) are NOT expanded —
    # they only need to exist as module dependencies, not contribute their members.
    all_properties: set[str] = set()
    all_subobjects: set[str] = set()
    all_resources: set[str] = set()
    provenance: dict[str, str] = {}

    for cat_key in category_keys:
        props, subs = await _get_category_members(session, cat_key, draft_changes)

        if track_provenance:
            for prop_key in props - all_properties:
                provenance[f"property:{prop_key}"] = f"derived from category {cat_key}"
            for sub_key in subs - all_subobjects:
                provenance[f"subobject:{sub_key}"] = f"derived from category {cat_key}"

        all_properties.update(props)
        all_subobjects.update(subs)

        resources = await _get_category_resources(session, cat_key, draft_changes)
        if track_provenance:
            for res_key in resources - all_resources:
                provenance[f"resource:{res_key}"] = f"derived from category {cat_key}"
        all_resources.update(resources)

    # Collect properties from subobjects (subobject -> required/optional properties)
    if all_subobjects:
        sub_props = await _get_subobject_properties(session, list(all_subobjects), draft_changes)
        if track_provenance:
            for prop_key in sub_props - all_properties:
                provenance[f"property:{prop_key}"] = "derived from subobject"
        all_properties.update(sub_props)

    # After loop: collect templates from all properties
    all_templates: set[str] = set()
    if all_properties:
        all_templates = await _get_templates_from_properties(
            session, list(all_properties), draft_changes
        )
        if track_provenance:
            for tmpl_key in all_templates:
                provenance[f"template:{tmpl_key}"] = "derived from property has_display_template"

    result_dict: dict[str, Any] = {
        "properties": sorted(all_properties),
        "subobjects": sorted(all_subobjects),
        "templates": sorted(all_templates),
        "resources": sorted(all_resources),
    }

    if track_provenance:
        result_dict["provenance"] = provenance

    return result_dict


async def _get_effective_property_json(
    session: AsyncSession,
    property_key: str,
    draft_changes: dict[str, DraftChange],
) -> dict | None:
    """Get effective property JSON with draft overlay applied.

    Args:
        session: Async database session
        property_key: Property entity_key
        draft_changes: Dict of draft changes keyed by "entity_type:entity_key"

    Returns:
        Effective property JSON dict, or None if property doesn't exist
    """
    change_key = f"property:{property_key}"
    draft_change = draft_changes.get(change_key)

    # Handle draft-created property
    if draft_change and draft_change.change_type == ChangeType.CREATE:
        return draft_change.replacement_json or {}

    # Query canonical property
    query = select(Property).where(Property.entity_key == property_key)
    result = await session.execute(query)
    prop = result.scalar_one_or_none()

    if not prop:
        return None

    # Handle draft-updated property
    if draft_change and draft_change.change_type == ChangeType.UPDATE:
        canonical_json: dict = deepcopy(prop.canonical_json)
        try:
            patch = jsonpatch.JsonPatch(draft_change.patch or [])
            patched: dict = patch.apply(canonical_json)
            return patched
        except jsonpatch.JsonPatchException:
            return canonical_json

    return dict(prop.canonical_json)


async def _extract_category_refs_from_properties(
    session: AsyncSession,
    property_keys: set[str],
    draft_changes: dict[str, DraftChange],
) -> set[str]:
    """Extract categories referenced by properties via allowed_values.

    Checks both formats per schema:
    1. Top-level: "Allows_value_from_category": "SOP"
    2. Nested: "allowed_values": {"from_category": "SOP"}

    Args:
        session: Async database session
        property_keys: Set of property entity_keys to scan
        draft_changes: Dict of draft changes

    Returns:
        Set of referenced category keys
    """
    category_refs: set[str] = set()

    for prop_key in property_keys:
        effective_json = await _get_effective_property_json(session, prop_key, draft_changes)
        if not effective_json:
            continue

        # Check format 1: Top-level "Allows_value_from_category"
        if "Allows_value_from_category" in effective_json:
            ref = effective_json["Allows_value_from_category"]
            if isinstance(ref, str) and ref:
                category_refs.add(ref)

        # Check format 2: Nested "allowed_values.from_category"
        allowed = effective_json.get("allowed_values")
        if isinstance(allowed, dict) and "from_category" in allowed:
            ref = allowed["from_category"]
            if isinstance(ref, str) and ref:
                category_refs.add(ref)

    return category_refs


async def _get_category_resources(
    session: AsyncSession,
    category_key: str,
    draft_changes: dict[str, DraftChange],
) -> set[str]:
    """Get all resources belonging to a category.

    Queries both canonical resources from database and draft-created resources.

    Args:
        session: Async database session
        category_key: Category entity_key
        draft_changes: Dict of draft changes

    Returns:
        Set of resource entity_keys belonging to this category
    """
    resources: set[str] = set()

    # Select only the columns we need (avoids loading full canonical_json blobs).
    # Uses Python filtering for SQLite compatibility in tests.
    query = select(Resource.entity_key, Resource.category_keys)
    result = await session.execute(query)
    for row in result.all():
        if category_key in (row[1] or []):
            resources.add(row[0])

    # Include draft-created resources for this category
    for key, change in draft_changes.items():
        if key.startswith("resource:") and change.change_type == ChangeType.CREATE:
            replacement = change.replacement_json or {}
            cats = get_entity_categories(replacement)
            if category_key in cats:
                resource_key = key.split(":", 1)[1]
                resources.add(resource_key)

    return resources


async def _get_category_members(
    session: AsyncSession,
    category_key: str,
    draft_changes: dict[str, DraftChange],
) -> tuple[set[str], set[str]]:
    """Get all properties and subobjects for a category (direct + inherited).

    Args:
        session: Async database session
        category_key: Category entity_key
        draft_changes: Dict of draft changes keyed by "entity_type:entity_key"

    Returns:
        Tuple of (property_keys, subobject_keys)
    """
    properties: set[str] = set()
    subobjects: set[str] = set()

    # Check if this category has a draft change
    change_key = f"category:{category_key}"
    draft_change = draft_changes.get(change_key)

    if draft_change and draft_change.change_type == ChangeType.CREATE:
        # Draft-created category: use replacement_json
        effective = draft_change.replacement_json or {}
        properties.update(effective.get("required_properties", []))
        properties.update(effective.get("optional_properties", []))
        subobjects.update(effective.get("required_subobjects", []))
        subobjects.update(effective.get("optional_subobjects", []))

        # Also inherit from parents if specified
        parents = effective.get("parents", [])
        for parent_key in parents:
            parent_props, parent_subs = await _get_category_members(
                session, parent_key, draft_changes
            )
            properties.update(parent_props)
            subobjects.update(parent_subs)

        return properties, subobjects

    # Get canonical category
    query = select(Category).where(Category.entity_key == category_key)
    result = await session.execute(query)
    category = result.scalar_one_or_none()

    if not category:
        # Category doesn't exist (might be draft-created without our knowledge)
        return properties, subobjects

    # Apply draft patch if exists
    if draft_change and draft_change.change_type == ChangeType.UPDATE:
        canonical_json = deepcopy(category.canonical_json)
        try:
            patch = jsonpatch.JsonPatch(draft_change.patch or [])
            effective = patch.apply(canonical_json)
        except jsonpatch.JsonPatchException:
            effective = canonical_json

        # Use effective JSON for direct properties (draft may have added/removed)
        properties.update(effective.get("required_properties", []))
        properties.update(effective.get("optional_properties", []))
        subobjects.update(effective.get("required_subobjects", []))
        subobjects.update(effective.get("optional_subobjects", []))

        # Also add inherited properties from canonical (depth > 0)
        inherited_query = text("""
            SELECT p.entity_key
            FROM category_property_effective cpe
            JOIN properties p ON p.id = cpe.property_id
            JOIN categories c ON c.id = cpe.category_id
            WHERE c.entity_key = :entity_key AND cpe.depth > 0
        """)
        inherited_result = await session.execute(inherited_query, {"entity_key": category_key})
        for row in inherited_result.fetchall():
            properties.add(row[0])

        # Draft-aware parent inheritance
        effective_parents = effective.get("parents", [])
        for parent_key in effective_parents:
            parent_props, parent_subs = await _get_category_members(
                session, parent_key, draft_changes
            )
            properties.update(parent_props)
            subobjects.update(parent_subs)
    else:
        effective = category.canonical_json

        # No draft changes — use canonical materialized view
        props_query = text("""
            SELECT p.entity_key
            FROM category_property_effective cpe
            JOIN properties p ON p.id = cpe.property_id
            JOIN categories c ON c.id = cpe.category_id
            WHERE c.entity_key = :entity_key
        """)
        props_result = await session.execute(props_query, {"entity_key": category_key})
        for row in props_result.fetchall():
            properties.add(row[0])

        # Canonical subobjects
        subs_query = text("""
            SELECT s.entity_key
            FROM category_subobject cs
            JOIN subobjects s ON s.id = cs.subobject_id
            JOIN categories c ON c.id = cs.category_id
            WHERE c.entity_key = :entity_key
        """)
        subs_result = await session.execute(subs_query, {"entity_key": category_key})
        for row in subs_result.fetchall():
            subobjects.add(row[0])

        subobjects.update(effective.get("required_subobjects", []))
        subobjects.update(effective.get("optional_subobjects", []))

    return properties, subobjects


async def _get_subobject_properties(
    session: AsyncSession,
    subobject_keys: list[str],
    draft_changes: dict[str, DraftChange],
) -> set[str]:
    """Get all properties referenced by subobjects.

    Args:
        session: Async database session
        subobject_keys: List of subobject entity_keys
        draft_changes: Dict of draft changes

    Returns:
        Set of property entity_keys used by these subobjects
    """
    properties: set[str] = set()

    if not subobject_keys:
        return properties

    # Query canonical subobjects
    query = select(Subobject).where(col(Subobject.entity_key).in_(subobject_keys))
    result = await session.execute(query)
    for sub in result.scalars().all():
        change_key = f"subobject:{sub.entity_key}"
        draft_change = draft_changes.get(change_key)

        if draft_change and draft_change.change_type == ChangeType.UPDATE:
            canonical_json = deepcopy(sub.canonical_json)
            try:
                patch = jsonpatch.JsonPatch(draft_change.patch or [])
                effective = patch.apply(canonical_json)
            except jsonpatch.JsonPatchException:
                effective = canonical_json
        else:
            effective = sub.canonical_json

        properties.update(effective.get("required_properties", []))
        properties.update(effective.get("optional_properties", []))

    # Also check draft-created subobjects
    for key, change in draft_changes.items():
        if key.startswith("subobject:") and change.change_type == ChangeType.CREATE:
            sub_key = key.split(":", 1)[1]
            if sub_key in subobject_keys:
                replacement = change.replacement_json or {}
                properties.update(replacement.get("required_properties", []))
                properties.update(replacement.get("optional_properties", []))

    return properties


async def _get_templates_from_properties(
    session: AsyncSession,
    property_keys: list[str],
    draft_changes: dict[str, DraftChange],
) -> set[str]:
    """Get templates referenced by properties' has_display_template.

    Args:
        session: Async database session
        property_keys: List of property entity_keys
        draft_changes: Dict of draft changes

    Returns:
        Set of template entity_keys
    """
    templates: set[str] = set()

    if not property_keys:
        return templates

    # Query canonical properties with has_display_template_key
    query = select(Property).where(col(Property.entity_key).in_(property_keys))
    result = await session.execute(query)
    props = result.scalars().all()

    for prop in props:
        # Check for draft modification
        change_key = f"property:{prop.entity_key}"
        draft_change = draft_changes.get(change_key)

        if draft_change and draft_change.change_type == ChangeType.UPDATE:
            # Apply patch to get effective template
            canonical_json = deepcopy(prop.canonical_json)
            try:
                patch = jsonpatch.JsonPatch(draft_change.patch or [])
                effective = patch.apply(canonical_json)
            except jsonpatch.JsonPatchException:
                effective = canonical_json

            template_key = effective.get("has_display_template")
            if template_key:
                templates.add(template_key)
        elif prop.has_display_template_key:
            templates.add(prop.has_display_template_key)

    # Also check draft-created properties
    for key, change in draft_changes.items():
        if key.startswith("property:") and change.change_type == ChangeType.CREATE:
            prop_key = key.split(":", 1)[1]
            if prop_key in property_keys:
                replacement = change.replacement_json or {}
                template_key = replacement.get("has_display_template")
                if template_key:
                    templates.add(template_key)

    return templates
