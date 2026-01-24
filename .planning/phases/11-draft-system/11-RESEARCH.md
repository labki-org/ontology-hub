# Phase 11: Draft System - Research

**Researched:** 2026-01-24
**Domain:** JSON Patch storage, effective view computation, auto-rebase mechanics
**Confidence:** HIGH

## Summary

This phase implements a draft system that stores proposed changes as RFC 6902 JSON Patch operations (for updates) or full replacement JSON (for creates), with server-side effective view computation and automatic rebase when canonical data changes.

The system builds on Phase 8's draft tables (already implemented) and Phase 10's query overlay service (already implemented). The core technical challenge is auto-rebase: when new canonical data is ingested, in-progress drafts must automatically recompute their patches against the new base, detecting conflicts and marking drafts that cannot cleanly rebase.

**Key architectural decisions already locked in:**
- Hybrid patch format: JSON Patch (RFC 6902) for UPDATE operations, full replacement JSON for CREATE operations
- Server-side overlay: All effective view computation happens server-side via `DraftOverlayService` (Phase 10)
- Validation on every save: Invalid patches rejected immediately, not queued for later validation
- Single-version model: No conflict detection between concurrent editors needed (drafts are private, single-author)

**Primary recommendation:** Use Python's `jsonpatch` library (already integrated in Phase 10) for all patch operations. Implement auto-rebase as a background job triggered by ingest completion, using try-apply strategy to detect conflicts. For localized inheritance re-materialization during draft edits, compute effective properties application-side by overlaying draft changes on the materialized view.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| jsonpatch | 1.33 | RFC 6902 JSON Patch application | Official Python implementation, handles edge cases, used in Phase 10 |
| python-json-patch | 1.33 | Patch generation via diff | Same library as jsonpatch, provides `make_patch()` for diff generation |
| deepcopy | stdlib | Safe copying before patch | Prevents mutation of cached/shared data (critical per Phase 10 design) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pytest | Current | Testing patch edge cases | Verify conflict detection, rebase logic |
| FastAPI BackgroundTasks | Built-in | Async rebase jobs | Trigger rebase after ingest without blocking response |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| jsonpatch | json-merge-patch (RFC 7386) | Simpler but loses operation granularity, can't express deletes vs null |
| Python library | JavaScript fast-json-patch | Would require Node.js, adds deployment complexity |
| Application-layer overlay | Database-layer JSON operations | Would require PostgreSQL JSONB path operations, harder to debug |

**Installation:**
```bash
# Already installed in Phase 10
pip install jsonpatch==1.33
```

## Architecture Patterns

### Recommended Project Structure
```
backend/app/
├── services/
│   ├── draft_overlay.py       # Phase 10 - Effective view computation (DONE)
│   ├── draft_rebase.py         # NEW - Auto-rebase logic
│   └── draft_validation.py     # NEW - Patch validation before save
├── routers/
│   ├── drafts_v2.py            # NEW - Draft CRUD endpoints
│   └── mediawiki_import.py     # NEW - MediaWiki push import
└── models/v2/
    └── draft.py                # Phase 8 - Draft tables (DONE)
```

### Pattern 1: Effective View Computation (Server-Side Overlay)

**What:** Server computes effective entity state by applying draft patches to canonical data. Frontend never performs merging.

**When to use:** Every query endpoint when `draft_id` parameter is provided.

**Already implemented in Phase 10:**
```python
# Source: backend/app/services/draft_overlay.py (Phase 10)
from app.services.draft_overlay import DraftOverlayService

async def get_category(entity_key: str, draft_ctx: DraftOverlayService):
    # Load canonical entity
    canonical = await load_canonical_category(entity_key)

    # Apply draft overlay (handles CREATE/UPDATE/DELETE)
    effective = await draft_ctx.apply_overlay(
        canonical=canonical,
        entity_type="category",
        entity_key=entity_key
    )
    # Returns dict with _change_status metadata
    return effective
```

