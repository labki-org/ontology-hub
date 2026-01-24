# Phase 9: Ingest Pipeline - Research

**Researched:** 2026-01-23
**Domain:** GitHub webhook handling, JSON Schema validation, transactional database updates, materialized view refresh
**Confidence:** HIGH

## Summary

This phase implements the ingest pipeline that populates the v2.0 database schema from the labki-schemas repo. The pipeline is triggered by GitHub webhooks (push events) or manual re-ingest, and performs a complete replacement of all canonical data in a single atomic transaction. The existing v1.0 codebase provides a solid foundation with working webhook handler and GitHub client that can be adapted for v2.0.

Key decisions from CONTEXT.md constrain the approach:
- **Webhook-triggered ingest**: GitHub push events trigger automatic ingest
- **Manual re-ingest**: Admin can trigger via UI button (future phase)
- **No debouncing**: Each push processed individually, later overwrites earlier
- **GitHub signature verification**: X-Hub-Signature-256 required on webhook endpoint
- **Draft staleness**: When canonical updates, in-progress drafts marked "stale" (not auto-rebased)

**Primary recommendation:** Extend the existing v1.0 webhook handler pattern with v2.0 ingest service. Use the `jsonschema` library for JSON Schema Draft 2020-12 validation against `_schema.json` files. Perform atomic replacement using SQLAlchemy async transaction with explicit delete-then-insert pattern. Refresh the `category_property_effective` materialized view with `CONCURRENTLY` option after entity tables are populated.

## Standard Stack

The established libraries/tools for this domain:

### Core (Already in use - no changes)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| httpx | ^0.27.0 | Async HTTP client | Already used in v1.0 GitHub client |
| tenacity | ^9.0.0 | Retry with exponential backoff | Already used in v1.0 for rate limits |
| FastAPI BackgroundTasks | built-in | Async background processing | Already used in v1.0 webhook handler |
| SQLModel | ^0.0.22 | ORM layer | Already used for all models |
| SQLAlchemy | ^2.0.x | Async session transactions | Comes with SQLModel |

### Supporting (New additions for v2.0)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| jsonschema | ^4.23.0 | JSON Schema Draft 2020-12 validation | Validate entity files against `_schema.json` |
| referencing | ^0.35.0 | JSON Schema reference resolution | Required by jsonschema for `$ref` handling |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| jsonschema | jsonschema-rs | Faster (Rust-based) but less Python-native; jsonschema is sufficient for <100 files |
| BackgroundTasks | Celery | More robust for heavy workloads; overkill for single-repo ingest |
| Full delete + insert | UPSERT pattern | UPSERT preserves IDs but complicates relationship handling; full replace is cleaner for "latest-only" model |

**Installation:**
```bash
pip install jsonschema referencing
```

## Architecture Patterns

### Recommended Project Structure

```
backend/app/
├── services/
│   ├── github.py          # Existing GitHub client (reuse)
│   ├── ingest_v2.py        # NEW: v2.0 ingest service
│   └── validators/
│       └── schema_validator.py  # NEW: JSON Schema validation
├── routers/
│   └── webhooks.py         # Existing webhook handler (extend)
└── models/v2/              # Existing v2.0 models (use)
```

### Pattern 1: Atomic Replacement with Ordered Deletion

**What:** Replace all canonical data atomically using delete-then-insert within a single transaction. Delete in reverse dependency order to avoid FK constraint violations.

**When to use:** Every ingest operation (webhook-triggered or manual).

**Example:**
```python
# Source: SQLAlchemy 2.0 documentation + PostgreSQL FK patterns
from sqlalchemy import delete
from sqlmodel.ext.asyncio.session import AsyncSession

async def replace_all_canonical_data(
    session: AsyncSession,
    entities: dict,  # {"categories": [...], "properties": [...], ...}
    relationships: dict,  # {"category_parent": [...], ...}
):
    """Atomically replace all canonical data in correct order."""
    async with session.begin():
        # 1. Delete relationships first (depend on entities)
        await session.execute(delete(ModuleEntity))
        await session.execute(delete(BundleModule))
        await session.execute(delete(CategoryProperty))
        await session.execute(delete(CategoryParent))

        # 2. Delete entities (no dependencies between them)
        await session.execute(delete(Template))
        await session.execute(delete(Bundle))
        await session.execute(delete(Module))
        await session.execute(delete(Subobject))
        await session.execute(delete(Property))
        await session.execute(delete(Category))

        # 3. Insert entities (order doesn't matter with FKs cleared)
        session.add_all(entities["categories"])
        session.add_all(entities["properties"])
        session.add_all(entities["subobjects"])
        session.add_all(entities["modules"])
        session.add_all(entities["bundles"])
        session.add_all(entities["templates"])

        # 4. Flush to get generated UUIDs
        await session.flush()

        # 5. Insert relationships (entities now exist)
        session.add_all(relationships["category_parent"])
        session.add_all(relationships["category_property"])
        session.add_all(relationships["module_entity"])
        session.add_all(relationships["bundle_module"])

        # Transaction commits on context exit
```

