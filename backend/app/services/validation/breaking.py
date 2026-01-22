"""Breaking change detection for draft payloads.

Detects changes that may break backward compatibility:
- MAJOR: Datatype changes, cardinality restrictions, entity removals
- MINOR: New entities, cardinality relaxations, new optional fields
- PATCH: Label/description changes only
"""

from typing import Any

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.draft import DraftPayload
from app.models.entity import Entity
from app.models.module import Module, Profile
from app.schemas.validation import ValidationResult


async def fetch_canonical_entities_map(
    session: AsyncSession,
) -> dict[str, dict[str, dict[str, Any]]]:
    """Fetch all canonical entities organized by type.

    Returns:
        Dict with keys: categories, properties, subobjects, modules, profiles
        Each value is a dict mapping entity_id to entity data
    """
    result_map: dict[str, dict[str, dict[str, Any]]] = {
        "categories": {},
        "properties": {},
        "subobjects": {},
        "modules": {},
        "profiles": {},
    }

    # Map singular entity types to plural keys
    type_to_plural = {
        "category": "categories",
        "property": "properties",
        "subobject": "subobjects",
    }

    # Fetch entities
    stmt = select(Entity).where(Entity.deleted_at.is_(None))
    result = await session.execute(stmt)
    for entity in result.scalars().all():
        type_key = type_to_plural.get(entity.entity_type.value)
        if type_key:
            result_map[type_key][entity.entity_id] = {
                "entity_id": entity.entity_id,
                "label": entity.label,
                "description": entity.description,
                "schema_definition": entity.schema_definition,
            }

    # Fetch modules
    stmt_modules = select(Module).where(Module.deleted_at.is_(None))
    result_modules = await session.execute(stmt_modules)
    for module in result_modules.scalars().all():
        result_map["modules"][module.module_id] = {
            "module_id": module.module_id,
            "label": module.label,
            "description": module.description,
            "category_ids": module.category_ids,
            "dependencies": module.dependencies,
        }

    # Fetch profiles
    stmt_profiles = select(Profile).where(Profile.deleted_at.is_(None))
    result_profiles = await session.execute(stmt_profiles)
    for profile in result_profiles.scalars().all():
        result_map["profiles"][profile.profile_id] = {
            "profile_id": profile.profile_id,
            "label": profile.label,
            "description": profile.description,
            "module_ids": profile.module_ids,
        }

    return result_map


def _check_property_breaking_changes(
    entity_id: str,
    old_schema: dict[str, Any],
    new_schema: dict[str, Any],
) -> list[ValidationResult]:
    """Check a single property for breaking changes."""
    results: list[ValidationResult] = []

    # Datatype change detection
    old_datatype = old_schema.get("datatype")
    new_datatype = new_schema.get("datatype")

    if old_datatype and new_datatype and old_datatype != new_datatype:
        results.append(
            ValidationResult(
                entity_type="property",
                entity_id=entity_id,
                field="datatype",
                code="DATATYPE_CHANGED",
                message=f"Datatype changed from '{old_datatype}' to '{new_datatype}' - this is a breaking change",
                severity="warning",
                suggested_semver="major",
                old_value=old_datatype,
                new_value=new_datatype,
            )
        )

    # Cardinality change detection
    old_cardinality = old_schema.get("cardinality")
    new_cardinality = new_schema.get("cardinality")

    if old_cardinality == "multiple" and new_cardinality == "single":
        results.append(
            ValidationResult(
                entity_type="property",
                entity_id=entity_id,
                field="cardinality",
                code="CARDINALITY_RESTRICTED",
                message="Cardinality changed from 'multiple' to 'single' - this is a breaking change",
                severity="warning",
                suggested_semver="major",
                old_value="multiple",
                new_value="single",
            )
        )
    elif old_cardinality == "single" and new_cardinality == "multiple":
        results.append(
            ValidationResult(
                entity_type="property",
                entity_id=entity_id,
                field="cardinality",
                code="CARDINALITY_RELAXED",
                message="Cardinality changed from 'single' to 'multiple' - backward compatible",
                severity="info",
                suggested_semver="minor",
                old_value="single",
                new_value="multiple",
            )
        )

    return results


def _check_entity_metadata_changes(
    entity_type: str,
    entity_id: str,
    old_data: dict[str, Any],
    new_data: dict[str, Any],
) -> list[ValidationResult]:
    """Check for metadata-only changes (label, description)."""
    results: list[ValidationResult] = []

    old_label = old_data.get("label")
    new_label = new_data.get("label")
    if old_label and new_label and old_label != new_label:
        results.append(
            ValidationResult(
                entity_type=entity_type,
                entity_id=entity_id,
                field="label",
                code="LABEL_CHANGED",
                message=f"Label changed from '{old_label}' to '{new_label}'",
                severity="info",
                suggested_semver="patch",
                old_value=old_label,
                new_value=new_label,
            )
        )

    old_desc = old_data.get("description") or ""
    new_desc = new_data.get("description") or ""
    if old_desc != new_desc:
        results.append(
            ValidationResult(
                entity_type=entity_type,
                entity_id=entity_id,
                field="description",
                code="DESCRIPTION_CHANGED",
                message="Description changed",
                severity="info",
                suggested_semver="patch",
                old_value=old_desc[:50] + "..." if len(old_desc) > 50 else old_desc,
                new_value=new_desc[:50] + "..." if len(new_desc) > 50 else new_desc,
            )
        )

    return results


