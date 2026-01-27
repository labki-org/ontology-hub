"""Breaking change detection for v2 drafts.

Detects changes that may break backward compatibility by comparing
effective entities against canonical data.
"""

from typing import Any, Literal, cast

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.v2 import Bundle, Category, DraftChange, Module, Property, Subobject, Template
from app.schemas.validation import ValidationResultV2

EntityType = Literal["category", "property", "subobject", "module", "bundle", "template"]


async def detect_breaking_changes_v2(
    effective_entities: dict[str, dict[str, dict]],
    _draft_changes: list[DraftChange],
    session: AsyncSession,
) -> list[ValidationResultV2]:
    """Detect breaking changes by comparing effective entities to canonical.

    Breaking changes (MAJOR):
    - Property datatype changed
    - Property cardinality changed from multiple to single
    - Entity deleted that is referenced by other entities
    - Category property removed

    Non-breaking (MINOR):
    - New entity added
    - Property cardinality relaxed (single to multiple)
    - Category property added

    Metadata changes (PATCH):
    - Label changed
    - Description changed

    Args:
        effective_entities: Effective entity state from draft changes
        draft_changes: List of DraftChange records for this draft
        session: Database session for canonical data lookup

    Returns:
        List of ValidationResultV2 with breaking change warnings
    """
    results: list[ValidationResultV2] = []

    # Build map of canonical entities
    canonical_categories = await _fetch_canonical_categories(session)
    canonical_properties = await _fetch_canonical_properties(session)
    canonical_subobjects = await _fetch_canonical_subobjects(session)
    canonical_modules = await _fetch_canonical_modules(session)
    canonical_bundles = await _fetch_canonical_bundles(session)
    canonical_templates = await _fetch_canonical_templates(session)

    # Check property breaking changes
    for entity_key, prop_json in effective_entities.get("property", {}).items():
        if prop_json.get("_deleted"):
            # Deleted property - check if referenced elsewhere
            # This is handled by reference validation
            continue

        if entity_key in canonical_properties:
            # Existing property - check for breaking changes
            canonical_prop = canonical_properties[entity_key]
            results.extend(_check_property_breaking_changes(entity_key, canonical_prop, prop_json))
            results.extend(
                _check_metadata_changes("property", entity_key, canonical_prop, prop_json)
            )
        else:
            # New property added (minor change)
            if not prop_json.get("_deleted"):
                results.append(
                    ValidationResultV2(
                        entity_type="property",
                        entity_key=entity_key,
                        field_path=None,
                        code="ENTITY_ADDED",
                        message=f"New property '{entity_key}' added",
                        severity="info",
                        suggested_semver="minor",
                    )
                )

    # Check category breaking changes
    for entity_key, cat_json in effective_entities.get("category", {}).items():
        if cat_json.get("_deleted"):
            continue

        if entity_key in canonical_categories:
            # Existing category - check for breaking changes
            canonical_cat = canonical_categories[entity_key]
            results.extend(_check_category_breaking_changes(entity_key, canonical_cat, cat_json))
            results.extend(_check_metadata_changes("category", entity_key, canonical_cat, cat_json))
        else:
            # New category added (minor change)
            if not cat_json.get("_deleted"):
                results.append(
                    ValidationResultV2(
                        entity_type="category",
                        entity_key=entity_key,
                        field_path=None,
                        code="ENTITY_ADDED",
                        message=f"New category '{entity_key}' added",
                        severity="info",
                        suggested_semver="minor",
                    )
                )

    # Check subobject changes
    for entity_key, sub_json in effective_entities.get("subobject", {}).items():
        if sub_json.get("_deleted"):
            continue

        # Subobjects are simpler - just check metadata changes
        # (No schema-level breaking changes like properties)
        if entity_key in canonical_subobjects:
            canonical_sub = canonical_subobjects[entity_key]
            results.extend(
                _check_metadata_changes("subobject", entity_key, canonical_sub, sub_json)
            )
        else:
            # New subobject added
            results.append(
                ValidationResultV2(
                    entity_type="subobject",
                    entity_key=entity_key,
                    field_path=None,
                    code="ENTITY_ADDED",
                    message=f"New subobject '{entity_key}' added",
                    severity="info",
                    suggested_semver="minor",
                )
            )

    # Check module breaking changes
    for entity_key, mod_json in effective_entities.get("module", {}).items():
        if mod_json.get("_deleted"):
            continue

        if entity_key in canonical_modules:
            # Existing module - check for breaking changes
            canonical_mod = canonical_modules[entity_key]
            results.extend(_check_module_breaking_changes(entity_key, canonical_mod, mod_json))
            results.extend(_check_metadata_changes("module", entity_key, canonical_mod, mod_json))
        else:
            # New module added (minor change)
            results.append(
                ValidationResultV2(
                    entity_type="module",
                    entity_key=entity_key,
                    field_path=None,
                    code="ENTITY_ADDED",
                    message=f"New module '{entity_key}' added",
                    severity="info",
                    suggested_semver="minor",
                )
            )

    # Check bundle breaking changes
    for entity_key, bundle_json in effective_entities.get("bundle", {}).items():
        if bundle_json.get("_deleted"):
            continue

        if entity_key in canonical_bundles:
            # Existing bundle - check for breaking changes
            canonical_bundle = canonical_bundles[entity_key]
            results.extend(
                _check_bundle_breaking_changes(entity_key, canonical_bundle, bundle_json)
            )
            results.extend(
                _check_metadata_changes("bundle", entity_key, canonical_bundle, bundle_json)
            )
        else:
            # New bundle added (minor change)
            results.append(
                ValidationResultV2(
                    entity_type="bundle",
                    entity_key=entity_key,
                    field_path=None,
                    code="ENTITY_ADDED",
                    message=f"New bundle '{entity_key}' added",
                    severity="info",
                    suggested_semver="minor",
                )
            )

    # Check template breaking changes
    for entity_key, tmpl_json in effective_entities.get("template", {}).items():
        if tmpl_json.get("_deleted"):
            continue

        if entity_key in canonical_templates:
            # Existing template - check for breaking changes
            canonical_tmpl = canonical_templates[entity_key]
            results.extend(_check_template_breaking_changes(entity_key, canonical_tmpl, tmpl_json))
            results.extend(
                _check_metadata_changes("template", entity_key, canonical_tmpl, tmpl_json)
            )
        else:
            # New template added (minor change)
            results.append(
                ValidationResultV2(
                    entity_type="template",
                    entity_key=entity_key,
                    field_path=None,
                    code="ENTITY_ADDED",
                    message=f"New template '{entity_key}' added",
                    severity="info",
                    suggested_semver="minor",
                )
            )

    return results


