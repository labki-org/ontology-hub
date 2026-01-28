# Phase 25: Backend Ingest Pipeline - Research

**Researched:** 2026-01-28
**Domain:** Python/FastAPI backend extension (entity parsing and database ingest)
**Confidence:** HIGH

## Summary

This phase extends the existing v2.0 ingest pipeline to handle Dashboard and Resource entities. The codebase already has a well-established pattern for entity parsing (`EntityParser`), relationship extraction (`PendingRelationship`), and database insertion (`IngestService`). Dashboard and Resource models were created in Phase 24, including junction tables (`ModuleDashboard`, `BundleDashboard`).

The primary work is extending existing code rather than creating new infrastructure:
1. Add `parse_dashboard()` and `parse_resource()` methods to `EntityParser`
2. Update `ParsedEntities` dataclass to include dashboard and resource lists
3. Extend `ENTITY_DIRECTORIES` to include `dashboards` and `resources`
4. Handle nested resource file paths (like templates)
5. Resolve and insert `module_dashboard` and `bundle_dashboard` relationships

**Primary recommendation:** Follow the exact patterns established for templates (nested paths) and modules (dashboard relationship extraction). The existing infrastructure handles all the complexity.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| SQLModel | 0.0.24+ | ORM models (Dashboard, Resource) | Already in use, Phase 24 models exist |
| jsonschema | 4.x | Validate dashboard/resource JSON | Existing SchemaValidator |
| httpx | 0.27.x | GitHub API (fetch files) | Existing GitHubClient |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Alembic | 1.15.x | Database migrations | Already run in Phase 24 |

### Alternatives Considered

None - this phase purely extends existing code with established patterns.

## Architecture Patterns

### Existing EntityParser Structure

```
backend/app/services/parsers/
├── __init__.py           # Re-exports EntityParser, ParsedEntities, PendingRelationship
└── entity_parser.py      # EntityParser class with parse_* methods
```

### Pattern 1: Parse Method Structure

**What:** Each entity type has a `parse_{entity}()` method returning model + optional relationships
**When to use:** Always for new entity types

**Example (existing template pattern):**
```python
def parse_template(self, content: dict, source_path: str) -> Template:
    """Parse template JSON into model instance.

    Template entity_key may include "/" for nested templates
    (e.g., "Property/Page" from templates/Property/Page.json)
    """
    entity_key = content["id"]

    return Template(
        entity_key=entity_key,
        source_path=source_path,
        label=content.get("label", entity_key),
        description=content.get("description"),
        wikitext=content.get("wikitext"),
        canonical_json=content,
    )
```

**Dashboard implementation will be similar:**
```python
def parse_dashboard(self, content: dict, source_path: str) -> Dashboard:
    """Parse dashboard JSON into model instance."""
    entity_key = content["id"]

    return Dashboard(
        entity_key=entity_key,
        source_path=source_path,
        label=content.get("label", entity_key),
        description=content.get("description"),
        canonical_json=content,  # Contains 'pages' array
    )
```

### Pattern 2: Relationship Extraction (Module Pattern)

**What:** Extract relationships from module/bundle JSON into `PendingRelationship` objects
**When to use:** When entities reference other entities (modules reference dashboards)

**Example (existing module->categories pattern):**
```python
def parse_module(self, content: dict, source_path: str) -> tuple[Module, list[PendingRelationship]]:
    # ... create module ...

    relationships: list[PendingRelationship] = []

    # Extract category memberships
    for cat_key in content.get("categories", []):
        relationships.append(
            PendingRelationship(
                type="module_entity",
                source_key=entity_key,
                target_key=cat_key,
                extra={"entity_type": EntityType.CATEGORY},
            )
        )

    return module, relationships
```

**Dashboard relationship extraction (to add):**
```python
# In parse_module():
for dash_key in content.get("dashboards", []):
    relationships.append(
        PendingRelationship(
            type="module_dashboard",
            source_key=entity_key,
            target_key=dash_key,
        )
    )

# In parse_bundle():
for dash_key in content.get("dashboards", []):
    relationships.append(
        PendingRelationship(
            type="bundle_dashboard",
            source_key=entity_key,
            target_key=dash_key,
        )
    )
```

### Pattern 3: Nested Path Handling (Template Pattern)

**What:** Resources use nested paths like templates: `resources/{Category}/{key}.json`
**When to use:** Resource file loading

**Existing template handling in `load_entity_files()`:**
```python
# Only process files directly in entity directories (e.g., "bundles/Default.json")
# Skip nested files like "bundles/Default/versions/1.0.0.json"
# Exception: templates allow nested paths (e.g., templates/Property/Page.json)
if len(parts) != 2 and directory != "templates":
    continue
```

**Resource handling update:**
```python
# Resources also allow nested paths: resources/{Category}/{key}.json
if len(parts) != 2 and directory not in ("templates", "resources"):
    continue
```

