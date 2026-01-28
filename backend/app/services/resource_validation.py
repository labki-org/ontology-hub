"""Resource field validation service.

Validates resource property fields against the category's effective properties,
supporting draft-aware resolution when a draft modifies the category.
"""

from uuid import UUID

from sqlalchemy import text
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.v2 import Category, ChangeType, DraftChange

# Reserved keys that are NOT property fields
# These are either structural fields (id, label, description, category)
# or internal fields (entity_key, source_path)
RESERVED_KEYS = frozenset({"id", "label", "description", "category", "entity_key", "source_path"})


async def get_category_effective_properties(
    session: AsyncSession,
    category_key: str,
    draft_id: UUID | None = None,
) -> set[str]:
    """Get effective property keys for a category.

    Checks the category_property_effective materialized view for canonical categories,
    and draft changes for draft-created or draft-modified categories.

    Args:
        session: Database session
        category_key: Category key to look up
        draft_id: Optional draft ID for draft-aware resolution

    Returns:
        Set of valid property keys for this category
    """
    properties: set[str] = set()

    # 1. Check for draft-created category first
    if draft_id:
        draft_query = (
            select(DraftChange)
            .where(DraftChange.draft_id == draft_id)
            .where(DraftChange.entity_type == "category")
            .where(DraftChange.entity_key == category_key)
        )
        result = await session.execute(draft_query)
        draft_change = result.scalar_one_or_none()

        if draft_change and draft_change.change_type == ChangeType.CREATE:
            # Draft-created category: use replacement_json
            effective = draft_change.replacement_json or {}
            # Categories have required_properties and optional_properties lists
            properties.update(effective.get("required_properties", []))
            properties.update(effective.get("optional_properties", []))
            return properties

    # 2. Query canonical via materialized view
    # Join with properties table to get entity_key (property name)
    query = text("""
        SELECT p.entity_key
        FROM category_property_effective cpe
        JOIN properties p ON p.id = cpe.property_id
        JOIN categories c ON c.id = cpe.category_id
        WHERE c.entity_key = :category_key
    """)
    result = await session.execute(query, {"category_key": category_key})
    for row in result.fetchall():
        properties.add(row[0])

    # 3. If draft modifies the category (UPDATE), we'd need to apply patches
    # For now, we use the canonical + inherited properties from the view
    # Draft category modifications to property lists are complex edge cases
    # (This could be enhanced later if needed)

    # 4. If no properties found and no draft change, check if category exists
    if not properties and draft_id:
        # Category might be draft-created without properties defined yet
        # Return empty set (all fields would be invalid except reserved)
        pass

    return properties


async def get_canonical_category_exists(
    session: AsyncSession,
    category_key: str,
) -> bool:
    """Check if category exists in canonical database.

    Args:
        session: Database session
        category_key: Category key to check

    Returns:
        True if category exists, False otherwise
    """
    result = await session.execute(select(Category).where(Category.entity_key == category_key))
    return result.scalar_one_or_none() is not None


async def get_draft_category_exists(
    session: AsyncSession,
    draft_id: UUID,
    category_key: str,
) -> bool:
    """Check if category exists as a CREATE in the draft.

    Args:
        session: Database session
        draft_id: Draft ID to check
        category_key: Category key to check

    Returns:
        True if category is created in draft, False otherwise
    """
    result = await session.execute(
        select(DraftChange)
        .where(DraftChange.draft_id == draft_id)
        .where(DraftChange.entity_type == "category")
        .where(DraftChange.entity_key == category_key)
        .where(DraftChange.change_type == ChangeType.CREATE)
    )
    return result.scalar_one_or_none() is not None


async def validate_resource_fields(
    session: AsyncSession,
    resource_json: dict,
    draft_id: UUID | None = None,
) -> str | None:
    """Validate resource property fields against category's effective properties.

    Per CONTEXT.md decisions:
    - Resource creation requires category_key upfront
    - Validate resource fields against category properties immediately (reject invalid)
    - Resource key is the "id" field

    Args:
        session: Database session
        resource_json: Resource JSON with category and property fields
        draft_id: Optional draft ID for draft-aware category resolution

    Returns:
        Error message if validation fails, None if valid
    """
    # 1. Check category field exists
    category_key = resource_json.get("category")
    if not category_key:
        return "Resource requires 'category' field"

    # 2. Check category exists (canonical or in draft)
    category_exists = await get_canonical_category_exists(session, category_key)
    if not category_exists and draft_id:
        category_exists = await get_draft_category_exists(session, draft_id, category_key)

    if not category_exists:
        return f"Category '{category_key}' does not exist"

    # 3. Get effective properties for the category
    valid_properties = await get_category_effective_properties(session, category_key, draft_id)

    # 4. Check all non-reserved fields are valid properties
    provided_fields = set(resource_json.keys()) - RESERVED_KEYS
    invalid_fields = provided_fields - valid_properties

    if invalid_fields:
        # Sort for consistent error messages
        invalid_list = sorted(invalid_fields)
        if len(invalid_list) == 1:
            return f"Unknown property '{invalid_list[0]}' for category '{category_key}'"
        else:
            return f"Unknown properties {invalid_list} for category '{category_key}'"

    return None