async def _fetch_canonical_categories(session: AsyncSession) -> dict[str, dict]:
    """Fetch all canonical categories as dict keyed by entity_key."""
    query = select(Category)
    result = await session.execute(query)
    categories = result.scalars().all()

    return {cat.entity_key: cat.canonical_json for cat in categories}


async def _fetch_canonical_properties(session: AsyncSession) -> dict[str, dict]:
    """Fetch all canonical properties as dict keyed by entity_key."""
    query = select(Property)
    result = await session.execute(query)
    properties = result.scalars().all()

    return {prop.entity_key: prop.canonical_json for prop in properties}


async def _fetch_canonical_modules(session: AsyncSession) -> dict[str, dict]:
    """Fetch all canonical modules as dict keyed by entity_key."""
    query = select(Module)
    result = await session.execute(query)
    modules = result.scalars().all()

    return {mod.entity_key: mod.canonical_json for mod in modules}


async def _fetch_canonical_subobjects(session: AsyncSession) -> dict[str, dict]:
    """Fetch all canonical subobjects as dict keyed by entity_key."""
    query = select(Subobject)
    result = await session.execute(query)
    subobjects = result.scalars().all()

    return {sub.entity_key: sub.canonical_json for sub in subobjects}


async def _fetch_canonical_bundles(session: AsyncSession) -> dict[str, dict]:
    """Fetch all canonical bundles as dict keyed by entity_key."""
    query = select(Bundle)
    result = await session.execute(query)
    bundles = result.scalars().all()

    return {bundle.entity_key: bundle.canonical_json for bundle in bundles}


async def _fetch_canonical_templates(session: AsyncSession) -> dict[str, dict]:
    """Fetch all canonical templates as dict keyed by entity_key."""
    query = select(Template)
    result = await session.execute(query)
    templates = result.scalars().all()

    return {tmpl.entity_key: tmpl.canonical_json for tmpl in templates}


