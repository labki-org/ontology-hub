# Phase 27: Module Auto-Derivation Extension - Research

**Researched:** 2026-01-28
**Domain:** Transitive dependency derivation with cycle detection
**Confidence:** HIGH

## Summary

This phase extends the existing module auto-derivation system (`module_derived.py`) to handle two new relationship paths: (1) categories referenced via `Allows_value_from_category` or `allowed_values.from_category` in properties, and (2) resources belonging to derived categories. The core challenge is implementing transitive derivation that follows chains until exhausted while handling potential cycles.

The codebase already has solid foundations: `compute_module_derived_entities()` in `module_derived.py` computes properties/subobjects/templates from categories, `check_circular_inheritance_v2()` in `inheritance.py` uses Python's `graphlib.TopologicalSorter` for cycle detection, and `compute_module_closure()` in `entities.py` demonstrates recursive CTE patterns for transitive graph traversal.

**Primary recommendation:** Extend `compute_module_derived_entities()` with a "visited" set pattern and iterative expansion loop that collects all transitively-derived entities in a single pass, using `graphlib.TopologicalSorter` for cycle detection when building the derivation graph.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| graphlib | stdlib (3.9+) | Cycle detection in derivation graphs | Already used in `inheritance.py`; `TopologicalSorter.prepare()` raises `CycleError` with cycle path |
| jsonpatch | existing | Apply draft patches to entities | Already used throughout; CLAUDE.md documents "add" op behavior |
| SQLModel | existing | Async database queries | Already used for entity queries |
| SQLAlchemy text() | existing | Raw SQL for recursive CTEs | Already used in `compute_module_closure()` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| copy.deepcopy | stdlib | Safe JSON mutation | When modifying canonical_json for effective state |
| typing | stdlib | Type hints for derivation structures | For provenance tracking dicts |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| graphlib.TopologicalSorter | networkx | networkx is overkill; graphlib is stdlib and already proven in codebase |
| Recursive CTE | Python recursion | CTEs are already used for closure; consistent pattern |
| Pure Python sets | SQLAlchemy queries | Python sets for visited tracking are faster for in-memory graphs |

**Installation:**
```bash
# No new dependencies - all stdlib or existing
```

## Architecture Patterns

### Recommended Project Structure
```
backend/app/services/
├── module_derived.py    # Extend existing - add transitive derivation
└── validation/
    └── inheritance.py   # Reference for cycle detection pattern
```

### Pattern 1: Iterative Expansion with Visited Set
**What:** Process entities in waves, tracking visited to prevent reprocessing
**When to use:** Transitive derivation that follows multiple relationship types
**Example:**
```python
# Source: Codebase pattern from inheritance.py + dependency resolution best practices
async def compute_module_derived_entities_transitive(
    session: AsyncSession,
    initial_category_keys: list[str],
    draft_id: uuid.UUID | None = None,
    max_depth: int = 10,
) -> dict[str, list[str]]:
    """Compute all derived entities with full transitive expansion.

    Derivation chain:
    1. Start with module's manual categories
    2. Collect properties, subobjects, templates from each category
    3. For each property, check Allows_value_from_category → add referenced category
    4. For each category (including newly added), collect resources
    5. Repeat until no new entities discovered or max_depth reached
    """
    visited_categories: set[str] = set()
    pending_categories: set[str] = set(initial_category_keys)

    all_properties: set[str] = set()
    all_subobjects: set[str] = set()
    all_templates: set[str] = set()
    all_resources: set[str] = set()
    provenance: dict[str, str] = {}  # entity_key -> derivation reason

    depth = 0
    while pending_categories and depth < max_depth:
        depth += 1
        current_batch = pending_categories - visited_categories
        if not current_batch:
            break

        visited_categories.update(current_batch)

        for cat_key in current_batch:
            # Get category's members (properties, subobjects)
            props, subs = await _get_category_members(session, cat_key, draft_changes)
            all_properties.update(props)
            all_subobjects.update(subs)

            # Get resources for this category
            resources = await _get_category_resources(session, cat_key, draft_changes)
            all_resources.update(resources)

        # Check properties for Allows_value_from_category references
        new_categories = await _extract_category_refs_from_properties(
            session, all_properties, draft_changes
        )
        pending_categories.update(new_categories - visited_categories)

    # Get templates from all collected properties
    all_templates = await _get_templates_from_properties(session, list(all_properties), draft_changes)

    return {
        "properties": sorted(all_properties),
        "subobjects": sorted(all_subobjects),
        "templates": sorted(all_templates),
        "resources": sorted(all_resources),
        "provenance": provenance,  # Optional: for debugging
    }
```