**Rationale:** Deleting all then inserting all is simpler than UPSERT when we're doing full replacement anyway. The "latest-only" model means we don't need to preserve entity UUIDs across ingests.

### Pattern 2: JSON Schema Validation with Per-Directory Schemas

**What:** Load `_schema.json` from each entity directory and validate all files in that directory against it.

**When to use:** Before inserting any data into the database (fail-fast validation).

**Example:**
```python
# Source: jsonschema library documentation + labki-schemas structure
from jsonschema import Draft202012Validator, ValidationError
from jsonschema.exceptions import SchemaError
import json

class SchemaValidator:
    """Validate entity JSON files against directory _schema.json files."""

    def __init__(self, schemas: dict[str, dict]):
        """Initialize with pre-loaded schemas.

        Args:
            schemas: {"categories": {...}, "properties": {...}, ...}
        """
        self._validators: dict[str, Draft202012Validator] = {}
        for entity_type, schema in schemas.items():
            try:
                Draft202012Validator.check_schema(schema)
                self._validators[entity_type] = Draft202012Validator(schema)
            except SchemaError as e:
                # Log but don't fail - schema itself is invalid
                warnings.append(f"Invalid schema for {entity_type}: {e.message}")

    def validate(self, entity_type: str, data: dict, path: str) -> list[str]:
        """Validate entity data against its schema.

        Returns:
            List of validation error messages (empty if valid)
        """
        if entity_type not in self._validators:
            return [f"No validator for entity type: {entity_type}"]

        errors = []
        for error in self._validators[entity_type].iter_errors(data):
            errors.append(f"{path}: {error.message} at {error.json_path}")
        return errors
```

### Pattern 3: Entity Parsing with Relationship Extraction

**What:** Parse raw JSON into v2.0 model instances, extracting relationship data for separate tables.

**When to use:** When processing each entity file from the repo.

**Example:**
```python
# Source: labki-schemas structure analysis + v2.0 model definitions
from app.models.v2 import Category, Property, CategoryParent, CategoryProperty

def parse_category(content: dict, path: str) -> tuple[Category, list[dict]]:
    """Parse category JSON into model and extracted relationships.

    Returns:
        (Category instance, list of relationship dicts)
    """
    entity_key = content["id"]  # e.g., "Person"

    category = Category(
        entity_key=entity_key,
        source_path=path,  # e.g., "categories/Person.json"
        label=content["label"],
        description=content.get("description"),
        canonical_json=content,
    )

    relationships = []

    # Extract parent relationships
    for parent_key in content.get("parents", []):
        relationships.append({
            "type": "category_parent",
            "category_key": entity_key,
            "parent_key": parent_key,
        })

    # Extract required property relationships
    for prop_key in content.get("required_properties", []):
        relationships.append({
            "type": "category_property",
            "category_key": entity_key,
            "property_key": prop_key,
            "is_required": True,
        })

    # Extract optional property relationships
    for prop_key in content.get("optional_properties", []):
        relationships.append({
            "type": "category_property",
            "category_key": entity_key,
            "property_key": prop_key,
            "is_required": False,
        })

    return category, relationships
```

### Pattern 4: Two-Phase Entity Resolution

**What:** First pass parses all entities to build key-to-UUID lookup. Second pass resolves relationships using the lookup.

**When to use:** When creating relationship table rows that need UUID foreign keys.