def _check_property_breaking_changes(
    entity_key: str,
    canonical: dict[str, Any],
    effective: dict[str, Any],
) -> list[ValidationResultV2]:
    """Check a single property for breaking changes."""
    results: list[ValidationResultV2] = []

    # Datatype change detection
    old_datatype = canonical.get("datatype")
    new_datatype = effective.get("datatype")

    if old_datatype and new_datatype and old_datatype != new_datatype:
        results.append(
            ValidationResultV2(
                entity_type="property",
                entity_key=entity_key,
                field_path="/datatype",
                code="DATATYPE_CHANGED",
                message=f"Datatype changed from '{old_datatype}' to '{new_datatype}' - this is a breaking change",
                severity="warning",
                suggested_semver="major",
                old_value=old_datatype,
                new_value=new_datatype,
            )
        )

    # Cardinality change detection
    old_cardinality = canonical.get("cardinality")
    new_cardinality = effective.get("cardinality")

    if old_cardinality == "multiple" and new_cardinality == "single":
        results.append(
            ValidationResultV2(
                entity_type="property",
                entity_key=entity_key,
                field_path="/cardinality",
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
            ValidationResultV2(
                entity_type="property",
                entity_key=entity_key,
                field_path="/cardinality",
                code="CARDINALITY_RELAXED",
                message="Cardinality changed from 'single' to 'multiple' - backward compatible",
                severity="info",
                suggested_semver="minor",
                old_value="single",
                new_value="multiple",
            )
        )

    return results


def _check_category_breaking_changes(
    entity_key: str,
    canonical: dict[str, Any],
    effective: dict[str, Any],
) -> list[ValidationResultV2]:
    """Check category for breaking changes (property removals/additions)."""
    results: list[ValidationResultV2] = []

    # Get property keys from canonical and effective
    # Properties can be strings or dicts with {"property": "key", ...}
    def extract_property_keys(props_list: list) -> set[str]:
        keys = set()
        for item in props_list:
            if isinstance(item, str):
                keys.add(item)
            elif isinstance(item, dict) and "property" in item:
                keys.add(item["property"])
        return keys

    old_props = extract_property_keys(canonical.get("properties", []))
    new_props = extract_property_keys(effective.get("properties", []))

    # Check for removed properties (breaking)
    removed_props = old_props - new_props
    for removed_prop in removed_props:
        results.append(
            ValidationResultV2(
                entity_type="category",
                entity_key=entity_key,
                field_path="/properties",
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
            ValidationResultV2(
                entity_type="category",
                entity_key=entity_key,
                field_path="/properties",
                code="PROPERTY_ADDED",
                message=f"Property '{added_prop}' added to category",
                severity="info",
                suggested_semver="minor",
                new_value=added_prop,
            )
        )

    return results


def _check_metadata_changes(
    entity_type: EntityType,
    entity_key: str,
    canonical: dict[str, Any],
    effective: dict[str, Any],
) -> list[ValidationResultV2]:
    """Check for metadata-only changes (label, description)."""
    results: list[ValidationResultV2] = []

    # Label change
    old_label = canonical.get("label")
    new_label = effective.get("label")
    if old_label and new_label and old_label != new_label:
        results.append(
            ValidationResultV2(
                entity_type=entity_type,
                entity_key=entity_key,
                field_path="/label",
                code="LABEL_CHANGED",
                message=f"Label changed from '{old_label}' to '{new_label}'",
                severity="info",
                suggested_semver="patch",
                old_value=old_label,
                new_value=new_label,
            )
        )

    # Description change
    old_desc = canonical.get("description") or ""
    new_desc = effective.get("description") or ""
    if old_desc != new_desc:
        # Truncate for display
        old_display = old_desc[:50] + "..." if len(old_desc) > 50 else old_desc
        new_display = new_desc[:50] + "..." if len(new_desc) > 50 else new_desc

        results.append(
            ValidationResultV2(
                entity_type=entity_type,
                entity_key=entity_key,
                field_path="/description",
                code="DESCRIPTION_CHANGED",
                message="Description changed",
                severity="info",
                suggested_semver="patch",
                old_value=old_display,
                new_value=new_display,
            )
        )

    return results


def _check_module_breaking_changes(
    entity_key: str,
    canonical: dict[str, Any],
    effective: dict[str, Any],
) -> list[ValidationResultV2]:
    """Check module for breaking changes (category/dependency removals).

    Only validates manual fields (categories, dependencies).
    Derived fields (properties, subobjects, templates) are auto-computed
    from categories and shouldn't generate separate warnings.
    """
    results: list[ValidationResultV2] = []

    # Check for removed categories (breaking)
    old_categories = set(canonical.get("categories", []))
    new_categories = set(effective.get("categories", []))

    removed_categories = old_categories - new_categories
    for removed_cat in removed_categories:
        results.append(
            ValidationResultV2(
                entity_type="module",
                entity_key=entity_key,
                field_path="/categories",
                code="CATEGORY_REMOVED",
                message=f"Category '{removed_cat}' removed from module - this is a breaking change",
                severity="warning",
                suggested_semver="major",
                old_value=removed_cat,
            )
        )

    # Check for added categories (minor)
    added_categories = new_categories - old_categories
    for added_cat in added_categories:
        results.append(
            ValidationResultV2(
                entity_type="module",
                entity_key=entity_key,
                field_path="/categories",
                code="CATEGORY_ADDED",
                message=f"Category '{added_cat}' added to module",
                severity="info",
                suggested_semver="minor",
                new_value=added_cat,
            )
        )

    # Check for removed dependencies (breaking)
    old_deps = set(canonical.get("dependencies", []))
    new_deps = set(effective.get("dependencies", []))

    removed_deps = old_deps - new_deps
    for removed_dep in removed_deps:
        results.append(
            ValidationResultV2(
                entity_type="module",
                entity_key=entity_key,
                field_path="/dependencies",
                code="DEPENDENCY_REMOVED",
                message=f"Dependency '{removed_dep}' removed from module - this is a breaking change",
                severity="warning",
                suggested_semver="major",
                old_value=removed_dep,
            )
        )

    # Check for added dependencies (minor)
    added_deps = new_deps - old_deps
    for added_dep in added_deps:
        results.append(
            ValidationResultV2(
                entity_type="module",
                entity_key=entity_key,
                field_path="/dependencies",
                code="DEPENDENCY_ADDED",
                message=f"Dependency '{added_dep}' added to module",
                severity="info",
                suggested_semver="minor",
                new_value=added_dep,
            )
        )

    return results


def _check_bundle_breaking_changes(
    entity_key: str,
    canonical: dict[str, Any],
    effective: dict[str, Any],
) -> list[ValidationResultV2]:
    """Check bundle for breaking changes (module removals)."""
    results: list[ValidationResultV2] = []

    # Check for removed modules (breaking)
    old_modules = set(canonical.get("modules", []))
    new_modules = set(effective.get("modules", []))

    removed_modules = old_modules - new_modules
    for removed_mod in removed_modules:
        results.append(
            ValidationResultV2(
                entity_type="bundle",
                entity_key=entity_key,
                field_path="/modules",
                code="MODULE_REMOVED",
                message=f"Module '{removed_mod}' removed from bundle - this is a breaking change",
                severity="warning",
                suggested_semver="major",
                old_value=removed_mod,
            )
        )

    # Check for added modules (minor)
    added_modules = new_modules - old_modules
    for added_mod in added_modules:
        results.append(
            ValidationResultV2(
                entity_type="bundle",
                entity_key=entity_key,
                field_path="/modules",
                code="MODULE_ADDED",
                message=f"Module '{added_mod}' added to bundle",
                severity="info",
                suggested_semver="minor",
                new_value=added_mod,
            )
        )

    return results


def _check_template_breaking_changes(
    entity_key: str,
    canonical: dict[str, Any],
    effective: dict[str, Any],
) -> list[ValidationResultV2]:
    """Check template for breaking changes (wikitext modifications)."""
    results: list[ValidationResultV2] = []

    old_wikitext = canonical.get("wikitext") or ""
    new_wikitext = effective.get("wikitext") or ""

    if old_wikitext != new_wikitext:
        # Wikitext change is potentially breaking - flag as warning
        # Truncate for display
        old_display = old_wikitext[:50] + "..." if len(old_wikitext) > 50 else old_wikitext
        new_display = new_wikitext[:50] + "..." if len(new_wikitext) > 50 else new_wikitext

        results.append(
            ValidationResultV2(
                entity_type="template",
                entity_key=entity_key,
                field_path="/wikitext",
                code="WIKITEXT_CHANGED",
                message="Template wikitext changed - review for potential breaking changes",
                severity="warning",
                suggested_semver="major",
                old_value=old_display,
                new_value=new_display,
            )
        )

    return results