### Pattern 4: Relationship Resolution (IngestService Pattern)

**What:** After entity insertion, resolve entity_keys to UUIDs and create junction rows
**When to use:** Dashboard relationship tables

**Existing bundle_module resolution:**
```python
elif rel.type == "bundle_module":
    bundle_id = bundles.get(rel.source_key)
    module_id = modules.get(rel.target_key)
    if bundle_id and module_id:
        self._session.add(
            BundleModule(
                bundle_id=bundle_id,
                module_id=module_id,
            )
        )
```

**Dashboard resolution (to add):**
```python
elif rel.type == "module_dashboard":
    module_id = modules.get(rel.source_key)
    dashboard_id = dashboards.get(rel.target_key)
    if module_id and dashboard_id:
        self._session.add(
            ModuleDashboard(
                module_id=module_id,
                dashboard_id=dashboard_id,
            )
        )
    else:
        self._warnings.append(
            f"Unresolved module_dashboard: {rel.source_key} -> {rel.target_key}"
        )
```

### Anti-Patterns to Avoid

- **Creating new infrastructure:** Don't create new services or patterns; extend existing ones
- **Custom validation:** Use existing `SchemaValidator` with dashboard/resource `_schema.json` files
- **Eager relationship loading:** Relationships are resolved post-insert, not during parsing

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON Schema validation | Custom validation logic | `SchemaValidator` (existing) | Handles Draft 2020-12, error formatting |
| GitHub file fetching | HTTP calls | `GitHubClient` (existing) | Rate limiting, retries, base64 decode |
| UUID resolution | Manual lookup | `resolve_and_insert_relationships()` pattern | Handles warnings, consistent error format |
| Nested path parsing | Custom path logic | Existing template pattern in `load_entity_files()` | Already handles templates the same way |

**Key insight:** Phase 24 created the database models. Phase 25 only needs to extend the parser and ingest service with the same patterns used for templates and modules.

## Common Pitfalls

### Pitfall 1: Missing ENTITY_DIRECTORIES Update

**What goes wrong:** Dashboard/resource files not loaded from GitHub
**Why it happens:** `ENTITY_DIRECTORIES` in both `github.py` and `ingest.py` only lists original entity types
**How to avoid:** Update both `ENTITY_DIRECTORIES` constants to include `"dashboards"` and `"resources"` with schema paths
**Warning signs:** Zero dashboards/resources in parsed results despite files in repo

### Pitfall 2: Resource Entity Key Mismatch

**What goes wrong:** Resource entity_key doesn't match database constraints or lookup fails
**Why it happens:** Resources use hierarchical keys like `Person/John_doe` (category prefix)
**How to avoid:** Entity key derived from JSON `id` field, which includes category: `"id": "Person/John_doe"`
**Warning signs:** Duplicate key errors or unresolved resource lookups

### Pitfall 3: Missing Dashboard Lookup Table

**What goes wrong:** `KeyError` when resolving `module_dashboard` relationships
**Why it happens:** Forgot to build `dashboards` lookup dict in `resolve_and_insert_relationships()`
**How to avoid:** Add dashboard lookup table like existing entity types
**Warning signs:** "Unresolved module_dashboard" warnings for all relationships

### Pitfall 4: ParsedEntities Not Updated

**What goes wrong:** `ParsedEntities` doesn't include dashboards/resources
**Why it happens:** Forgot to add fields to dataclass and `entity_counts()` method
**How to avoid:** Update `ParsedEntities` with `dashboards: list[Dashboard]` and `resources: list[Resource]`
**Warning signs:** Type errors, missing counts in `OntologyVersion.entity_counts`

### Pitfall 5: Stale Model Imports

**What goes wrong:** Import errors for Dashboard, Resource, ModuleDashboard, BundleDashboard
**Why it happens:** v2 `__init__.py` already exports these, but entity_parser.py doesn't import them
**How to avoid:** Add imports at top of entity_parser.py
**Warning signs:** `NameError: name 'Dashboard' is not defined`

## Code Examples

### Complete parse_dashboard Implementation

```python
def parse_dashboard(self, content: dict, source_path: str) -> Dashboard:
    """Parse dashboard JSON into model instance.

    Args:
        content: Parsed JSON content from dashboard file
        source_path: Original file path, e.g., "dashboards/Core_overview.json"

    Returns:
        Dashboard instance (no relationships extracted - module declares dashboard)
    """
    entity_key = content["id"]

    return Dashboard(
        entity_key=entity_key,
        source_path=source_path,
        label=content.get("label", entity_key),
        description=content.get("description"),
        canonical_json=content,  # Contains 'pages' array with wikitext
    )
```

### Complete parse_resource Implementation

