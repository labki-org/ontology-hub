# Phase 32: Integration Testing - Research

**Researched:** 2026-01-28
**Domain:** Python integration testing with pytest-asyncio for FastAPI/SQLModel
**Confidence:** HIGH

## Summary

This phase focuses on verifying end-to-end functionality for Dashboard and Resource entities. The codebase already has well-established testing patterns using pytest-asyncio with in-memory SQLite, AsyncClient for API testing, and fixtures for database state setup. The research confirms that extending these patterns to cover INTG-03 (PR submission includes dashboard/resource files) and INTG-04 (derivation chain verification) is straightforward.

The existing test infrastructure provides:
- In-memory SQLite database fixtures (`test_engine`, `test_session`, `client`)
- Capability token generation for draft authentication
- Draft CRUD fixtures (`test_draft`, `seeded_category`, `seeded_dashboard`, `seeded_resource`)
- Unit test patterns with mocking (`unittest.mock.AsyncMock`, `MagicMock`, `patch`)
- API integration test patterns with `AsyncClient` and `httpx`

**Primary recommendation:** Extend existing test files with new test classes for PR file structure verification and derivation chain tests, reusing established fixture patterns.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pytest | ^8.0 | Test framework | Configured in pytest.ini with asyncio_mode=auto |
| pytest-asyncio | ^0.24 | Async test support | Used by all existing tests |
| httpx | ^0.27 | Async HTTP client | Provides AsyncClient for FastAPI testing |
| SQLModel | ^0.0.21 | ORM with async session | All models/fixtures use AsyncSession |
| aiosqlite | ^0.20 | SQLite async driver | TEST_DATABASE_URL uses sqlite+aiosqlite |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| unittest.mock | stdlib | Mocking | Unit tests that isolate service logic |
| jsonpatch | ^1.33 | Patch operations | Testing draft UPDATE changes |
| json | stdlib | JSON serialization | PR file content verification |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| In-memory SQLite | PostgreSQL testcontainers | SQLite works for most tests; some features like mat views need skip markers |

**Installation:**
Already installed - no new dependencies needed.

## Architecture Patterns

### Recommended Test Structure
```
backend/tests/
├── conftest.py              # Shared fixtures (test_engine, test_session, client)
├── test_capability.py       # Unit tests for capability tokens
├── test_module_derived.py   # Unit tests for derivation logic
├── test_draft_crud_dashboard_resource.py  # API tests for draft CRUD (extend)
├── test_rate_limiting.py    # Rate limiting tests
└── test_webhook.py          # Webhook tests
```

### Pattern 1: API Integration Test with Draft Fixture
**What:** Test API endpoint with authenticated draft context
**When to use:** Testing draft-scoped operations
**Example:**
```python
# Source: backend/tests/test_draft_crud_dashboard_resource.py
@pytest_asyncio.fixture
async def test_draft(test_session: AsyncSession) -> tuple[Draft, str]:
    """Create a test draft and return (draft, token)."""
    token = generate_capability_token()
    token_hash = hash_token(token)

    draft = Draft(
        capability_hash=token_hash,
        base_commit_sha="abc123",
        status=DraftStatus.DRAFT,
        source=DraftSource.HUB_UI,
        expires_at=datetime.utcnow() + timedelta(days=7),
    )
    test_session.add(draft)
    await test_session.commit()
    await test_session.refresh(draft)

    return draft, token

class TestDashboardCreate:
    @pytest.mark.asyncio
    async def test_create_dashboard_with_valid_pages_succeeds(
        self, client: AsyncClient, test_draft: tuple[Draft, str]
    ):
        draft, token = test_draft
        response = await client.post(
            f"/api/v2/drafts/{token}/changes",
            json={...},
        )
        assert response.status_code == 201
```

### Pattern 2: Unit Test with Service Mocking
**What:** Test service logic in isolation with mocked dependencies
**When to use:** Testing complex business logic without database
**Example:**
```python
# Source: backend/tests/test_module_derived.py
class TestExtractCategoryRefsFromProperties:
    @pytest.mark.asyncio
    async def test_extracts_allows_value_from_category(self):
        from app.services.module_derived import _extract_category_refs_from_properties

        mock_session = AsyncMock()
        mock_property = MagicMock(spec=Property)
        mock_property.canonical_json = {
            "Allows_value_from_category": "Organization",
        }
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_property
        mock_session.execute.return_value = mock_result

        result = await _extract_category_refs_from_properties(
            mock_session, {"Has_manufacturer"}, {}
        )
        assert "Organization" in result
```