### Pattern 2: Category Reference Extraction from Properties
**What:** Extract category keys referenced by `Allows_value_from_category` or `allowed_values.from_category`
**When to use:** During property analysis phase of derivation
**Example:**
```python
# Source: Schema from labki-ontology/properties/_schema.json
async def _extract_category_refs_from_properties(
    session: AsyncSession,
    property_keys: set[str],
    draft_changes: dict[str, DraftChange],
) -> set[str]:
    """Extract categories referenced by properties via allowed_values."""
    category_refs: set[str] = set()

    for prop_key in property_keys:
        effective_json = await _get_effective_property_json(session, prop_key, draft_changes)
        if not effective_json:
            continue

        # Check both formats per schema:
        # 1. Top-level: "Allows_value_from_category": "SOP"
        if "Allows_value_from_category" in effective_json:
            category_refs.add(effective_json["Allows_value_from_category"])

        # 2. Nested: "allowed_values": {"from_category": "SOP"}
        allowed = effective_json.get("allowed_values")
        if isinstance(allowed, dict) and "from_category" in allowed:
            category_refs.add(allowed["from_category"])

    return category_refs
```

### Pattern 3: Resource Collection by Category
**What:** Query resources belonging to a category using `category_key` field
**When to use:** When deriving resources into module
**Example:**
```python
# Source: Codebase pattern from entities.py lines 1336-1342
async def _get_category_resources(
    session: AsyncSession,
    category_key: str,
    draft_changes: dict[str, DraftChange],
) -> set[str]:
    """Get all resources belonging to a category."""
    # Query canonical resources
    query = (
        select(Resource.entity_key)
        .where(Resource.category_key == category_key)
    )
    result = await session.execute(query)
    resources = {row[0] for row in result.fetchall()}

    # Include draft-created resources for this category
    for key, change in draft_changes.items():
        if key.startswith("resource:") and change.change_type == ChangeType.CREATE:
            replacement = change.replacement_json or {}
            if replacement.get("category") == category_key:
                resources.add(key.split(":", 1)[1])

    return resources
```

### Pattern 4: Cycle Detection with TopologicalSorter
**What:** Detect cycles in derivation graph before/during traversal
**When to use:** When building derivation graph to prevent infinite loops
**Example:**
```python
# Source: Codebase pattern from inheritance.py
from graphlib import CycleError, TopologicalSorter

def detect_derivation_cycles(
    category_property_refs: dict[str, set[str]],  # category -> properties it has
    property_category_refs: dict[str, str | None],  # property -> category it references
) -> list[str] | None:
    """Detect cycles in derivation graph.

    Returns cycle path if found, None otherwise.
    """
    # Build graph: category -> {categories it depends on via property refs}
    graph: dict[str, set[str]] = {}

    for cat_key, props in category_property_refs.items():
        deps = set()
        for prop_key in props:
            ref_cat = property_category_refs.get(prop_key)
            if ref_cat and ref_cat != cat_key:  # Avoid self-reference
                deps.add(ref_cat)
        graph[cat_key] = deps

    ts = TopologicalSorter(graph)
    try:
        ts.prepare()  # Raises CycleError if cycle exists
        return None
    except CycleError as e:
        return list(e.args[1]) if len(e.args) > 1 else []
```