**Key insight:** `apply_overlay()` handles all three change types:
- CREATE: Returns `replacement_json` with `_change_status="added"`
- DELETE: Returns canonical with `_change_status="deleted"` and `_deleted=True`
- UPDATE: Deep copies canonical, applies JSON Patch, returns with `_change_status="modified"`

### Pattern 2: Auto-Rebase on Ingest

**What:** When new canonical data is ingested (new commit_sha), detect all drafts based on old commit and attempt to rebase their patches.

**When to use:** After every successful ingest operation (Phase 9).

**Implementation strategy:**
```python
# Source: Auto-rebase pattern for JSON Patch systems
async def auto_rebase_drafts(session: AsyncSession, new_commit_sha: str, old_commit_sha: str):
    """Rebase all in-progress drafts after canonical update.

    For each draft with base_commit_sha == old_commit_sha:
    1. For each draft_change:
       - Load new canonical entity (at new_commit_sha)
       - Try to apply the stored patch
       - If successful: update rebase_status="clean", rebase_commit_sha=new
       - If JsonPatchConflict: mark rebase_status="conflict"
    2. Update draft.rebase_commit_sha and draft.rebase_status
    """

    # Find drafts that need rebase
    drafts_query = select(Draft).where(
        Draft.base_commit_sha == old_commit_sha,
        Draft.status.in_([DraftStatus.DRAFT, DraftStatus.VALIDATED])
    )
    drafts = (await session.execute(drafts_query)).scalars().all()

    for draft in drafts:
        conflict_detected = False

        # Load all changes for this draft
        changes_query = select(DraftChange).where(DraftChange.draft_id == draft.id)
        changes = (await session.execute(changes_query)).scalars().all()

        for change in changes:
            if change.change_type == ChangeType.UPDATE:
                # Try to apply patch to new canonical base
                new_canonical = await load_entity_at_commit(
                    change.entity_type,
                    change.entity_key,
                    new_commit_sha
                )

                if not new_canonical:
                    # Entity was deleted in new canonical
                    conflict_detected = True
                    break

                try:
                    # Test if patch still applies
                    import jsonpatch
                    from copy import deepcopy

                    test_base = deepcopy(new_canonical.canonical_json)
                    patch = jsonpatch.JsonPatch(change.patch)
                    patch.apply(test_base)  # Raises JsonPatchConflict if fails

                except jsonpatch.JsonPatchConflict:
                    conflict_detected = True
                    break

            elif change.change_type == ChangeType.DELETE:
                # Check if entity still exists
                new_canonical = await load_entity_at_commit(
                    change.entity_type,
                    change.entity_key,
                    new_commit_sha
                )
                if not new_canonical:
                    # Entity already deleted in canonical
                    conflict_detected = True
                    break

        # Update draft rebase status
        draft.rebase_commit_sha = new_commit_sha
        draft.rebase_status = "conflict" if conflict_detected else "clean"
        session.add(draft)

    await session.commit()
```

**Critical details:**
- Use try-apply strategy: attempt to apply patch to new base, catch `JsonPatchConflict`
- Don't modify the draft_change rows - keep original patches for manual conflict resolution
- Mark draft with `rebase_status="conflict"` for user review
- Only rebase drafts in DRAFT or VALIDATED status (not SUBMITTED/MERGED/REJECTED)

### Pattern 3: Validation on Save

**What:** Validate JSON Patch operations immediately when creating/updating draft changes, before storing to database.

**When to use:** Every POST/PUT to draft_change endpoints.

