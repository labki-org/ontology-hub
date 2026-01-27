"""Main validation orchestrator for v2 drafts.

Validates drafts by reconstructing effective entities from DraftChange records
and running all validation checks.
"""

from copy import deepcopy
from typing import Literal
from uuid import UUID

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.v2 import (
    Bundle,
    Category,
    ChangeType,
    DraftChange,
    Module,
    Property,
    Subobject,
    Template,
)
from app.schemas.validation import DraftValidationReportV2, ValidationResultV2
from app.services.validation.breaking import detect_breaking_changes_v2
from app.services.validation.datatype import ALLOWED_DATATYPES
from app.services.validation.inheritance import check_circular_inheritance_v2
from app.services.validation.reference import check_references_v2
from app.services.validation.schema_v2 import check_schema_v2
from app.services.validation.semver import compute_semver_suggestion

SemverLevel = Literal["major", "minor", "patch"]


async def validate_draft_v2(
    draft_id: UUID,
    session: AsyncSession,
) -> DraftValidationReportV2:
    """Validate v2 draft by reconstructing effective entities from DraftChanges.

    Performs:
    1. Build effective entity state from draft changes
    2. Reference existence checks (errors)
    3. Circular inheritance detection (errors)
    4. Datatype validation (errors)
    5. JSON Schema validation (errors)
    6. Breaking change detection (warnings/info)
    7. Semver classification

    Args:
        draft_id: UUID of draft to validate
        session: Async database session

    Returns:
        DraftValidationReportV2 with all findings and semver suggestion
    """
    # 1. Load draft changes and build effective entities
    draft_changes_query = select(DraftChange).where(DraftChange.draft_id == draft_id)
    result = await session.execute(draft_changes_query)
    draft_changes = list(result.scalars().all())

    effective_entities = await build_effective_entities(draft_changes, session)

    # 2-6. Run all validation checks
    results: list[ValidationResultV2] = []

    # 2. Reference existence checks (errors)
    results.extend(await check_references_v2(effective_entities, session))

    # 3. Circular inheritance detection (errors)
    results.extend(check_circular_inheritance_v2(effective_entities))

    # 4. Datatype validation (errors)
    results.extend(check_datatypes_v2(effective_entities))

    # 5. JSON Schema validation (errors)
    results.extend(await check_schema_v2(effective_entities, session))

    # 6. Breaking change detection (warnings/info)
    results.extend(await detect_breaking_changes_v2(effective_entities, draft_changes, session))

    # Separate by severity
    errors = [r for r in results if r.severity == "error"]
    warnings = [r for r in results if r.severity == "warning"]
    info = [r for r in results if r.severity == "info"]

    # 7. Compute semver suggestion
    suggested_semver: SemverLevel
    if errors:
        # Don't suggest semver until errors are resolved
        suggested_semver = "patch"
        semver_reasons = ["Resolve validation errors before semver classification"]
    else:
        # Filter to results with semver suggestions
        semver_results = [r for r in results if r.suggested_semver]
        suggested_semver, semver_reasons = compute_semver_suggestion(semver_results)

    # Compute per-module and per-bundle version suggestions
    # (For now, just use the overall suggestion - can be refined later)
    module_suggestions = {}
    bundle_suggestions = {}

    # Identify modules and bundles affected by changes
    affected_modules = set()
    affected_bundles = set()

    for change in draft_changes:
        if change.entity_type == "module":
            affected_modules.add(change.entity_key)
        elif change.entity_type == "bundle":
            affected_bundles.add(change.entity_key)

    # Assign suggested semver to affected modules/bundles
    for module_key in affected_modules:
        module_suggestions[module_key] = suggested_semver

    for bundle_key in affected_bundles:
        bundle_suggestions[bundle_key] = suggested_semver

    return DraftValidationReportV2(
        is_valid=len(errors) == 0,
        errors=errors,
        warnings=warnings,
        info=info,
        suggested_semver=suggested_semver,
        semver_reasons=semver_reasons,
        module_suggestions=module_suggestions,
        bundle_suggestions=bundle_suggestions,
    )


