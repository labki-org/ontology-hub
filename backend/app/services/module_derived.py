"""Module derived entities computation service.

Computes derived entities (properties, subobjects, templates) for a module
based on its categories. When a module's categories change, this service
auto-populates the derived entity arrays.

Module members:
- Manual: categories, dependencies (explicitly added by user)
- Derived: properties, subobjects, templates (computed from categories' requirements)
"""

import uuid
from copy import deepcopy

import jsonpatch
from sqlalchemy import text
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.v2 import Category, ChangeType, DraftChange, Property


async def compute_module_derived_entities(
    session: AsyncSession,
    category_keys: list[str],
    draft_id: uuid.UUID | None = None,
) -> dict[str, list[str]]:
    """Compute derived entities from a list of category keys.

    For each category, collects:
    - All properties (required + optional, direct + inherited)
    - All subobjects (required + optional)
    - Templates referenced by properties' has_display_template

    Args:
        session: Async database session
        category_keys: List of category entity_keys
        draft_id: Optional draft UUID for draft-aware resolution

    Returns:
        Dictionary with:
        - "properties": deduplicated list of property entity_keys
        - "subobjects": deduplicated list of subobject entity_keys
        - "templates": deduplicated list of template entity_keys
    """
    if not category_keys:
        return {"properties": [], "subobjects": [], "templates": []}

    properties: set[str] = set()
    subobjects: set[str] = set()
    templates: set[str] = set()

    # Load draft changes if draft_id provided (for draft-aware resolution)
    draft_changes: dict[str, DraftChange] = {}
    if draft_id:
        query = select(DraftChange).where(DraftChange.draft_id == draft_id)
        result = await session.execute(query)
        for change in result.scalars().all():
            draft_changes[f"{change.entity_type}:{change.entity_key}"] = change

    for category_key in category_keys:
        # Get effective category (with draft overlay if applicable)
        effective_props, effective_subs = await _get_category_members(
            session, category_key, draft_changes
        )
        properties.update(effective_props)
        subobjects.update(effective_subs)

    # Collect templates from properties' has_display_template
    if properties:
        templates = await _get_templates_from_properties(session, list(properties), draft_changes)

    return {
        "properties": sorted(properties),
        "subobjects": sorted(subobjects),
        "templates": sorted(templates),
    }


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
        patch_ops: list[dict] = draft_change.patch or []
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
    query = select(Property).where(Property.entity_key.in_(property_keys))  # type: ignore[union-attr]
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