**Example:**
```python
# Source: JSON Patch validation pattern
from pydantic import BaseModel, field_validator
import jsonpatch

class DraftChangeCreate(BaseModel):
    change_type: ChangeType
    entity_type: str
    entity_key: str
    patch: dict | None = None
    replacement_json: dict | None = None

    @field_validator('patch')
    @classmethod
    def validate_patch_format(cls, v, info):
        """Validate that patch is valid JSON Patch format."""
        if v is None:
            return v

        # Check if it's a valid JSON Patch document
        if not isinstance(v, list):
            raise ValueError("patch must be a JSON array")

        for op in v:
            if not isinstance(op, dict):
                raise ValueError("Each patch operation must be an object")

            if 'op' not in op or 'path' not in op:
                raise ValueError("Each operation must have 'op' and 'path'")

            valid_ops = ['add', 'remove', 'replace', 'move', 'copy', 'test']
            if op['op'] not in valid_ops:
                raise ValueError(f"Invalid operation: {op['op']}")

        # Try to construct JsonPatch to validate
        try:
            jsonpatch.JsonPatch(v)
        except jsonpatch.InvalidJsonPatch as e:
            raise ValueError(f"Invalid JSON Patch: {e}")

        return v

    @field_validator('replacement_json')
    @classmethod
    def validate_replacement(cls, v, info):
        """Validate replacement JSON for CREATE operations."""
        if v is None:
            return v

        # Must be a dict with required fields
        if not isinstance(v, dict):
            raise ValueError("replacement_json must be a JSON object")

        # Check for required entity fields (entity_key, label, etc.)
        required = ['entity_key', 'label']
        for field in required:
            if field not in v:
                raise ValueError(f"replacement_json missing required field: {field}")

        return v
```

**Key insight:** Validate structure at API boundary, then test actual application against canonical data. Reject immediately if patch is malformed or would fail to apply.

### Pattern 4: MediaWiki Import Payload Design

**What:** MediaWiki extension sends explicit action signals (create/modify/delete) to prevent ambiguity from typos.

**Payload structure (recommended):**
```json
{
  "source": "mediawiki_push",
  "wiki_url": "https://smw.example.com",
  "user": "WikiUser",
  "comment": "Updated Person category properties",
  "changes": [
    {
      "action": "modify",
      "entity_type": "category",
      "entity_key": "Person",
      "patch": [
        {"op": "replace", "path": "/description", "value": "A human being (updated)"}
      ]
    },
    {
      "action": "create",
      "entity_type": "property",
      "entity_key": "birthPlace",
      "entity": {
        "entity_key": "birthPlace",
        "label": "Birth place",
        "description": "Location where person was born",
        "data_type": "Page"
      }
    },
    {
      "action": "delete",
      "entity_type": "property",
      "entity_key": "deprecated_field"
    }
  ]
}
```

**Processing logic:**
```python
async def process_mediawiki_import(payload: MediaWikiImportPayload):
    """Create draft from MediaWiki push.

    Each push creates a NEW draft (not appended to existing).
    Unknown entity_key without "create" action is REJECTED.
    """
    # Create draft container
    draft = Draft(
        source=DraftSource.MEDIAWIKI_PUSH,
        base_commit_sha=current_commit_sha,
        title=f"MediaWiki import: {payload.comment}",
        description=f"From {payload.wiki_url} by {payload.user}"
    )
    session.add(draft)
    await session.flush()  # Get draft.id

    for change in payload.changes:
        # Validate entity exists for modify/delete
        if change.action in ["modify", "delete"]:
            canonical = await load_canonical_entity(
                change.entity_type,
                change.entity_key
            )
            if not canonical:
                raise ValueError(
                    f"Unknown entity_key '{change.entity_key}' with action '{change.action}'. "
                    f"Use action='create' for new entities or fix the entity_key."
                )

        # Validate entity doesn't exist for create
        if change.action == "create":
            canonical = await load_canonical_entity(
                change.entity_type,
                change.entity_key
            )
            if canonical:
                raise ValueError(
                    f"Entity '{change.entity_key}' already exists. "
                    f"Use action='modify' to update existing entities."
                )

        # Create draft_change row
        draft_change = DraftChange(
            draft_id=draft.id,
            change_type=ChangeType[change.action.upper()],
            entity_type=change.entity_type,
            entity_key=change.entity_key,
            patch=change.patch if change.action == "modify" else None,
            replacement_json=change.entity if change.action == "create" else None
        )
        session.add(draft_change)

    await session.commit()
    return draft
```