**Example:**
```python
# Source: Standard pattern for handling forward references in ingest pipelines
async def resolve_relationships(
    session: AsyncSession,
    pending_relationships: list[dict],
) -> tuple[list, list[str]]:
    """Resolve entity keys to UUIDs and create relationship objects.

    Args:
        session: Database session (after entities flushed)
        pending_relationships: List of relationship dicts with entity_key references

    Returns:
        (list of relationship model instances, list of warning messages)
    """
    # Build lookup tables
    categories = {c.entity_key: c.id for c in await get_all_categories(session)}
    properties = {p.entity_key: p.id for p in await get_all_properties(session)}
    # ... etc

    resolved = []
    warnings = []

    for rel in pending_relationships:
        if rel["type"] == "category_parent":
            cat_id = categories.get(rel["category_key"])
            parent_id = categories.get(rel["parent_key"])
            if cat_id and parent_id:
                resolved.append(CategoryParent(
                    category_id=cat_id,
                    parent_id=parent_id,
                ))
            else:
                warnings.append(
                    f"Unresolved parent: {rel['category_key']} -> {rel['parent_key']}"
                )
        # ... handle other relationship types

    return resolved, warnings
```

### Pattern 5: Materialized View Refresh After Data Load

**What:** Refresh the `category_property_effective` materialized view after all entity and relationship data is loaded.

**When to use:** After successful transaction commit, as a separate operation.

**Example:**
```python
# Source: PostgreSQL documentation + v2.0 materialized view pattern
from sqlalchemy import text
from app.models.v2 import refresh_category_property_effective

async def finalize_ingest(session: AsyncSession) -> None:
    """Refresh materialized views after successful ingest."""
    # Use CONCURRENTLY to avoid blocking reads
    await session.execute(
        text("REFRESH MATERIALIZED VIEW CONCURRENTLY category_property_effective")
    )
    await session.commit()
```

**Important:** The mat view refresh must be in a separate transaction from the main ingest, because `REFRESH CONCURRENTLY` cannot run in a transaction that has already modified the underlying tables.

### Pattern 6: Draft Staleness Detection

**What:** Mark existing drafts as "stale" when new canonical is ingested.

**When to use:** After successful ingest, before completing the operation.

**Example:**
```python
# Source: CONTEXT.md draft rebase behavior decision
from sqlalchemy import update
from app.models.v2 import Draft, DraftStatus

async def mark_drafts_stale(
    session: AsyncSession,
    old_commit_sha: str,
    new_commit_sha: str,
) -> int:
    """Mark active drafts as stale when canonical changes.

    Args:
        old_commit_sha: Previous canonical commit
        new_commit_sha: New canonical commit

    Returns:
        Number of drafts marked stale
    """
    result = await session.execute(
        update(Draft)
        .where(Draft.base_commit_sha == old_commit_sha)
        .where(Draft.status.in_([DraftStatus.DRAFT, DraftStatus.VALIDATED]))
        .values(rebase_status="stale")
    )
    await session.commit()
    return result.rowcount
```

### Anti-Patterns to Avoid

- **Processing files serially with individual API calls:** Slow and rate-limit-prone. Use Git Trees API to get full file list in one call, then batch file fetches.
- **UPSERT with ON CONFLICT for full replacement:** Adds complexity without benefit when we're replacing everything anyway.
- **Validating inside the database transaction:** Fail-fast before starting transaction; validation errors should never trigger rollback.
- **Refreshing mat view inside main transaction:** PostgreSQL doesn't allow `REFRESH CONCURRENTLY` in a transaction with pending changes.
- **Auto-rebasing drafts during ingest:** Decision was to mark stale and require manual rebase; don't attempt auto-merge.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON Schema validation | Custom validator | `jsonschema` library | Draft 2020-12 compliance, format validation, detailed error paths |
| Webhook signature verification | Custom HMAC | Existing v1.0 `verify_github_signature()` | Already handles timing-safe comparison, dev mode bypass |
| Rate limit handling | Manual retry logic | `tenacity` with existing `GitHubRateLimitError` | Already implemented in v1.0 GitHub client |
| Background task execution | Thread pool | FastAPI `BackgroundTasks` | Already used in v1.0 webhook handler |
| File content decoding | Manual base64 | Existing `get_file_content()` method | Already handles base64 decode + JSON parse |

**Key insight:** The v1.0 codebase already handles the hard parts of GitHub integration (auth, rate limits, webhooks). The v2.0 ingest is primarily about parsing to the new schema and populating relationship tables.

## Common Pitfalls