### Pattern 3: Seeded Entity Fixtures
**What:** Pre-populate database with test entities
**When to use:** When tests need canonical entities to exist
**Example:**
```python
# Source: backend/tests/test_draft_crud_dashboard_resource.py
@pytest_asyncio.fixture
async def seeded_category(test_session: AsyncSession) -> Category:
    """Create a test category with known properties."""
    prop1 = Property(
        entity_key="Has_manufacturer",
        source_path="properties/Has_manufacturer.json",
        label="Has manufacturer",
        canonical_json={"name": "Has manufacturer", "type": "page"},
    )
    test_session.add(prop1)
    await test_session.commit()

    category = Category(
        entity_key="Equipment",
        source_path="categories/Equipment.json",
        label="Equipment",
        canonical_json={
            "name": "Equipment",
            "required_properties": ["Has_manufacturer"],
        },
    )
    test_session.add(category)
    await test_session.commit()
    await test_session.refresh(category)
    return category
```

### Anti-Patterns to Avoid
- **Testing against real repo:** Use fixtures only, per CONTEXT.md decisions
- **Testing comprehensive E2E:** Happy path only per CONTEXT.md; defer error cases
- **Skipping broken tests:** Fix immediately per CONTEXT.md regression handling
- **Testing mat view logic on SQLite:** Skip or use workarounds (draft-created categories)

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Async test setup | Custom async setup | pytest_asyncio.fixture | Handles loop lifecycle |
| HTTP test client | Manual request building | AsyncClient(transport=ASGITransport) | Handles app lifecycle |
| JSON diff assertions | Manual dict comparison | Direct comparison or jsonpatch | Python dicts compare correctly |
| UUID generation | Custom random | test fixtures with uuid4() | Already used in models |
| Token hashing | Custom hash | hash_token from capability module | Consistent with production |

**Key insight:** The codebase has comprehensive fixture infrastructure. Extend it rather than create parallel patterns.

## Common Pitfalls

### Pitfall 1: SQLite Materialized View Limitations
**What goes wrong:** Tests fail because SQLite doesn't support materialized views
**Why it happens:** category_property_effective is a PostgreSQL materialized view
**How to avoid:** Use draft-created categories (bypass mat view) or skip tests with `@pytest.mark.skip(reason="Requires PostgreSQL")`
**Warning signs:** Tests pass locally but fail on CI, or vice versa

### Pitfall 2: Missing Model Imports in conftest.py
**What goes wrong:** Tables not created, foreign key errors
**Why it happens:** SQLModel.metadata.create_all only creates tables for imported models
**How to avoid:** Verify all models (including Dashboard, Resource) are imported in test_engine fixture
**Warning signs:** IntegrityError or "table not found" errors

### Pitfall 3: Draft Expiry During Test
**What goes wrong:** Draft not found errors in tests
**Why it happens:** Draft expires_at is before datetime.utcnow()
**How to avoid:** Set expires_at to `datetime.utcnow() + timedelta(days=7)` in fixtures
**Warning signs:** Intermittent test failures, "Draft not found" errors

### Pitfall 4: JSON Patch "replace" vs "add"
**What goes wrong:** JsonPatchConflict errors when patching fields that don't exist
**Why it happens:** "replace" requires the field to exist; "add" creates or replaces
**How to avoid:** Use "add" for fields that might not exist (see CLAUDE.md)
**Warning signs:** Patch application failures on UPDATE tests

### Pitfall 5: Forgetting await on Session Operations
**What goes wrong:** Coroutine never awaited warnings, data not persisted
**Why it happens:** AsyncSession methods are coroutines
**How to avoid:** Always await commit(), refresh(), execute()
**Warning signs:** Test passes but data not in database, RuntimeWarning about unawaited coroutine

## Code Examples

Verified patterns from the codebase:

### PR File Building Test Pattern
```python
# Source: Derived from backend/app/services/pr_builder.py
class TestPRBuilderDashboards:
    @pytest.mark.asyncio
    async def test_build_files_includes_dashboard_create(
        self, test_session: AsyncSession, test_draft: tuple[Draft, str]
    ):
        """CREATE dashboard appears in PR files with correct path."""
        from app.services.pr_builder import build_files_from_draft_v2

        draft, token = test_draft

        # Add dashboard CREATE change
        change = DraftChange(
            draft_id=draft.id,
            change_type=ChangeType.CREATE,
            entity_type="dashboard",
            entity_key="New_Dashboard",
            replacement_json={
                "id": "New_Dashboard",
                "pages": [{"name": "", "tabs": []}]
            },
        )
        test_session.add(change)
        await test_session.commit()

        # Build files
        files = await build_files_from_draft_v2(draft.id, test_session)

        # Verify dashboard file included
        dashboard_files = [f for f in files if f["path"].startswith("dashboards/")]
        assert len(dashboard_files) == 1
        assert dashboard_files[0]["path"] == "dashboards/New_Dashboard.json"
        assert "delete" not in dashboard_files[0]
```