### Anti-Patterns to Avoid
- **Unbounded recursion:** Always use `max_depth` parameter and `visited` set to prevent stack overflow
- **Using "replace" op for derived arrays:** Per CLAUDE.md, "replace" fails if field doesn't exist; always use "add" op
- **Querying each entity individually:** Batch queries where possible (e.g., `WHERE entity_key = ANY(:keys)`)
- **Storing derived entities in module JSON:** Derivation is computed on-demand per CONTEXT.md; don't persist to module

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cycle detection | Custom graph walk | `graphlib.TopologicalSorter` | Already proven in codebase; handles edge cases |
| JSON patching | Manual dict merging | `jsonpatch.JsonPatch` | RFC 6902 compliant; handles complex paths |
| Transitive parent traversal | Python recursion | SQL recursive CTE | Database does heavy lifting; handles large graphs |
| Draft entity resolution | Custom overlay logic | Existing `DraftOverlayService` patterns | Consistent with codebase; handles CREATE/UPDATE/DELETE |

**Key insight:** The codebase already has patterns for every major operation needed. Extend existing services rather than creating parallel implementations.

## Common Pitfalls

### Pitfall 1: Using "replace" for Derived Arrays
**What goes wrong:** `JsonPatchConflict` when patching modules that lack `/templates` or `/resources` fields
**Why it happens:** Canonical module JSON may not have all derived fields; "replace" op requires existing path
**How to avoid:** Always use `"op": "add"` for derived entity arrays (properties, subobjects, templates, resources)
**Warning signs:** Tests fail on new modules; `JsonPatchConflict` in logs

### Pitfall 2: Infinite Derivation Loops
**What goes wrong:** Stack overflow or infinite loop when Category A's property refs Category B, which refs Category A
**Why it happens:** Cycles in the property→category reference graph
**How to avoid:**
1. Track `visited_categories` set
2. Enforce `max_depth` parameter (CONTEXT.md suggests 10)
3. Pre-check with `TopologicalSorter` if warranted
**Warning signs:** Requests hang; memory grows without bound

### Pitfall 3: Missing Both Category Reference Formats
**What goes wrong:** Some categories not derived into module
**Why it happens:** Schema supports two formats: `Allows_value_from_category` AND `allowed_values.from_category`
**How to avoid:** Check both formats when extracting category refs from properties
**Warning signs:** Properties with `allowed_values: {"from_category": "X"}` don't trigger derivation

### Pitfall 4: Draft-Created Resources Not Included
**What goes wrong:** Draft-created resources missing from module's derived resources
**Why it happens:** Query only checks canonical `resources` table, not draft changes
**How to avoid:** Check `draft_changes` for CREATE operations with matching `category_key`
**Warning signs:** New resources in draft don't appear in module view

### Pitfall 5: Provenance Not Tracked
**What goes wrong:** Users can't understand why entity X is in module
**Why it happens:** Derivation computed but reasoning not recorded
**How to avoid:** Build provenance dict mapping `entity_key -> "reason"` during derivation
**Warning signs:** User confusion about module contents; debugging derivation is hard

## Code Examples

Verified patterns from official sources:

### Batch Category Query
```python
# Source: Codebase pattern from module_derived.py, entities.py
from sqlalchemy import text

async def get_properties_for_categories(
    session: AsyncSession,
    category_keys: list[str],
) -> dict[str, set[str]]:
    """Get all properties for multiple categories efficiently."""
    if not category_keys:
        return {}

    query = text("""
        SELECT c.entity_key as category_key, p.entity_key as property_key
        FROM category_property_effective cpe
        JOIN properties p ON p.id = cpe.property_id
        JOIN categories c ON c.id = cpe.category_id
        WHERE c.entity_key = ANY(:category_keys)
    """)
    result = await session.execute(query, {"category_keys": category_keys})

    cat_props: dict[str, set[str]] = {k: set() for k in category_keys}
    for row in result.fetchall():
        cat_props[row.category_key].add(row.property_key)
    return cat_props
```

### JSON Patch with "add" op for Derived Fields
```python
# Source: CLAUDE.md, draft_changes.py lines 188-197
def build_derived_patches(derived: dict[str, list[str]]) -> list[dict]:
    """Build patch operations for derived entity arrays.

    IMPORTANT: Use "add" not "replace" per CLAUDE.md.
    "add" creates if missing, replaces if exists.
    """
    patches = []
    for path, values in [
        ("/properties", derived["properties"]),
        ("/subobjects", derived["subobjects"]),
        ("/templates", derived["templates"]),
        ("/resources", derived.get("resources", [])),  # New in phase 27
    ]:
        patches.append({"op": "add", "path": path, "value": values})
    return patches
```

