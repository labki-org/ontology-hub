"""Reference existence validation for v2 drafts.

Checks that referenced entities exist in either canonical or effective entity sets.
"""

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.v2 import Bundle, Category, Module, Property, Subobject, Template
from app.schemas.validation_v2 import ValidationResultV2


async def check_references_v2(
    effective_entities: dict[str, dict[str, dict]],
    session: AsyncSession,
) -> list[ValidationResultV2]:
    """Check all referenced entity_keys exist in canonical or effective data.

    Validates:
    - Category parents exist (in canonical OR effective)
    - Category properties exist
    - Module entity_keys exist
    - Bundle module_keys exist

    Args:
        effective_entities: Dict like {"category": {"Person": {...}, ...}, "property": {...}, ...}
        session: Async database session for canonical data lookup

    Returns:
        List of ValidationResultV2 for missing references
    """
    results: list[ValidationResultV2] = []

    # Build sets of canonical entity_keys
    canonical_categories = set()
    canonical_properties = set()
    canonical_subobjects = set()
    canonical_modules = set()
    canonical_bundles = set()
    canonical_templates = set()

    # Query canonical entity_keys
    category_query = select(Category.entity_key)
    category_result = await session.execute(category_query)
    canonical_categories = {row[0] for row in category_result.all()}

    property_query = select(Property.entity_key)
    property_result = await session.execute(property_query)
    canonical_properties = {row[0] for row in property_result.all()}

    subobject_query = select(Subobject.entity_key)
    subobject_result = await session.execute(subobject_query)
    canonical_subobjects = {row[0] for row in subobject_result.all()}

    module_query = select(Module.entity_key)
    module_result = await session.execute(module_query)
    canonical_modules = {row[0] for row in module_result.all()}

    bundle_query = select(Bundle.entity_key)
    bundle_result = await session.execute(bundle_query)
    canonical_bundles = {row[0] for row in bundle_result.all()}

    template_query = select(Template.entity_key)
    template_result = await session.execute(template_query)
    canonical_templates = {row[0] for row in template_result.all()}

    # Build sets of effective entity_keys (includes draft changes)
    effective_categories = set(effective_entities.get("category", {}).keys())
    effective_properties = set(effective_entities.get("property", {}).keys())
    effective_subobjects = set(effective_entities.get("subobject", {}).keys())
    effective_modules = set(effective_entities.get("module", {}).keys())
    effective_bundles = set(effective_entities.get("bundle", {}).keys())
    effective_templates = set(effective_entities.get("template", {}).keys())

    # Combined sets (canonical + effective)
    all_categories = canonical_categories | effective_categories
    all_properties = canonical_properties | effective_properties
    all_subobjects = canonical_subobjects | effective_subobjects
    all_modules = canonical_modules | effective_modules
    all_bundles = canonical_bundles | effective_bundles
    all_templates = canonical_templates | effective_templates

    # Check category references
    for entity_key, category_json in effective_entities.get("category", {}).items():
        # Skip deleted entities (they should be flagged as deleted, not validated)
        if category_json.get("_deleted"):
            continue

        # Check parents (note: v2 uses "parents" array, not single "parent")
        parents = category_json.get("parents", [])
        if parents:
            for i, parent_key in enumerate(parents):
                if parent_key not in all_categories:
                    results.append(
                        ValidationResultV2(
                            entity_type="category",
                            entity_key=entity_key,
                            field_path=f"/parents/{i}",
                            code="MISSING_PARENT",
                            message=f"Parent category '{parent_key}' does not exist",
                            severity="error",
                        )
                    )

        # Check property references
        properties = category_json.get("properties", [])
        if properties:
            for i, prop_ref in enumerate(properties):
                # Property refs can be string or dict with {"property": "key", "is_required": true}
                prop_key = prop_ref if isinstance(prop_ref, str) else prop_ref.get("property")
                if prop_key and prop_key not in all_properties:
                    results.append(
                        ValidationResultV2(
                            entity_type="category",
                            entity_key=entity_key,
                            field_path=f"/properties/{i}",
                            code="MISSING_PROPERTY",
                            message=f"Property '{prop_key}' does not exist",
                            severity="error",
                        )
                    )

    # Check module references
    for entity_key, module_json in effective_entities.get("module", {}).items():
        if module_json.get("_deleted"):
            continue

        # Modules reference entities of various types via "entities" array
        # Format: [{"type": "category", "entity_key": "Person"}, ...]
        entities = module_json.get("entities", [])
        for i, entity_ref in enumerate(entities):
            entity_type = entity_ref.get("type")
            ref_key = entity_ref.get("entity_key")

            if not ref_key:
                continue

            # Check entity exists based on type
            entity_exists = False
            if entity_type == "category" and ref_key in all_categories:
                entity_exists = True
            elif entity_type == "property" and ref_key in all_properties:
                entity_exists = True
            elif entity_type == "subobject" and ref_key in all_subobjects:
                entity_exists = True
            elif entity_type == "template" and ref_key in all_templates:
                entity_exists = True

            if not entity_exists:
                results.append(
                    ValidationResultV2(
                        entity_type="module",
                        entity_key=entity_key,
                        field_path=f"/entities/{i}",
                        code="MISSING_ENTITY",
                        message=f"{entity_type.capitalize()} '{ref_key}' does not exist",
                        severity="error",
                    )
                )

    # Check bundle references
    for entity_key, bundle_json in effective_entities.get("bundle", {}).items():
        if bundle_json.get("_deleted"):
            continue

        # Bundles reference modules via "modules" array
        modules = bundle_json.get("modules", [])
        if modules:
            for i, module_key in enumerate(modules):
                if module_key not in all_modules:
                    results.append(
                        ValidationResultV2(
                            entity_type="bundle",
                            entity_key=entity_key,
                            field_path=f"/modules/{i}",
                            code="MISSING_MODULE",
                            message=f"Module '{module_key}' does not exist",
                            severity="error",
                        )
                    )

    return results