### Pattern 5: Localized Re-Materialization for Draft Edits

**What:** When editing category_parent or category_property in a draft, compute effective properties on-demand by overlaying draft changes on the materialized view.

**When to use:** Draft preview queries that need effective properties.

**Implementation:**
```python
async def get_effective_properties_for_draft(
    session: AsyncSession,
    draft_id: uuid.UUID,
    category_key: str
) -> list[dict]:
    """Compute effective properties overlaying draft changes on mat view.

    Strategy:
    1. Load effective properties from materialized view (canonical base)
    2. Load draft changes affecting this category's inheritance chain
    3. Apply changes application-side to compute draft-effective properties

    This avoids refreshing the materialized view for every draft edit.
    """
    # Load canonical effective properties
    canonical_category = await load_canonical_category(category_key)
    if not canonical_category:
        return []

    canonical_props_query = select(CategoryPropertyEffective).where(
        CategoryPropertyEffective.category_id == canonical_category.id
    )
    canonical_props = (await session.execute(canonical_props_query)).scalars().all()

    # Load draft changes for this category and its ancestors
    draft_changes_query = select(DraftChange).where(
        DraftChange.draft_id == draft_id,
        DraftChange.entity_type == "category"
    )
    draft_changes = (await session.execute(draft_changes_query)).scalars().all()

    # Build map of draft-modified category_property assignments
    draft_property_changes = {}  # {category_key: {property_key: is_required}}

    for change in draft_changes:
        if change.change_type == ChangeType.UPDATE and change.patch:
            # Check if patch modifies category_property assignments
            # This is simplified - real implementation would parse patch operations
            pass  # Application-layer logic to detect property assignment changes

    # Merge canonical + draft changes (simplified)
    effective_properties = []
    for prop in canonical_props:
        # Check if this property assignment was modified in draft
        # If so, use draft version; otherwise use canonical
        effective_properties.append({
            "property_id": prop.property_id,
            "source_category_id": prop.source_category_id,
            "depth": prop.depth,
            "is_required": prop.is_required,
            "_change_status": "unchanged"  # or "modified" if changed in draft
        })

    return effective_properties
```

**Key insight:** Don't refresh the materialized view for draft edits. Instead, load canonical effective properties and overlay draft changes application-side. This keeps draft edits fast and isolated.

### Anti-Patterns to Avoid

- **Storing patches as strings:** Use JSONB/dict, not text. Already correct in Phase 8 design.
- **Client-side patch application:** All overlay computation must be server-side (Phase 10 decision).
- **Validation only on submit:** Validate on every save to give immediate feedback (locked in context).
- **Modifying draft_change rows during rebase:** Keep original patches, update only draft.rebase_status.
- **Full mat view refresh for draft preview:** Use application-layer overlay on existing mat view.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON Patch application | Custom patch interpreter | `jsonpatch.JsonPatch.apply()` | RFC 6902 compliant, handles all 6 operations, edge cases tested |
| Patch generation from diff | Manual operation builder | `jsonpatch.make_patch(old, new)` | Automatically generates minimal patch set |
| Conflict detection | String comparison of paths | Try-apply with `JsonPatchConflict` exception | Catches semantic conflicts (missing keys, array bounds) |
| Deep copying before patch | Manual recursive copy | `copy.deepcopy()` | Handles circular refs, builtin types correctly |
| Operational transformation | Custom merge algorithm | Mark conflicts, manual resolution | OT libraries exist but add complexity; simpler to flag conflicts |
| MediaWiki auth | Custom token scheme | Use MediaWiki OAuth or API tokens | Established, secure, documented |