### Effective Property JSON Resolution
```python
# Source: Codebase pattern from module_derived.py
from copy import deepcopy
import jsonpatch

async def _get_effective_property_json(
    session: AsyncSession,
    property_key: str,
    draft_changes: dict[str, DraftChange],
) -> dict | None:
    """Get effective property JSON with draft overlay applied."""
    change_key = f"property:{property_key}"
    draft_change = draft_changes.get(change_key)

    if draft_change and draft_change.change_type == ChangeType.CREATE:
        return draft_change.replacement_json or {}

    # Query canonical property
    query = select(Property).where(Property.entity_key == property_key)
    result = await session.execute(query)
    prop = result.scalar_one_or_none()

    if not prop:
        return None

    if draft_change and draft_change.change_type == ChangeType.UPDATE:
        canonical_json = deepcopy(prop.canonical_json)
        try:
            patch = jsonpatch.JsonPatch(draft_change.patch or [])
            return patch.apply(canonical_json)
        except jsonpatch.JsonPatchException:
            return canonical_json

    return prop.canonical_json
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single-level derivation | Transitive derivation | Phase 27 | Full dependency chains followed |
| Properties/subobjects/templates only | + resources | Phase 27 | Resources included in module derivation |
| No category refs from properties | `Allows_value_from_category` | Phase 23 | Properties can reference categories for values |

**Deprecated/outdated:**
- Python 3.8 graphlib backport: Use stdlib graphlib (Python 3.9+)
- Manual cycle detection: Use `TopologicalSorter.prepare()` which raises `CycleError`

## Open Questions

Things that couldn't be fully resolved:

1. **Provenance Data Structure Format**
   - What we know: CONTEXT.md says "track provenance: record why each entity was derived"
   - What's unclear: Exact format (flat dict? nested structure? separate table?)
   - Recommendation: Start with simple `dict[str, str]` mapping `entity_key -> reason`, extend if needed

2. **Performance with Large Graphs**
   - What we know: max_depth=10 is safety cap; batch queries help
   - What's unclear: Real-world graph sizes; query performance at scale
   - Recommendation: Implement with batching; add metrics; optimize if needed

3. **Resources Computed On-Demand vs Stored**
   - What we know: CONTEXT.md says "computed on-demand (not stored in module JSON)"
   - What's unclear: Should module detail endpoint compute and return resources?
   - Recommendation: Add `resources` to module detail response, compute dynamically like other derived entities

## Sources

### Primary (HIGH confidence)
- [Python graphlib docs](https://docs.python.org/3/library/graphlib.html) - TopologicalSorter API, CycleError
- `/home/daharoni/dev/ontology-hub/backend/app/services/module_derived.py` - Current derivation implementation
- `/home/daharoni/dev/ontology-hub/backend/app/services/validation/inheritance.py` - Cycle detection pattern
- `/home/daharoni/dev/ontology-hub/backend/app/routers/draft_changes.py` - auto_populate_module_derived()
- `/home/daharoni/dev/ontology-hub/backend/app/routers/entities.py` - compute_module_closure() CTE pattern
- `/home/daharoni/dev/labki-ontology/properties/_schema.json` - Property schema with Allows_value_from_category
- `/home/daharoni/dev/ontology-hub/CLAUDE.md` - JSON Patch "add" vs "replace" documentation

### Secondary (MEDIUM confidence)
- [RFC 6902 JSON Patch](https://datatracker.ietf.org/doc/html/rfc6902) - "add" operation behavior
- [Dependency Resolving Algorithm](https://www.electricmonk.nl/docs/dependency_resolving_algorithm/dependency_resolving_algorithm.html) - Visited set pattern

### Tertiary (LOW confidence)
- [Python cpython PR #130875](https://github.com/python/cpython/pull/130875) - graphlib.as_transitive() proposal (not yet merged)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All stdlib or existing codebase libraries
- Architecture: HIGH - Patterns extracted directly from codebase
- Pitfalls: HIGH - Based on CLAUDE.md documentation and codebase analysis

**Research date:** 2026-01-28
**Valid until:** 60 days (stable domain, internal implementation)
