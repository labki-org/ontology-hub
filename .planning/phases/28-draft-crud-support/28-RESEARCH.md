# Phase 28: Draft CRUD Support - Research

**Researched:** 2026-01-28
**Domain:** FastAPI CRUD endpoints with JSON Patch, Pydantic validation
**Confidence:** HIGH

## Summary

Phase 28 extends the existing draft change API to support dashboards and resources. The current `draft_changes.py` router already handles CRUD for categories, properties, subobjects, modules, bundles, and templates. This phase adds:

1. Dashboard entity type support (CREATE/UPDATE/DELETE)
2. Resource entity type support (CREATE/UPDATE/DELETE)
3. Resource field validation against category properties

The existing patterns in `draft_changes.py` are well-established and directly applicable. Dashboard CRUD follows the standard entity pattern. Resource CRUD requires additional validation logic to check property fields against the category's effective property set.

**Primary recommendation:** Extend `VALID_ENTITY_TYPES` and `ENTITY_MODEL_MAP` to include "dashboard" and "resource", then add a resource field validation service that runs during CREATE/UPDATE.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI | existing | API framework | Already in codebase |
| Pydantic | v2 | Request/response validation | Already in codebase |
| jsonpatch | existing | RFC 6902 JSON Patch | Already in codebase |
| SQLModel | existing | Async ORM | Already in codebase |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| jsonschema | existing | Schema validation | Validating against _schema.json |

**Note:** All required libraries already exist in the codebase. No new dependencies needed.

## Architecture Patterns

### Existing Draft Change Flow
```
1. POST /drafts/{token}/changes
   ├── validate_v2_capability_token()
   ├── check draft.status in (DRAFT, VALIDATED)
   ├── auto_revert_if_validated() if needed
   ├── entity_exists() check
   ├── create/merge DraftChange record
   └── auto_populate_module_derived() for modules
```

### Pattern 1: Entity Type Registration
**What:** Add entity types to validation constants
**When to use:** Adding new entity types to draft changes
**Location:** `backend/app/schemas/draft_change.py` and `backend/app/routers/draft_changes.py`

```python
# backend/app/schemas/draft_change.py
VALID_ENTITY_TYPES = frozenset(
    {"category", "property", "subobject", "module", "bundle", "template", "dashboard", "resource"}
)

# backend/app/routers/draft_changes.py
ENTITY_MODEL_MAP = {
    "category": Category,
    "property": Property,
    "subobject": Subobject,
    "module": Module,
    "bundle": Bundle,
    "template": Template,
    "dashboard": Dashboard,  # NEW
    "resource": Resource,    # NEW
}
```

### Pattern 2: Resource Field Validation
**What:** Validate resource property fields against category's effective properties
**When to use:** During resource CREATE and UPDATE
**Architecture:**

```python
async def validate_resource_fields(
    session: AsyncSession,
    resource_json: dict,
    draft_id: uuid.UUID | None = None,
) -> list[ValidationError]:
    """Validate resource property fields against category's effective properties.

    Args:
        session: Database session
        resource_json: Resource JSON with category and property fields
        draft_id: Optional draft ID for draft-aware category resolution

    Returns:
        List of validation errors (empty if valid)
    """
    errors = []
    category_key = resource_json.get("category")

    if not category_key:
        errors.append(ValidationError("category", "Required field 'category' missing"))
        return errors

    # Get category's effective properties (direct + inherited)
    effective_props = await get_category_effective_properties(session, category_key, draft_id)

    # Validate that provided fields are valid properties
    reserved_keys = {"id", "label", "description", "category", "entity_key", "source_path"}
    provided_fields = set(resource_json.keys()) - reserved_keys

    for field in provided_fields:
        if field not in effective_props:
            errors.append(ValidationError(field, f"Unknown property '{field}' for category '{category_key}'"))

    # Check required properties (optional: can be lenient for drafts)
    required_props = {p for p in effective_props if effective_props[p].is_required}
    missing_required = required_props - provided_fields
    for prop in missing_required:
        errors.append(ValidationError(prop, f"Required property '{prop}' is missing"))

    return errors
```