**Key insight:** The `jsonpatch` library handles edge cases like array index `-` (append), path escaping (`/foo~1bar` for `/foo/bar`), and the `test` operation. Don't reimplement these.

## Common Pitfalls

### Pitfall 1: Mutation of Cached Data

**What goes wrong:** Applying patches directly to loaded canonical entities mutates cached/shared data, corrupting responses for other users.

**Why it happens:** `jsonpatch.apply()` defaults to `in_place=False` but operates on mutable dicts.

**How to avoid:**
- **ALWAYS** `deepcopy()` before applying patches (Phase 10 pattern)
- Never use `in_place=True` on canonical data
- Verify in tests: load entity twice, patch one, confirm other unchanged

**Warning signs:** Different users see each other's draft changes, test failures with shared fixtures.

**Example:**
```python
# WRONG - mutates canonical
canonical = await load_canonical_entity()
patch.apply(canonical.canonical_json)  # Mutates shared dict!

# CORRECT - Phase 10 pattern
from copy import deepcopy
canonical = await load_canonical_entity()
base = deepcopy(canonical.canonical_json)  # Safe copy
result = patch.apply(base)  # Mutation isolated
```

### Pitfall 2: Rebase Without Conflict Detection

**What goes wrong:** Auto-rebase blindly applies old patches to new canonical, silently corrupting data when base entity structure changed incompatibly.

**Why it happens:** No try-apply before updating rebase_status.

**How to avoid:**
- Use try-except around patch application during rebase
- Catch `JsonPatchConflict` and mark draft as conflicted
- Don't modify draft_change rows during rebase (keep original patches)
- Test with scenarios: base entity deleted, field renamed, array reordered

**Warning signs:** Draft previews show corrupted data after canonical update, silent rebase failures.

**Example:**
```python
# WRONG - no conflict detection
draft.rebase_commit_sha = new_commit
draft.rebase_status = "clean"  # Blind assumption!

# CORRECT - try-apply strategy
try:
    test_base = deepcopy(new_canonical.canonical_json)
    patch.apply(test_base)
    draft.rebase_status = "clean"
except jsonpatch.JsonPatchConflict:
    draft.rebase_status = "conflict"
draft.rebase_commit_sha = new_commit
```

### Pitfall 3: MediaWiki Entity Key Typos

**What goes wrong:** MediaWiki sends `entity_key="Persn"` (typo) with action `modify`, system treats it as legitimate modify attempt, fails mysteriously.

**Why it happens:** No explicit intent signaling - system can't distinguish typo from intentional new entity.

**How to avoid:**
- **REQUIRE** explicit action field: "create" | "modify" | "delete"
- **REJECT** modify/delete for unknown entity_key with helpful error
- **REQUIRE** create action to explicitly include "action": "create"
- Document MediaWiki extension requirements clearly

**Warning signs:** MediaWiki users report "entity not found" errors without understanding why.

**Example:**
```python
# WRONG - ambiguous
{
  "entity_key": "Persn",  # Typo of "Person"
  "patch": [...]  # Implicitly modify? Create?
}

# CORRECT - explicit intent
{
  "action": "modify",  # Explicit!
  "entity_key": "Persn",
  "patch": [...]
}
# System responds: "Unknown entity_key 'Persn' with action 'modify'.
# Use action='create' for new entities or fix the entity_key."
```

### Pitfall 4: Test Operation Failures Abort Entire Patch

**What goes wrong:** Using `test` operations for validation causes entire patch to fail if single test fails, losing all draft changes.

**Why it happens:** RFC 6902 atomicity - if any operation fails, entire patch is rejected.

**How to avoid:**
- Use `test` operations only for critical preconditions (not general validation)
- Separate validation from patch application
- Run validation before storing patch, not during application
- Allow partial success for multi-entity drafts (validate per change)

**Warning signs:** User edits multiple fields, one validation fails, all changes lost.