async def detect_breaking_changes(
    payload: DraftPayload,
    session: AsyncSession,
) -> list[ValidationResult]:
    """Detect breaking changes vs canonical data.

    Breaking changes (MAJOR):
    - Datatype changed (e.g., Text -> Number)
    - Cardinality changed from multiple to single
    - Entity removed (only if explicitly in draft as deleted)

    Non-breaking additions (MINOR):
    - New entity added
    - Cardinality changed from single to multiple (relaxation)
    - New optional field added

    Metadata changes (PATCH):
    - Label changed
    - Description changed
    """
    results: list[ValidationResult] = []

    # Fetch canonical entities
    canonical = await fetch_canonical_entities_map(session)

    # Check properties for breaking changes
    for prop in payload.entities.properties:
        entity_id = prop.entity_id

        if entity_id in canonical["properties"]:
            old_data = canonical["properties"][entity_id]
            new_data = {
                "entity_id": prop.entity_id,
                "label": prop.label,
                "description": prop.description,
                "schema_definition": prop.schema_definition,
            }

            # Check schema_definition changes
            results.extend(
                _check_property_breaking_changes(
                    entity_id,
                    old_data.get("schema_definition", {}),
                    prop.schema_definition,
                )
            )

            # Check metadata changes
            results.extend(
                _check_entity_metadata_changes("property", entity_id, old_data, new_data)
            )
        else:
            # New property added
            results.append(
                ValidationResult(
                    entity_type="property",
                    entity_id=entity_id,
                    field=None,
                    code="ENTITY_ADDED",
                    message=f"New property '{entity_id}' added",
                    severity="info",
                    suggested_semver="minor",
                )
            )

    # Check categories for changes
    for category in payload.entities.categories:
        entity_id = category.entity_id

        if entity_id in canonical["categories"]:
            old_data = canonical["categories"][entity_id]
            new_data = {
                "entity_id": category.entity_id,
                "label": category.label,
                "description": category.description,
                "schema_definition": category.schema_definition,
            }

            # Check metadata changes
            results.extend(
                _check_entity_metadata_changes("category", entity_id, old_data, new_data)
            )

            # Check for removed properties (breaking)
            old_props = set(old_data.get("schema_definition", {}).get("properties", []))
            new_props = set(category.schema_definition.get("properties", []))
            removed_props = old_props - new_props
            for removed_prop in removed_props:
                results.append(
                    ValidationResult(
                        entity_type="category",
                        entity_id=entity_id,
                        field="properties",
                        code="PROPERTY_REMOVED",
                        message=f"Property '{removed_prop}' removed from category - this is a breaking change",
                        severity="warning",
                        suggested_semver="major",
                        old_value=removed_prop,
                    )
                )

            # Check for added properties (minor)
            added_props = new_props - old_props
            for added_prop in added_props:
                results.append(
                    ValidationResult(
                        entity_type="category",
                        entity_id=entity_id,
                        field="properties",
                        code="PROPERTY_ADDED",
                        message=f"Property '{added_prop}' added to category",
                        severity="info",
                        suggested_semver="minor",
                        new_value=added_prop,
                    )
                )
        else:
            # New category added
            results.append(
                ValidationResult(
                    entity_type="category",
                    entity_id=entity_id,
                    field=None,
                    code="ENTITY_ADDED",
                    message=f"New category '{entity_id}' added",
                    severity="info",
                    suggested_semver="minor",
                )
            )

    # Check subobjects for changes
    for subobject in payload.entities.subobjects:
        entity_id = subobject.entity_id

        if entity_id in canonical["subobjects"]:
            old_data = canonical["subobjects"][entity_id]
            new_data = {
                "entity_id": subobject.entity_id,
                "label": subobject.label,
                "description": subobject.description,
                "schema_definition": subobject.schema_definition,
            }

            results.extend(
                _check_entity_metadata_changes("subobject", entity_id, old_data, new_data)
            )
        else:
            # New subobject added
            results.append(
                ValidationResult(
                    entity_type="subobject",
                    entity_id=entity_id,
                    field=None,
                    code="ENTITY_ADDED",
                    message=f"New subobject '{entity_id}' added",
                    severity="info",
                    suggested_semver="minor",
                )
            )

    return results