```python
def parse_resource(self, content: dict, source_path: str) -> Resource:
    """Parse resource JSON into model instance.

    Args:
        content: Parsed JSON content from resource file
        source_path: Original file path, e.g., "resources/Person/John_doe.json"

    Returns:
        Resource instance (category_key extracted from content)

    Note:
        Resource entity_key includes category prefix for uniqueness
        (e.g., "Person/John_doe" from resources/Person/John_doe.json)
    """
    entity_key = content["id"]  # Already includes category: "Person/John_doe"

    return Resource(
        entity_key=entity_key,
        source_path=source_path,
        label=content.get("label", entity_key),
        description=content.get("description"),
        category_key=content.get("category"),  # "Person"
        canonical_json=content,  # Includes additional properties
    )
```

### Updated parse_module with Dashboard Relationships

```python
def parse_module(self, content: dict, source_path: str) -> tuple[Module, list[PendingRelationship]]:
    # ... existing module creation ...

    # Extract dashboard memberships (NEW)
    for dash_key in content.get("dashboards", []):
        relationships.append(
            PendingRelationship(
                type="module_dashboard",
                source_key=entity_key,
                target_key=dash_key,
            )
        )

    return module, relationships
```

### IngestService Dashboard Lookup and Resolution

```python
# In resolve_and_insert_relationships():

# Add to lookup table building:
dashboards = {
    d.entity_key: d.id
    for d in (await self._session.execute(select(Dashboard))).scalars().all()
}

# Add resolution case:
elif rel.type == "module_dashboard":
    module_id = modules.get(rel.source_key)
    dashboard_id = dashboards.get(rel.target_key)
    if module_id and dashboard_id:
        self._session.add(
            ModuleDashboard(
                module_id=module_id,
                dashboard_id=dashboard_id,
            )
        )
    else:
        self._warnings.append(
            f"Unresolved module_dashboard: {rel.source_key} -> {rel.target_key}"
        )

elif rel.type == "bundle_dashboard":
    bundle_id = bundles.get(rel.source_key)
    dashboard_id = dashboards.get(rel.target_key)
    if bundle_id and dashboard_id:
        self._session.add(
            BundleDashboard(
                bundle_id=bundle_id,
                dashboard_id=dashboard_id,
            )
        )
    else:
        self._warnings.append(
            f"Unresolved bundle_dashboard: {rel.source_key} -> {rel.target_key}"
        )
```

### ENTITY_DIRECTORIES Update

```python
# In github.py:
ENTITY_DIRECTORIES = frozenset({
    "categories", "properties", "subobjects",
    "modules", "bundles", "templates",
    "dashboards", "resources",  # NEW
})

# In ingest.py:
ENTITY_DIRECTORIES = {
    "categories": "categories/_schema.json",
    "properties": "properties/_schema.json",
    "subobjects": "subobjects/_schema.json",
    "modules": "modules/_schema.json",
    "bundles": "bundles/_schema.json",
    "templates": "templates/_schema.json",
    "dashboards": "dashboards/_schema.json",  # NEW
    "resources": "resources/_schema.json",     # NEW
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| N/A | Extend existing EntityParser | This phase | Minimal changes, follow patterns |

**Deprecated/outdated:** None - this is new functionality.

## Open Questions

1. **Resource Module Membership**
   - What we know: Modules can have a `resources` array in their JSON (per schema)
   - What's unclear: Should resources create `module_entity` relationships like categories?
   - Recommendation: YES - follow category pattern. Resources should be tracked as module members.

2. **Dashboard Validation Pre-Insert**
   - What we know: Context mentions "Parser validates that referenced dashboard keys exist"
   - What's unclear: Should validation happen during parsing or during relationship resolution?
   - Recommendation: Let relationship resolution handle it (existing pattern). Missing dashboards become warnings, not blocking errors.

## Sources

### Primary (HIGH confidence)

- `/home/daharoni/dev/ontology-hub/backend/app/services/parsers/entity_parser.py` - Existing parse methods
- `/home/daharoni/dev/ontology-hub/backend/app/services/ingest.py` - IngestService patterns
- `/home/daharoni/dev/ontology-hub/backend/app/models/v2/dashboard.py` - Dashboard model
- `/home/daharoni/dev/ontology-hub/backend/app/models/v2/resource.py` - Resource model
- `/home/daharoni/dev/ontology-hub/backend/app/models/v2/relationships.py` - Junction tables

### Secondary (MEDIUM confidence)

- `/home/daharoni/dev/labki-ontology/dashboards/_schema.json` - Dashboard JSON schema
- `/home/daharoni/dev/labki-ontology/resources/_schema.json` - Resource JSON schema
- `/home/daharoni/dev/labki-ontology/modules/_schema.json` - Module schema with dashboards array

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new libraries, extending existing code
- Architecture: HIGH - Patterns fully documented in existing codebase
- Pitfalls: HIGH - Based on code review, not speculation

**Research date:** 2026-01-28
**Valid until:** Indefinite (internal patterns, not external dependencies)