### Pitfall 5: Forgetting deepcopy on Effective View Queries

**What goes wrong:** List endpoints cache canonical entities, overlay service mutates them, all subsequent queries return modified data.

**Why it happens:** Forgot `deepcopy()` in `apply_overlay()` for one code path.

**How to avoid:**
- **Every** path in `apply_overlay()` must `deepcopy()` before returning
- Phase 10 already implements this correctly - don't break it
- Add integration test: query same entity with different draft_id values

**Warning signs:** First draft query correct, second draft query shows previous draft's changes.

### Pitfall 6: Inheritance Re-Materialization for Every Draft Edit

**What goes wrong:** Refreshing category_property_effective materialized view on every draft save makes draft editing extremely slow (10+ seconds per save).

**Why it happens:** Misunderstanding "localized re-materialization" - tried to refresh mat view for draft preview.

**How to avoid:**
- **NEVER** refresh materialized view for draft edits
- Compute draft-effective properties **application-side** by overlaying draft changes on cached mat view
- Only refresh mat view on canonical ingest (Phase 9)

**Warning signs:** Draft save endpoints take 10+ seconds, database shows mat view refresh locks.

## Code Examples

Verified patterns from official sources and existing codebase:

### JSON Patch Application (Phase 10 Pattern)

```python
# Source: backend/app/services/draft_overlay.py (Phase 10)
import jsonpatch
from copy import deepcopy

# Apply patch with safe copying
canonical_json = entity.canonical_json
base = deepcopy(canonical_json)  # CRITICAL: prevent mutation

try:
    patch_ops = draft_change.patch
    if patch_ops:
        patch = jsonpatch.JsonPatch(patch_ops)
        result = patch.apply(base)
    else:
        result = base
    result["_change_status"] = "modified"
    return result
except jsonpatch.JsonPatchException as e:
    # Patch failed - return canonical with error marker
    result = deepcopy(canonical_json)
    result["_change_status"] = "unchanged"
    result["_patch_error"] = str(e)
    return result
```

### Generating Patches from Diffs

```python
# Source: https://python-json-patch.readthedocs.io/
import jsonpatch

old_entity = {
    "entity_key": "Person",
    "label": "Person",
    "description": "A human being"
}

new_entity = {
    "entity_key": "Person",
    "label": "Person",
    "description": "A human being (updated)",
    "aliases": ["Human"]  # Added field
}

# Generate patch automatically
patch = jsonpatch.make_patch(old_entity, new_entity)

# Result: JsonPatch([
#   {'op': 'replace', 'path': '/description', 'value': 'A human being (updated)'},
#   {'op': 'add', 'path': '/aliases', 'value': ['Human']}
# ])

# Store as list for database
patch_ops = patch.patch  # Access underlying list
```

### Validation with Pydantic

```python
# Source: Pydantic field validation pattern
from pydantic import BaseModel, field_validator
import jsonpatch

class DraftChangeCreate(BaseModel):
    change_type: ChangeType
    entity_type: str
    entity_key: str
    patch: list[dict] | None = None
    replacement_json: dict | None = None

    @field_validator('patch')
    @classmethod
    def validate_patch(cls, v):
        """Validate JSON Patch format."""
        if v is None:
            return v

        try:
            # This validates structure and operations
            jsonpatch.JsonPatch(v)
        except jsonpatch.InvalidJsonPatch as e:
            raise ValueError(f"Invalid JSON Patch: {e}")

        return v

    def model_post_init(self, __context):
        """Cross-field validation after all fields set."""
        # UPDATE requires patch, CREATE requires replacement_json
        if self.change_type == ChangeType.UPDATE and not self.patch:
            raise ValueError("UPDATE change_type requires patch")
        if self.change_type == ChangeType.CREATE and not self.replacement_json:
            raise ValueError("CREATE change_type requires replacement_json")
        if self.change_type == ChangeType.DELETE and (self.patch or self.replacement_json):
            raise ValueError("DELETE change_type must not have patch or replacement_json")
```