### Pitfall 1: Foreign Key Constraint Violations During Delete

**What goes wrong:** Deleting entities before their dependent relationship rows causes constraint errors.
**Why it happens:** Relationship tables have FK constraints to entity tables.
**How to avoid:**
- Delete in reverse dependency order: relationships first, then entities
- Use `CASCADE` delete constraints (not recommended - loses control)
- Use the ordered deletion pattern shown above
**Warning signs:** `IntegrityError: update or delete on table "categories" violates foreign key constraint`

### Pitfall 2: Mat View Refresh Blocking in Same Transaction

**What goes wrong:** `REFRESH MATERIALIZED VIEW CONCURRENTLY` fails with "cannot be called in transaction block" error.
**Why it happens:** PostgreSQL doesn't allow CONCURRENTLY inside an explicit transaction.
**How to avoid:**
- Commit the main ingest transaction first
- Run mat view refresh in a separate transaction
- Or use non-concurrent refresh (but this blocks reads)
**Warning signs:** `ERROR: REFRESH MATERIALIZED VIEW CONCURRENTLY cannot be executed from a function`

### Pitfall 3: Unresolved Entity References

**What goes wrong:** Relationship rows reference entities that don't exist (e.g., category references non-existent parent).
**Why it happens:** JSON files have forward references that fail to resolve.
**How to avoid:**
- Collect all entity keys in first pass
- Validate references exist before creating relationship rows
- Log warnings for unresolved references (don't fail ingest)
**Warning signs:** `ForeignKeyViolation: insert or update on table "category_parent" violates foreign key constraint`

### Pitfall 4: Git Tree Truncation

**What goes wrong:** Large repos return truncated tree, missing some files.
**Why it happens:** GitHub API limits tree response size.
**How to avoid:**
- Check `truncated` field in response (existing v1.0 code does this)
- Log warning if truncated
- For very large repos, consider paginated directory listing instead
**Warning signs:** Inconsistent entity counts between runs, missing files in logs

### Pitfall 5: Race Condition Between Concurrent Ingests

**What goes wrong:** Two webhook events arrive close together, both start ingesting, one overwrites the other's partial state.
**Why it happens:** BackgroundTasks run concurrently; no locking.
**How to avoid:**
- Use database lock (advisory lock) to ensure only one ingest at a time
- Or use Redis-based distributed lock
- Or accept eventual consistency (later ingest wins)
**Warning signs:** Partial data in database, inconsistent relationship counts

**Chosen approach:** Per CONTEXT.md, "later ingests overwrite earlier ones" - no locking needed, but log when concurrent ingest detected.

### Pitfall 6: JSON Schema Validation Performance

**What goes wrong:** Validating each file individually is slow for large repos.
**Why it happens:** Schema compilation happens per-validation call.
**How to avoid:**
- Compile validators once at ingest start (see Pattern 2)
- Reuse `Draft202012Validator` instances
- Consider parallel validation with `asyncio.gather()`
**Warning signs:** Ingest takes minutes instead of seconds

## Code Examples

Verified patterns from official sources:

### GitHub Trees API for Full File List

```python
# Source: Existing v1.0 GitHubClient.get_repository_tree()
# File: backend/app/services/github.py (reuse)

# Already handles:
# - Recursive tree fetch with recursive=1
# - Filtering for .json files in entity directories
# - Truncation detection and warning
# - Rate limit handling with tenacity retry

tree_entries = await github_client.get_repository_tree(owner, repo, commit_sha)
# Returns: [{"path": "categories/Person.json", "sha": "...", "type": "blob"}, ...]
```

### Webhook Handler Extension

```python
# Source: Existing v1.0 webhooks.py + CONTEXT.md decisions
# File: backend/app/routers/webhooks.py (extend)

from app.services.ingest_v2 import sync_repository_v2

async def trigger_sync_background_v2(httpx_client: Any) -> None:
    """Background task to sync repository using v2.0 ingest."""
    async with async_session_maker() as session:
        github_client = GitHubClient(httpx_client)
        try:
            result = await sync_repository_v2(
                github_client=github_client,
                session=session,
                owner=settings.GITHUB_REPO_OWNER,
                repo=settings.GITHUB_REPO_NAME,
            )
            logger.info("v2.0 sync complete: %s", result)
        except Exception as e:
            logger.error("v2.0 sync failed: %s", e, exc_info=True)
```

### OntologyVersion Tracking

```python
# Source: v2.0 OntologyVersion model + CONTEXT.md decisions
from datetime import datetime
from app.models.v2 import OntologyVersion, IngestStatus

async def create_ontology_version(
    session: AsyncSession,
    commit_sha: str,
) -> OntologyVersion:
    """Create new ontology version record for ingest tracking."""
    version = OntologyVersion(
        commit_sha=commit_sha,
        ingest_status=IngestStatus.PENDING,
    )
    session.add(version)
    await session.flush()
    return version

async def update_ontology_version(
    session: AsyncSession,
    version: OntologyVersion,
    status: IngestStatus,
    entity_counts: dict | None = None,
    warnings: list | None = None,
    errors: list | None = None,
) -> None:
    """Update ontology version with ingest results."""
    version.ingest_status = status
    version.entity_counts = entity_counts
    version.warnings = warnings
    version.errors = errors
    if status == IngestStatus.COMPLETED:
        version.ingested_at = datetime.utcnow()
    await session.commit()
```

### Loading Schema Files from Repo

```python
# Source: labki-schemas structure analysis
SCHEMA_DIRECTORIES = {
    "categories": "categories/_schema.json",
    "properties": "properties/_schema.json",
    "subobjects": "subobjects/_schema.json",
    "modules": "modules/_schema.json",
    "bundles": "bundles/_schema.json",
    "templates": "templates/_schema.json",
}

async def load_schemas(
    github_client: GitHubClient,
    owner: str,
    repo: str,
    ref: str,
) -> dict[str, dict]:
    """Load all _schema.json files from repo."""
    schemas = {}
    for entity_type, path in SCHEMA_DIRECTORIES.items():
        try:
            content = await github_client.get_file_content(owner, repo, path, ref=ref)
            schemas[entity_type] = content
        except Exception as e:
            # Schema file missing - log warning
            logger.warning("Schema file not found: %s - %s", path, e)
    return schemas
```

## State of the Art

| Old Approach (v1.0) | Current Approach (v2.0) | When Changed | Impact |
|---------------------|-------------------------|--------------|--------|
| Generic `Entity` table with upsert | Separate entity tables with full replacement | v2.0 start | Cleaner schema, simpler queries |
| No JSON Schema validation | Validate against `_schema.json` files | v2.0 start | Early error detection |
| Relationships stored in JSONB | Explicit relationship tables | v2.0 start | Queryable, FK integrity |
| No inheritance precomputation | Materialized view refreshed on ingest | v2.0 start | Fast inheritance queries |
| Sync triggers immediate | BackgroundTasks (unchanged) | v1.0 | Non-blocking webhook response |

**Deprecated/outdated:**
- v1.0 `sync_repository()` in `indexer.py`: Replaced by new `sync_repository_v2()` in `ingest_v2.py`
- v1.0 `Entity` model upserts: Replaced by per-type table inserts
- v1.0 `Module` and `Profile` models: Replaced by v2.0 `Module` and `Bundle` models

## Open Questions

Things that couldn't be fully resolved:

1. **Template directory structure handling**
   - What we know: Templates can be in subdirectories (e.g., `templates/Property/Page.json`)
   - What's unclear: Should entity_key include path separator or use different format?
   - Recommendation: Use `Property/Page` as entity_key (matching the `id` field in JSON); source_path stores full path

2. **Concurrent ingest locking strategy**
   - What we know: CONTEXT.md says "later ingests overwrite earlier ones"
   - What's unclear: Should we actively detect/log concurrent ingests?
   - Recommendation: Add PostgreSQL advisory lock with `NOWAIT`; if lock fails, log warning and skip (let later one win)

3. **Validation error handling granularity**
   - What we know: ING-07 requires storing warnings/errors in ontology_version
   - What's unclear: Should validation errors block ingest entirely, or just log and continue?
   - Recommendation: Schema validation errors should block (invalid data), reference resolution warnings should log and continue (missing references may be in other modules)

## Sources

### Primary (HIGH confidence)
- [PostgreSQL REFRESH MATERIALIZED VIEW](https://www.postgresql.org/docs/current/sql-refreshmaterializedview.html) - CONCURRENTLY requirements
- [SQLAlchemy 2.0 Transactions](https://docs.sqlalchemy.org/en/20/orm/session_transaction.html) - Async session transaction patterns
- [jsonschema PyPI](https://pypi.org/project/jsonschema/) - Draft 2020-12 validation
- [FastAPI Background Tasks](https://fastapi.tiangolo.com/tutorial/background-tasks/) - Non-blocking async tasks
- Existing v1.0 code: `backend/app/services/github.py`, `backend/app/routers/webhooks.py`

### Secondary (MEDIUM confidence)
- [jsonschema documentation](https://python-jsonschema.readthedocs.io/en/latest/validate/) - Validator API
- [Better Stack FastAPI Background Tasks](https://betterstack.com/community/guides/scaling-python/background-tasks-in-fastapi/) - Best practices
- [Dynamic Materialized Views in SQLAlchemy](https://bakkenbaeck.com/tech/dynamic-materialized-views-in-sqlalchemy) - Refresh patterns

### Tertiary (LOW confidence)
- [Managing Long-Running Operations in FastAPI](https://leapcell.io/blog/managing-background-tasks-and-long-running-operations-in-fastapi) - Task queue alternatives

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using existing v1.0 patterns, adding only jsonschema
- Architecture: HIGH - Patterns verified with existing codebase and official docs
- Pitfalls: HIGH - Based on PostgreSQL documentation and common patterns
- Validation: MEDIUM - JSON Schema 2020-12 is well-documented but format-specific edge cases may exist
- Concurrency: MEDIUM - Advisory locking approach needs testing under load

**Research date:** 2026-01-23
**Valid until:** 2026-02-23 (30 days - stable domain)

---

## Appendix: labki-schemas Repo Structure

Verified structure from local repo at `/home/daharoni/dev/labki-schemas`:

```
labki-schemas/
├── categories/
│   ├── _schema.json          # JSON Schema Draft 2020-12 for categories
│   ├── Agent.json
│   ├── Person.json
│   └── Organization.json
├── properties/
│   ├── _schema.json          # JSON Schema for properties
│   ├── Has_name.json
│   ├── Has_email.json
│   └── ... (8 property files)
├── subobjects/
│   ├── _schema.json          # JSON Schema for subobjects
│   └── Address.json
├── modules/
│   ├── _schema.json          # JSON Schema for modules
│   └── Core.json
├── bundles/
│   ├── _schema.json          # JSON Schema for bundles
│   └── Default.json
└── templates/
    ├── _schema.json          # JSON Schema for templates
    └── Property/
        └── Page.json         # Nested template (id: "Property/Page")
```

### Entity JSON Formats

**Category** (`categories/Person.json`):
```json
{
  "id": "Person",
  "label": "Person",
  "description": "A human being",
  "parents": ["Agent"],
  "optional_properties": ["Has_email"],
  "optional_subobjects": ["Address"]
}
```

**Property** (`properties/Has_name.json`):
```json
{
  "id": "Has_name",
  "label": "Name",
  "description": "The name of an entity",
  "datatype": "Text",
  "cardinality": "single"
}
```

**Module** (`modules/Core.json`):
```json
{
  "id": "Core",
  "version": "1.0.0",
  "label": "Core Module",
  "description": "Essential entities for any wiki",
  "categories": ["Agent", "Person", "Organization"],
  "properties": ["Has_name", "Has_description", ...],
  "subobjects": ["Address"]
}
```

**Bundle** (`bundles/Default.json`):
```json
{
  "id": "Default",
  "version": "1.0.0",
  "label": "Default Bundle",
  "description": "Standard bundle with core entities",
  "modules": ["Core"]
}
```

**Template** (`templates/Property/Page.json`):
```json
{
  "id": "Property/Page",
  "label": "Page Link Template",
  "description": "Renders page references as clickable wiki links",
  "wikitext": "<includeonly>{{#if:{{{value|}}}|...}}</includeonly>"
}
```

### Relationship Extraction Summary

| Entity Type | Relationship Fields | Target Table |
|-------------|---------------------|--------------|
| Category | `parents[]` | `category_parent` |
| Category | `required_properties[]` | `category_property` (is_required=true) |
| Category | `optional_properties[]` | `category_property` (is_required=false) |
| Module | `categories[]`, `properties[]`, `subobjects[]`, `templates[]` | `module_entity` |
| Bundle | `modules[]` | `bundle_module` |