### Derivation Chain Test Pattern
```python
# Source: Derived from backend/tests/test_module_derived.py
class TestDerivationChainEndToEnd:
    @pytest.mark.asyncio
    async def test_allowed_values_triggers_category_inclusion(
        self, test_session: AsyncSession
    ):
        """Property with allowed_values.from_category includes resources."""
        from app.services.module_derived import compute_module_derived_entities

        # Setup: Category A with property P1, P1 refs Category B, B has Resource R1
        # ... fixture setup ...

        result = await compute_module_derived_entities(
            test_session, ["CategoryA"], draft_id=None, max_depth=10
        )

        # Verify chain: A -> P1 -> B -> R1
        assert "PropP1" in result["properties"]
        assert "ResourceR1" in result["resources"]
```

### Resource PR File Test Pattern
```python
# Source: Derived from backend/app/services/pr_builder.py
class TestPRBuilderResources:
    @pytest.mark.asyncio
    async def test_build_files_resource_includes_category_path(
        self, test_session: AsyncSession, test_draft: tuple[Draft, str],
        seeded_category: Category
    ):
        """Resource CREATE uses resources/{category}/{entity_key}.json path."""
        from app.services.pr_builder import build_files_from_draft_v2

        draft, token = test_draft

        # Add resource CREATE change
        change = DraftChange(
            draft_id=draft.id,
            change_type=ChangeType.CREATE,
            entity_type="resource",
            entity_key="Equipment/New_Microscope",  # Includes category prefix
            replacement_json={
                "id": "New_Microscope",
                "category": "Equipment",
                "label": "New Microscope",
            },
        )
        test_session.add(change)
        await test_session.commit()

        files = await build_files_from_draft_v2(draft.id, test_session)

        resource_files = [f for f in files if f["path"].startswith("resources/")]
        assert len(resource_files) == 1
        # Note: pr_builder extracts filename from entity_key after last /
        assert resource_files[0]["path"] == "resources/New_Microscope.json"
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| pytest.fixture | pytest_asyncio.fixture | Already in use | All async fixtures use @pytest_asyncio.fixture |
| SQLAlchemy 1.x | SQLModel/SQLAlchemy 2.x | Already in use | Use AsyncSession, select() patterns |
| httpx.Client | httpx.AsyncClient | Already in use | All API tests use async client |

**Deprecated/outdated:**
- None identified in this codebase - patterns are current

## Open Questions

Things that couldn't be fully resolved:

1. **Resource path format in PR builder**
   - What we know: `build_files_from_draft_v2` extracts filename after last `/` from entity_key
   - What's unclear: Should resources be under `resources/{category}/{entity}.json` or `resources/{entity}.json`?
   - Recommendation: Verify current behavior in pr_builder.py - appears to flatten to `resources/{entity}.json` which may need adjustment if hierarchical paths are required
   - **Resolution needed:** Check if ENTITY_DIRS includes resource directory mapping for nested paths

2. **Dashboard/Resource DELETE file format**
   - What we know: DELETE changes produce `{"path": "...", "delete": True}`
   - What's unclear: Does GitHub PR creation API handle file deletions correctly?
   - Recommendation: Test DELETE behavior in integration test

## Sources

### Primary (HIGH confidence)
- `/home/daharoni/dev/ontology-hub/backend/tests/conftest.py` - Fixture patterns
- `/home/daharoni/dev/ontology-hub/backend/tests/test_draft_crud_dashboard_resource.py` - API test patterns
- `/home/daharoni/dev/ontology-hub/backend/tests/test_module_derived.py` - Unit test patterns with mocking
- `/home/daharoni/dev/ontology-hub/backend/app/services/pr_builder.py` - PR file building logic

### Secondary (MEDIUM confidence)
- `/home/daharoni/dev/ontology-hub/backend/pytest.ini` - Test configuration

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Directly from codebase
- Architecture: HIGH - Existing patterns well documented in test files
- Pitfalls: HIGH - Documented in CLAUDE.md and observed in existing tests
- PR Builder gaps: MEDIUM - Code review shows logic but resource path handling unclear

**Research date:** 2026-01-28
**Valid until:** 30 days (stable domain, established patterns)

---

## Appendix: Existing Test Coverage Summary

Current test files and what they cover:

| File | Tests | Entity Types |
|------|-------|--------------|
| test_capability.py | Token generation, hashing, URL building | N/A (utility) |
| test_draft_crud_dashboard_resource.py | Dashboard/Resource CREATE/UPDATE/DELETE | Dashboard, Resource, Category |
| test_module_derived.py | Derivation logic, transitive chains, cycles | Module, Property, Category, Resource |
| test_rate_limiting.py | Rate limit middleware | N/A (middleware) |
| test_webhook.py | GitHub webhook handling | N/A (webhook) |

**Gaps to fill in Phase 32:**
1. PR file structure for dashboard/resource (INTG-03)
2. Full derivation chain E2E verification (INTG-04)
3. All existing tests must pass (regression check)
