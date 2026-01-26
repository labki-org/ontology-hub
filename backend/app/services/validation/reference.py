"""Reference existence validation for draft payloads."""

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.draft import DraftPayload
from app.models.entity import Entity, EntityType
from app.models.module import Module
from app.schemas.validation import ValidationResult


async def get_canonical_entity_ids(session: AsyncSession, entity_type: EntityType) -> set[str]:
    """Get all entity IDs of given type from canonical database.

    Args:
        session: Database session
        entity_type: Type of entities to fetch

    Returns:
        Set of entity_id strings
    """
    stmt = select(Entity.entity_id).where(
        Entity.entity_type == entity_type, Entity.deleted_at.is_(None)
    )
    result = await session.execute(stmt)
    return {row[0] for row in result.all()}


async def get_canonical_module_ids(session: AsyncSession) -> set[str]:
    """Get all module IDs from canonical database.

    Args:
        session: Database session

    Returns:
        Set of module_id strings
    """
    stmt = select(Module.module_id).where(Module.deleted_at.is_(None))
    result = await session.execute(stmt)
    return {row[0] for row in result.all()}


async def check_references(
    payload: DraftPayload,
    session: AsyncSession,
) -> list[ValidationResult]:
    """Check all referenced IDs exist in canonical or draft data.

    Validates:
    - Category parent references
    - Category property references
    - Category subobject references
    - Module category_ids
    - Module dependencies
    - Profile module_ids

    Args:
        payload: Draft payload with entities, modules, profiles
        session: Database session for canonical data lookup

    Returns:
        List of ValidationResult for missing references
    """
    results: list[ValidationResult] = []

    # Build sets of canonical IDs
    canonical_categories = await get_canonical_entity_ids(session, EntityType.CATEGORY)
    canonical_properties = await get_canonical_entity_ids(session, EntityType.PROPERTY)
    canonical_subobjects = await get_canonical_entity_ids(session, EntityType.SUBOBJECT)
    canonical_modules = await get_canonical_module_ids(session)

    # Build sets of draft IDs
    draft_categories = {c.entity_id for c in payload.entities.categories}
    draft_properties = {p.entity_id for p in payload.entities.properties}
    draft_subobjects = {s.entity_id for s in payload.entities.subobjects}
    draft_modules = {m.module_id for m in payload.modules}

    # Combined sets (canonical + draft)
    all_categories = canonical_categories | draft_categories
    all_properties = canonical_properties | draft_properties
    all_subobjects = canonical_subobjects | draft_subobjects
    all_modules = canonical_modules | draft_modules

    # Check category references
    for category in payload.entities.categories:
        schema = category.schema_definition

        # Parent reference
        parent = schema.get("parent")
        if parent and parent not in all_categories:
            results.append(
                ValidationResult(
                    entity_type="category",
                    entity_id=category.entity_id,
                    field="parent",
                    code="MISSING_PARENT",
                    message=f"Parent category '{parent}' does not exist",
                    severity="error",
                )
            )

        # Property references
        for prop_id in schema.get("properties", []):
            if prop_id not in all_properties:
                results.append(
                    ValidationResult(
                        entity_type="category",
                        entity_id=category.entity_id,
                        field="properties",
                        code="MISSING_PROPERTY",
                        message=f"Property '{prop_id}' does not exist",
                        severity="error",
                    )
                )

        # Subobject references
        for sub_id in schema.get("subobjects", []):
            if sub_id not in all_subobjects:
                results.append(
                    ValidationResult(
                        entity_type="category",
                        entity_id=category.entity_id,
                        field="subobjects",
                        code="MISSING_SUBOBJECT",
                        message=f"Subobject '{sub_id}' does not exist",
                        severity="error",
                    )
                )

    # Check module references
    for module in payload.modules:
        for cat_id in module.category_ids:
            if cat_id not in all_categories:
                results.append(
                    ValidationResult(
                        entity_type="module",
                        entity_id=module.module_id,
                        field="category_ids",
                        code="MISSING_CATEGORY",
                        message=f"Category '{cat_id}' does not exist",
                        severity="error",
                    )
                )

        for dep_id in module.dependencies:
            if dep_id not in all_modules:
                results.append(
                    ValidationResult(
                        entity_type="module",
                        entity_id=module.module_id,
                        field="dependencies",
                        code="MISSING_MODULE",
                        message=f"Module dependency '{dep_id}' does not exist",
                        severity="error",
                    )
                )

    # Check profile references
    for profile in payload.profiles:
        for mod_id in profile.module_ids:
            if mod_id not in all_modules:
                results.append(
                    ValidationResult(
                        entity_type="profile",
                        entity_id=profile.profile_id,
                        field="module_ids",
                        code="MISSING_MODULE",
                        message=f"Module '{mod_id}' does not exist",
                        severity="error",
                    )
                )

    return results