async def build_effective_entities(
    draft_changes: list[DraftChange],
    session: AsyncSession,
) -> dict[str, dict[str, dict]]:
    """Build effective entity state from draft changes overlaid on canonical.

    This reconstructs what the ontology would look like if the draft were applied,
    by loading canonical entities and applying CREATE/UPDATE/DELETE changes.

    Args:
        draft_changes: List of DraftChange records for a draft
        session: Database session for canonical data lookup

    Returns:
        Dict like {"category": {"Person": {...}, ...}, "property": {...}, ...}
        where each entity dict includes canonical_json content
    """
    # Initialize effective entities dict
    effective: dict[str, dict[str, dict]] = {
        "category": {},
        "property": {},
        "subobject": {},
        "module": {},
        "bundle": {},
        "template": {},
    }

    # Load all canonical entities
    canonical = await _load_canonical_entities(session)

    # Start with canonical entities (deep copy to avoid mutation)
    for entity_type, entities in canonical.items():
        for entity_key, entity_json in entities.items():
            effective[entity_type][entity_key] = deepcopy(entity_json)

    # Apply draft changes
    import jsonpatch

    for change in draft_changes:
        entity_type = change.entity_type
        entity_key = change.entity_key

        if change.change_type == ChangeType.CREATE:
            # Add new entity from replacement_json
            if change.replacement_json:
                effective[entity_type][entity_key] = deepcopy(change.replacement_json)
                effective[entity_type][entity_key]["_change_status"] = "added"

        elif change.change_type == ChangeType.UPDATE:
            # Apply JSON Patch to existing entity
            if entity_key in effective[entity_type]:
                base = effective[entity_type][entity_key]
                try:
                    if change.patch:
                        patch = jsonpatch.JsonPatch(change.patch)
                        patched = patch.apply(deepcopy(base))
                        effective[entity_type][entity_key] = patched
                        effective[entity_type][entity_key]["_change_status"] = "modified"
                except jsonpatch.JsonPatchException:
                    # Patch failed - keep canonical with error marker
                    effective[entity_type][entity_key]["_patch_error"] = True

        elif change.change_type == ChangeType.DELETE:
            # Mark entity as deleted
            if entity_key in effective[entity_type]:
                effective[entity_type][entity_key]["_deleted"] = True
                effective[entity_type][entity_key]["_change_status"] = "deleted"

    return effective


async def _load_canonical_entities(
    session: AsyncSession,
) -> dict[str, dict[str, dict]]:
    """Load all canonical entities from database.

    Returns:
        Dict like {"category": {"Person": {...canonical_json...}, ...}, ...}
    """
    canonical: dict[str, dict[str, dict]] = {
        "category": {},
        "property": {},
        "subobject": {},
        "module": {},
        "bundle": {},
        "template": {},
    }

    # Load categories
    category_query = select(Category)
    category_result = await session.execute(category_query)
    for cat in category_result.scalars().all():
        canonical["category"][cat.entity_key] = deepcopy(cat.canonical_json)

    # Load properties
    property_query = select(Property)
    property_result = await session.execute(property_query)
    for prop in property_result.scalars().all():
        canonical["property"][prop.entity_key] = deepcopy(prop.canonical_json)

    # Load subobjects
    subobject_query = select(Subobject)
    subobject_result = await session.execute(subobject_query)
    for sub in subobject_result.scalars().all():
        canonical["subobject"][sub.entity_key] = deepcopy(sub.canonical_json)

    # Load modules
    module_query = select(Module)
    module_result = await session.execute(module_query)
    for mod in module_result.scalars().all():
        canonical["module"][mod.entity_key] = deepcopy(mod.canonical_json)

    # Load bundles
    bundle_query = select(Bundle)
    bundle_result = await session.execute(bundle_query)
    for bundle in bundle_result.scalars().all():
        canonical["bundle"][bundle.entity_key] = deepcopy(bundle.canonical_json)

    # Load templates
    template_query = select(Template)
    template_result = await session.execute(template_query)
    for template in template_result.scalars().all():
        canonical["template"][template.entity_key] = deepcopy(template.canonical_json)

    return canonical


def check_datatypes_v2(effective_entities: dict[str, dict[str, dict]]) -> list[ValidationResultV2]:
    """Check property datatypes are in the allowed set.

    Reuses ALLOWED_DATATYPES from v1 validation.

    Args:
        effective_entities: Effective entity state

    Returns:
        List of ValidationResultV2 for invalid datatypes
    """
    results: list[ValidationResultV2] = []

    for entity_key, prop_json in effective_entities.get("property", {}).items():
        # Skip deleted entities
        if prop_json.get("_deleted"):
            continue

        datatype = prop_json.get("datatype")

        if datatype and datatype not in ALLOWED_DATATYPES:
            results.append(
                ValidationResultV2(
                    entity_type="property",
                    entity_key=entity_key,
                    field_path="/datatype",
                    code="INVALID_DATATYPE",
                    message=f"Datatype '{datatype}' is not valid. Allowed: {', '.join(sorted(ALLOWED_DATATYPES))}",
                    severity="error",
                )
            )

    return results
