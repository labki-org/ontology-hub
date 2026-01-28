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

from app.models.v2 import Category, ChangeType, DraftChange, Property, Resource


async def compute_module_derived_entities(
    session: AsyncSession,
    category_keys: list[str],
    draft_id: uuid.UUID | None = None,
    max_depth: int = 10,
    track_provenance: bool = False,
) -> dict[str, list[str] | dict[str, str]]:
    """Compute derived entities from a list of category keys with transitive expansion.

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

    # Initialize tracking sets
    visited_categories: set[str] = set()
    pending_categories: set[str] = set(category_keys)

    # Initialize collectors
    all_properties: set[str] = set()
    all_subobjects: set[str] = set()
    all_resources: set[str] = set()

    # Provenance tracking (optional)
    provenance: dict[str, str] = {}

    # Track properties collected per iteration for category ref extraction
    newly_collected_properties: set[str] = set()

    depth = 0
    while pending_categories and depth < max_depth:
        depth += 1
        current_batch = pending_categories - visited_categories
        if not current_batch:
            break

        visited_categories.update(current_batch)
        newly_collected_properties.clear()

        for cat_key in current_batch:
            # Get category's members (properties, subobjects)
            props, subs = await _get_category_members(session, cat_key, draft_changes)

            # Track new properties for category ref extraction
            new_props = props - all_properties
            newly_collected_properties.update(new_props)

            # Record provenance for properties/subobjects
            if track_provenance:
                is_manual = cat_key in category_keys
                reason = "manual (from module.categories)" if is_manual else f"derived from category {cat_key}"
                for prop_key in new_props:
                    if prop_key not in provenance:
                        provenance[f"property:{prop_key}"] = f"derived from category {cat_key}"
                for sub_key in subs - all_subobjects:
                    if sub_key not in provenance:
                        provenance[f"subobject:{sub_key}"] = f"derived from category {cat_key}"

            all_properties.update(props)
            all_subobjects.update(subs)

            # Get resources for this category
            resources = await _get_category_resources(session, cat_key, draft_changes)
            if track_provenance:
                for res_key in resources - all_resources:
                    provenance[f"resource:{res_key}"] = f"derived from category {cat_key}"
            all_resources.update(resources)

        # Extract category refs from newly collected properties
        if newly_collected_properties:
            new_category_refs = await _extract_category_refs_from_properties(
                session, newly_collected_properties, draft_changes
            )
            # Add newly discovered categories to pending
            new_cats = new_category_refs - visited_categories
            if track_provenance:
                for new_cat in new_cats:
                    # Find which property referenced this category
                    provenance[f"category:{new_cat}"] = "derived because a property references it"
            pending_categories.update(new_cats)

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
        canonical_json = deepcopy(prop.canonical_json)
        try:
            patch = jsonpatch.JsonPatch(draft_change.patch or [])
            return patch.apply(canonical_json)
        except jsonpatch.JsonPatchException:
            return canonical_json

    return prop.canonical_json


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

    # Query canonical resources
    query = select(Resource.entity_key).where(Resource.category_key == category_key)
    result = await session.execute(query)
    for row in result.fetchall():
        resources.add(row[0])

    # Include draft-created resources for this category
    for key, change in draft_changes.items():
        if key.startswith("resource:") and change.change_type == ChangeType.CREATE:
            replacement = change.replacement_json or {}
            # Resources store category_key in the "category" field of canonical_json
            # or directly in the resource model's category_key field
            if replacement.get("category") == category_key:
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
    else:
        effective = category.canonical_json

    # Get properties from category_property_effective materialized view
    # This includes both direct and inherited properties
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

    # If draft modifies parents, we need draft-aware inheritance
    if draft_change and draft_change.change_type == ChangeType.UPDATE:
        patch_ops: list[dict[str, Any]] = list(draft_change.patch) if draft_change.patch else []
        modifies_parents = any(op.get("path", "").startswith("/parents") for op in patch_ops)

        if modifies_parents:
            # Compute draft-aware inherited properties
            effective_parents = effective.get("parents", [])
            for parent_key in effective_parents:
                parent_props, parent_subs = await _get_category_members(
                    session, parent_key, draft_changes
                )
                properties.update(parent_props)
                subobjects.update(parent_subs)

    # Get subobjects from category_subobject table
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

    # Also check canonical_json for subobjects (draft-modified)
    subobjects.update(effective.get("required_subobjects", []))
    subobjects.update(effective.get("optional_subobjects", []))

    return properties, subobjects


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