### Pattern 3: Dashboard Page Validation
**What:** Validate dashboard has at least one page per CONTEXT.md decision
**When to use:** During dashboard CREATE
**Example:**

```python
def validate_dashboard_create(replacement_json: dict) -> list[ValidationError]:
    """Validate dashboard creation JSON.

    Decision: Dashboard requires at least one page - cannot create empty dashboard.
    """
    errors = []

    pages = replacement_json.get("pages", [])
    if not pages:
        errors.append(ValidationError("pages", "Dashboard must have at least one page"))
        return errors

    # Validate root page exists (name: "")
    has_root = any(p.get("name") == "" for p in pages)
    if not has_root:
        errors.append(ValidationError("pages", "Dashboard must have a root page (name: '')"))

    return errors
```

### Anti-Patterns to Avoid
- **Don't validate fields on UPDATE:** UPDATE uses JSON Patch; validation happens after patch application
- **Don't use "replace" op for potentially missing fields:** Use "add" op per CLAUDE.md guidance
- **Don't create separate endpoints:** Extend existing `/drafts/{token}/changes` with new entity types

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Category property lookup | Custom query each time | `category_property_effective` materialized view | Already computed with inheritance |
| JSON Patch validation | Manual patch validation | `jsonpatch.JsonPatch()` library | RFC 6902 compliance |
| Entity existence checks | Direct SQL | `entity_exists()` helper | Already exists in draft_changes.py |
| Draft-aware resolution | Custom overlay logic | `DraftOverlayService` | Handles CREATE/UPDATE/DELETE |

**Key insight:** The existing `category_property_effective` materialized view computes inherited properties. For draft-aware validation, also check draft changes for category modifications.

## Common Pitfalls

### Pitfall 1: Resource Key as "id" Field
**What goes wrong:** Using wrong field for entity_key
**Why it happens:** Resources use "id" in JSON but "entity_key" in database
**How to avoid:** Per CONTEXT.md: "Resource key is the `id` field, consistent with all other entities"
**Warning signs:** entity_key/id mismatch in tests

### Pitfall 2: Category Property Inheritance in Drafts
**What goes wrong:** Validating resource against canonical category when draft modifies category
**Why it happens:** Draft may add/remove properties from category
**How to avoid:** Use draft-aware category property resolution
**Warning signs:** Valid draft fails validation because canonical category lacks property

### Pitfall 3: JSON Patch "replace" vs "add"
**What goes wrong:** Patch fails with JsonPatchConflict
**Why it happens:** "replace" op fails if field doesn't exist
**How to avoid:** Use "add" op for fields that may not exist (per CLAUDE.md)
**Warning signs:** Patch errors on UPDATE operations

### Pitfall 4: Dashboard Root Page Requirement
**What goes wrong:** Dashboard created without usable entry point
**Why it happens:** No validation on pages array structure
**How to avoid:** Validate root page (name: "") exists per schema
**Warning signs:** Dashboard with no displayable content

## Code Examples

### Adding Entity Types to VALID_ENTITY_TYPES
```python
# backend/app/schemas/draft_change.py
VALID_ENTITY_TYPES = frozenset(
    {"category", "property", "subobject", "module", "bundle", "template", "dashboard", "resource"}
)
```

### Adding Entity Models to ENTITY_MODEL_MAP
```python
# backend/app/routers/draft_changes.py
from app.models.v2 import Dashboard, Resource

ENTITY_MODEL_MAP = {
    "category": Category,
    "property": Property,
    "subobject": Subobject,
    "module": Module,
    "bundle": Bundle,
    "template": Template,
    "dashboard": Dashboard,
    "resource": Resource,
}
```

### Resource Field Validation Integration
```python
# In add_draft_change() after existing validation
if change_in.entity_type == "resource":
    if change_in.change_type == ChangeType.CREATE:
        # Validate fields against category properties
        validation_errors = await validate_resource_fields(
            session,
            change_in.replacement_json or {},
            draft_id=draft.id
        )
        if validation_errors:
            raise HTTPException(
                status_code=400,
                detail=f"Resource validation failed: {validation_errors[0].message}"
            )
```