### Auto-Rebase Detection

```python
# Source: Conflict detection pattern for JSON Patch rebase
import jsonpatch
from copy import deepcopy

async def check_patch_applies(
    patch_ops: list[dict],
    new_canonical_json: dict
) -> tuple[bool, str | None]:
    """Test if patch applies cleanly to new canonical.

    Returns:
        (success: bool, error_message: str | None)
    """
    try:
        test_base = deepcopy(new_canonical_json)
        patch = jsonpatch.JsonPatch(patch_ops)
        patch.apply(test_base)
        return (True, None)
    except jsonpatch.JsonPatchConflict as e:
        return (False, f"Patch conflict: {e}")
    except jsonpatch.JsonPatchException as e:
        return (False, f"Patch error: {e}")
```

### MediaWiki Import Payload Schema

```python
# Source: Designed for this phase (Claude's discretion)
from pydantic import BaseModel, field_validator

class MediaWikiChange(BaseModel):
    """Single entity change from MediaWiki."""
    action: Literal["create", "modify", "delete"]
    entity_type: str  # "category", "property", etc.
    entity_key: str
    patch: list[dict] | None = None  # For action="modify"
    entity: dict | None = None  # For action="create"

    @field_validator('action')
    @classmethod
    def validate_action(cls, v):
        if v not in ["create", "modify", "delete"]:
            raise ValueError(f"Invalid action: {v}")
        return v

    def model_post_init(self, __context):
        """Validate action-specific requirements."""
        if self.action == "modify" and not self.patch:
            raise ValueError("action 'modify' requires patch field")
        if self.action == "create" and not self.entity:
            raise ValueError("action 'create' requires entity field")
        if self.action == "delete" and (self.patch or self.entity):
            raise ValueError("action 'delete' must not have patch or entity")

class MediaWikiImportPayload(BaseModel):
    """Complete payload from MediaWiki push."""
    source: str = "mediawiki_push"
    wiki_url: str
    user: str
    comment: str
    changes: list[MediaWikiChange]
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| v1.0 single payload blob | v2.0 granular draft_change rows | Phase 8 (2026-01) | Enables per-entity rebase, better conflict detection |
| Client-side draft merging | Server-side overlay (DraftOverlayService) | Phase 10 (2026-01) | Consistent effective views, simpler frontend |
| Validation on submit | Validation on every save | Phase 11 context | Immediate feedback, prevents accumulating invalid patches |
| Implicit MediaWiki actions | Explicit action field (create/modify/delete) | Phase 11 context | Prevents ambiguity from entity_key typos |

**Deprecated/outdated:**
- v1.0 `drafts` table with single `payload` field: Replaced by v2.0 `draft` + `draft_change` tables (Phase 8)
- RFC 7386 JSON Merge Patch: Not suitable for this use case (can't express deletes vs null, loses operation granularity)

## New Entity Storage Format Decision

**Decision:** Use **full replacement JSON** for CREATE operations (not patch-against-empty-object).

**Reasoning:**
1. **Schema consistency:** Phase 8 draft_change table already has separate `patch` and `replacement_json` columns
2. **Clarity:** Full JSON makes intent explicit - this is a complete new entity definition
3. **Validation simplicity:** Easier to validate required fields on full object than on patch operations
4. **MediaWiki integration:** MediaWiki sends complete entity definitions, not patches
5. **Debugging:** Easier to inspect full entity than reconstruct from patch

**Implementation:**
```python
# CREATE operations store full entity
DraftChange(
    change_type=ChangeType.CREATE,
    entity_type="property",
    entity_key="newProperty",
    patch=None,  # Not used for CREATE
    replacement_json={
        "entity_key": "newProperty",
        "label": "New Property",
        "description": "...",
        "data_type": "Text"
    }
)

