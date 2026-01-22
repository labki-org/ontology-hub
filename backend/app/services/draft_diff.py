"""Draft diff computation service.

Computes field-level diffs between draft payload and canonical database state.
"""

from typing import Any

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.draft import (
    ChangeDetail,
    ChangesByType,
    DraftDiffResponse,
    DraftPayload,
    EntityDefinition,
    ModuleDefinition,
    ProfileDefinition,
)
from app.models.entity import Entity, EntityType
from app.models.module import Module, Profile


def _build_entity_map(
    entities: list[EntityDefinition],
    entity_type: str,
) -> dict[str, dict[str, Any]]:
    """Build lookup map from entity list.

    Args:
        entities: List of EntityDefinition objects
        entity_type: Type string for the key prefix

    Returns:
        Dict mapping "type/entity_id" to schema_definition dict
    """
    return {
        f"{entity_type}/{e.entity_id}": {
            "entity_id": e.entity_id,
            "label": e.label,
            "description": e.description,
            "schema_definition": e.schema_definition,
        }
        for e in entities
    }


def _build_module_map(
    modules: list[ModuleDefinition],
) -> dict[str, dict[str, Any]]:
    """Build lookup map from module list.

    Args:
        modules: List of ModuleDefinition objects

    Returns:
        Dict mapping "modules/module_id" to module data
    """
    return {
        f"modules/{m.module_id}": {
            "module_id": m.module_id,
            "label": m.label,
            "description": m.description,
            "category_ids": m.category_ids,
            "dependencies": m.dependencies,
        }
        for m in modules
    }


def _build_profile_map(
    profiles: list[ProfileDefinition],
) -> dict[str, dict[str, Any]]:
    """Build lookup map from profile list.

    Args:
        profiles: List of ProfileDefinition objects

    Returns:
        Dict mapping "profiles/profile_id" to profile data
    """
    return {
        f"profiles/{p.profile_id}": {
            "profile_id": p.profile_id,
            "label": p.label,
            "description": p.description,
            "module_ids": p.module_ids,
        }
        for p in profiles
    }


def _compute_changes(
    canonical: dict[str, dict[str, Any]],
    draft: dict[str, dict[str, Any]],
    entity_type: str,
) -> ChangesByType:
    """Compute changes between canonical and draft entity maps.

    Args:
        canonical: Canonical entity lookup map
        draft: Draft entity lookup map
        entity_type: Type string for change details

    Returns:
        ChangesByType with added, modified, deleted lists
    """
    all_keys = set(canonical.keys()) | set(draft.keys())

    added: list[ChangeDetail] = []
    modified: list[ChangeDetail] = []
    deleted: list[ChangeDetail] = []

    for key in sorted(all_keys):
        parts = key.split("/", 1)
        entity_id = parts[1] if len(parts) > 1 else key

        canon_data = canonical.get(key)
        draft_data = draft.get(key)

        if canon_data is None and draft_data is not None:
            added.append(
                ChangeDetail(
                    key=key,
                    entity_type=entity_type,
                    entity_id=entity_id,
                    new=draft_data,
                )
            )
        elif canon_data is not None and draft_data is None:
            deleted.append(
                ChangeDetail(
                    key=key,
                    entity_type=entity_type,
                    entity_id=entity_id,
                    old=canon_data,
                )
            )
        elif canon_data != draft_data:
            modified.append(
                ChangeDetail(
                    key=key,
                    entity_type=entity_type,
                    entity_id=entity_id,
                    old=canon_data,
                    new=draft_data,
                )
            )

    return ChangesByType(added=added, modified=modified, deleted=deleted)


async def compute_draft_diff(
    payload: DraftPayload,
    session: AsyncSession,
) -> DraftDiffResponse:
    """Compute diff between draft payload and canonical database state.

    Compares the draft payload's entities, modules, and profiles against
    the current canonical data in the database.

    Args:
        payload: Validated draft payload with entities, modules, profiles
        session: Async database session

    Returns:
        DraftDiffResponse with changes grouped by entity type
    """
    # Fetch canonical entities from database
    stmt = select(Entity).where(Entity.deleted_at.is_(None))
    result = await session.execute(stmt)
    db_entities = result.scalars().all()

    # Build canonical maps by type
    canonical_categories: dict[str, dict[str, Any]] = {}
    canonical_properties: dict[str, dict[str, Any]] = {}
    canonical_subobjects: dict[str, dict[str, Any]] = {}

    for entity in db_entities:
        data = {
            "entity_id": entity.entity_id,
            "label": entity.label,
            "description": entity.description,
            "schema_definition": entity.schema_definition,
        }
        key = f"{entity.entity_type.value}/{entity.entity_id}"

        if entity.entity_type == EntityType.CATEGORY:
            canonical_categories[key] = data
        elif entity.entity_type == EntityType.PROPERTY:
            canonical_properties[key] = data
        elif entity.entity_type == EntityType.SUBOBJECT:
            canonical_subobjects[key] = data

    # Fetch canonical modules
    stmt_modules = select(Module).where(Module.deleted_at.is_(None))
    result_modules = await session.execute(stmt_modules)
    db_modules = result_modules.scalars().all()

    canonical_modules = {
        f"modules/{m.module_id}": {
            "module_id": m.module_id,
            "label": m.label,
            "description": m.description,
            "category_ids": m.category_ids,
            "dependencies": m.dependencies,
        }
        for m in db_modules
    }

    # Fetch canonical profiles
    stmt_profiles = select(Profile).where(Profile.deleted_at.is_(None))
    result_profiles = await session.execute(stmt_profiles)
    db_profiles = result_profiles.scalars().all()

    canonical_profiles = {
        f"profiles/{p.profile_id}": {
            "profile_id": p.profile_id,
            "label": p.label,
            "description": p.description,
            "module_ids": p.module_ids,
        }
        for p in db_profiles
    }

    # Build draft maps
    draft_categories = _build_entity_map(payload.entities.categories, "category")
    draft_properties = _build_entity_map(payload.entities.properties, "property")
    draft_subobjects = _build_entity_map(payload.entities.subobjects, "subobject")
    draft_modules = _build_module_map(payload.modules)
    draft_profiles = _build_profile_map(payload.profiles)

    # Compute changes for each type
    return DraftDiffResponse(
        old_version="canonical",
        new_version="draft",
        categories=_compute_changes(canonical_categories, draft_categories, "category"),
        properties=_compute_changes(canonical_properties, draft_properties, "property"),
        subobjects=_compute_changes(canonical_subobjects, draft_subobjects, "subobject"),
        modules=_compute_changes(canonical_modules, draft_modules, "module"),
        profiles=_compute_changes(canonical_profiles, draft_profiles, "profile"),
    )