### Dashboard Create Validation
```python
# In add_draft_change() after existing validation
if change_in.entity_type == "dashboard" and change_in.change_type == ChangeType.CREATE:
    validation_errors = validate_dashboard_create(change_in.replacement_json or {})
    if validation_errors:
        raise HTTPException(
            status_code=400,
            detail=f"Dashboard validation failed: {validation_errors[0].message}"
        )
```

### Getting Category Effective Properties (Draft-Aware)
```python
async def get_category_effective_properties(
    session: AsyncSession,
    category_key: str,
    draft_id: uuid.UUID | None = None,
) -> dict[str, PropertyInfo]:
    """Get effective properties for a category, including draft changes.

    Returns:
        Dict mapping property_key to PropertyInfo (is_required, datatype, etc.)
    """
    properties: dict[str, PropertyInfo] = {}

    # 1. Check for draft-created category first
    if draft_id:
        draft_change = await get_draft_change(session, draft_id, "category", category_key)
        if draft_change and draft_change.change_type == ChangeType.CREATE:
            # Use replacement_json for draft-created category
            effective = draft_change.replacement_json or {}
            for prop_key in effective.get("required_properties", []):
                properties[prop_key] = PropertyInfo(is_required=True)
            for prop_key in effective.get("optional_properties", []):
                properties[prop_key] = PropertyInfo(is_required=False)
            return properties

    # 2. Query canonical via materialized view
    query = text("""
        SELECT p.entity_key, cpe.is_required
        FROM category_property_effective cpe
        JOIN properties p ON p.id = cpe.property_id
        JOIN categories c ON c.id = cpe.category_id
        WHERE c.entity_key = :category_key
    """)
    result = await session.execute(query, {"category_key": category_key})

    for row in result.fetchall():
        properties[row[0]] = PropertyInfo(is_required=row[1])

    # 3. Apply draft modifications to category if any
    if draft_id:
        draft_change = await get_draft_change(session, draft_id, "category", category_key)
        if draft_change and draft_change.change_type == ChangeType.UPDATE:
            # Apply patches to property lists
            # (More complex - may need to recompute from patched category)
            pass

    return properties
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| VALID_ENTITY_TYPES without dashboard/resource | Add "dashboard", "resource" to set | Phase 28 | Enables CRUD for new entity types |

**Deprecated/outdated:**
- None - this phase extends existing patterns

## Open Questions

1. **Resource UPDATE validation scope**
   - What we know: CREATE validates all fields against category
   - What's unclear: Should UPDATE re-validate entire effective resource?
   - Recommendation: Validate after patch application (compute effective, then validate)

2. **Required property enforcement strictness**
   - What we know: Schema defines required_properties on categories
   - What's unclear: Should draft block creation of resources missing required props?
   - Recommendation: Per CONTEXT.md "reject invalid" - fail fast on CREATE

3. **Draft-modified category handling**
   - What we know: Category properties can change in same draft
   - What's unclear: Order of operations if category and resource in same draft
   - Recommendation: Validate resource against draft-effective category state

## Sources

### Primary (HIGH confidence)
- `/home/daharoni/dev/ontology-hub/backend/app/routers/draft_changes.py` - existing CRUD patterns
- `/home/daharoni/dev/ontology-hub/backend/app/schemas/draft_change.py` - validation schemas
- `/home/daharoni/dev/ontology-hub/backend/app/services/draft_overlay.py` - overlay service
- `/home/daharoni/dev/ontology-hub/backend/app/models/v2/category_property_effective.py` - inheritance view
- `/home/daharoni/dev/ontology-hub/CLAUDE.md` - JSON Patch gotchas
- `/home/daharoni/dev/labki-ontology/resources/_schema.json` - resource JSON schema
- `/home/daharoni/dev/labki-ontology/dashboards/_schema.json` - dashboard JSON schema

### Secondary (MEDIUM confidence)
- `/home/daharoni/dev/ontology-hub/.planning/phases/28-draft-crud-support/28-CONTEXT.md` - phase decisions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in codebase
- Architecture: HIGH - extending existing proven patterns
- Pitfalls: HIGH - documented in CLAUDE.md and codebase

**Research date:** 2026-01-28
**Valid until:** 30 days (stable domain, codebase patterns established)