# UPDATE operations store patch
DraftChange(
    change_type=ChangeType.UPDATE,
    entity_type="property",
    entity_key="existingProperty",
    patch=[
        {"op": "replace", "path": "/description", "value": "Updated description"}
    ],
    replacement_json=None  # Not used for UPDATE
)
```

## Open Questions

### Question 1: Operational Transformation for Concurrent Edits

**What we know:** Phase context states "single-version model: no conflict detection needed (drafts are private, single-author)"

**What's unclear:** If we later want to support collaborative drafts, would we need Operational Transformation (OT) libraries like `json-patch-ot`?

**Recommendation:** Defer OT until collaborative drafts are a requirement. Current single-author model is simpler and sufficient. If needed later, libraries exist ([json-patch-ot](https://github.com/Palindrom/JSON-Patch-OT), [@salsita/json-patch-ot](https://www.npmjs.com/package/@salsita/json-patch-ot)).

### Question 2: Rebase Conflict Resolution UI

**What we know:** Auto-rebase marks conflicts with `rebase_status="conflict"`, but doesn't resolve them.

**What's unclear:** What UI/UX should we provide for users to resolve conflicts? Show diff? Allow re-editing?

**Recommendation:** Phase 12 (Frontend) should design conflict resolution UI. For Phase 11, just ensure backend provides:
- Original patch (in draft_change.patch)
- New canonical state (via query endpoints)
- Clear conflict marker (rebase_status field)

### Question 3: Performance of Application-Layer Inheritance Overlay

**What we know:** Localized re-materialization should compute effective properties application-side, not refresh mat view.

**What's unclear:** Will loading canonical mat view + overlaying draft changes be fast enough for interactive editing?

**Recommendation:** Implement application-layer overlay as designed. If performance becomes an issue, consider:
- Caching effective properties per draft_id (Redis)
- Incremental computation (only recompute changed categories)
- Profile first before optimizing

## Sources

### Primary (HIGH confidence)
- [RFC 6902 - JSON Patch](https://datatracker.ietf.org/doc/html/rfc6902) - Official specification, all operation types and semantics
- [python-json-patch documentation](https://python-json-patch.readthedocs.io/en/stable/mod-jsonpatch.html) - Official Python library docs, API and exceptions
- backend/app/services/draft_overlay.py - Phase 10 implementation (existing codebase)
- backend/app/models/v2/draft.py - Phase 8 draft tables (existing codebase)
- .planning/phases/11-draft-system/11-CONTEXT.md - User decisions and constraints

### Secondary (MEDIUM confidence)
- [JSON Patch support in ASP.NET Core](https://learn.microsoft.com/en-us/aspnet/core/web-api/jsonpatch?view=aspnetcore-10.0) - Security considerations and validation strategies
- [Use JSON Patch to Resolve Conflicts](https://dev.to/neighbourhoodie/use-json-patch-to-resolve-conflicts-3coa) - Three-way merge pattern with JSON Patch history
- [Validating JSON Patch Requests](https://medium.com/@markherhold/validating-json-patch-requests-44ca5981a7fc) - Validation patterns and strategies

### Tertiary (LOW confidence - marked for validation)
- WebSearch results about operational transformation - Multiple libraries exist but implementation details vary
- MediaWiki API documentation - Standard import API exists but custom push format needs design

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - jsonpatch library well-established, Phase 10 already uses it
- Architecture: HIGH - Phase 10 overlay service already implemented, patterns proven
- Auto-rebase: MEDIUM - Try-apply strategy is sound but needs testing with real conflict scenarios
- MediaWiki import: MEDIUM - Payload design is custom (Claude's discretion), needs validation with MediaWiki team
- Localized re-materialization: MEDIUM - Application-layer overlay is straightforward but performance unknown

**Research date:** 2026-01-24
**Valid until:** 2026-02-23 (30 days - stable domain, RFC 6902 unchanged since 2013)
