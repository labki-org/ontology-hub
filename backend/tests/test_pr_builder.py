"""Tests for PR builder service - file structure verification.

Tests verify:
- Dashboard CREATE/UPDATE/DELETE produce correct file paths (.wikitext)
- Resource CREATE/UPDATE/DELETE produce correct file paths (.wikitext)
- Correct wikitext serialization and content structure
"""

from datetime import datetime, timedelta

import pytest
import pytest_asyncio
from sqlmodel.ext.asyncio.session import AsyncSession

from app.dependencies.capability import generate_capability_token, hash_token
from app.models.v2 import (
    ChangeType,
    Dashboard,
    Draft,
    DraftChange,
    DraftSource,
    DraftStatus,
    Resource,
)
from app.services.pr_builder import build_files_from_draft_v2

# ============================================================================
# Fixtures
# ============================================================================


@pytest_asyncio.fixture
async def test_draft(test_session: AsyncSession) -> Draft:
    """Create a test draft for PR builder tests."""
    token = generate_capability_token()
    token_hash = hash_token(token)

    draft = Draft(
        capability_hash=token_hash,
        base_commit_sha="abc123def456",
        status=DraftStatus.DRAFT,
        source=DraftSource.HUB_UI,
        expires_at=datetime.utcnow() + timedelta(days=7),
    )
    test_session.add(draft)
    await test_session.commit()
    await test_session.refresh(draft)

    return draft


@pytest_asyncio.fixture
async def seeded_dashboard(test_session: AsyncSession) -> Dashboard:
    """Create a canonical dashboard for UPDATE tests."""
    dashboard = Dashboard(
        entity_key="Existing_Dashboard",
        source_path="dashboards/Existing_Dashboard.wikitext",
        label="Existing Dashboard",
        canonical_json={
            "id": "Existing_Dashboard",
            "label": "Existing Dashboard",
            "description": "",
            "pages": [
                {"name": "", "wikitext": "== Main ==\nContent here"},
            ],
        },
    )
    test_session.add(dashboard)
    await test_session.commit()
    await test_session.refresh(dashboard)
    return dashboard


@pytest_asyncio.fixture
async def seeded_resource(test_session: AsyncSession) -> Resource:
    """Create a canonical resource for UPDATE tests."""
    resource = Resource(
        entity_key="Equipment/Lab_Microscope",
        source_path="resources/Equipment/Lab_Microscope.wikitext",
        label="Lab Microscope",
        category_key="Equipment",
        canonical_json={
            "id": "Equipment/Lab_Microscope",
            "category": "Equipment",
            "label": "Lab Microscope",
            "description": "",
            "Has_manufacturer": "Zeiss",
        },
    )
    test_session.add(resource)
    await test_session.commit()
    await test_session.refresh(resource)
    return resource


# ============================================================================
# Dashboard PR File Tests
# ============================================================================


class TestDashboardPRFiles:
    """Tests for dashboard entity file generation."""

    @pytest.mark.asyncio
    async def test_dashboard_create_produces_correct_path(
        self, test_session: AsyncSession, test_draft: Draft
    ):
        """Dashboard CREATE produces file at dashboards/{key}.wikitext."""
        change = DraftChange(
            draft_id=test_draft.id,
            change_type=ChangeType.CREATE,
            entity_type="dashboard",
            entity_key="New_Dashboard",
            replacement_json={
                "id": "New_Dashboard",
                "label": "New Dashboard",
                "description": "",
                "pages": [{"name": "", "wikitext": "== New ==\nContent"}],
            },
        )
        test_session.add(change)
        await test_session.commit()

        files = await build_files_from_draft_v2(test_draft.id, test_session)

        assert len(files) == 1
        assert files[0]["path"] == "dashboards/New_Dashboard.wikitext"
        assert "delete" not in files[0]
        # Content is wikitext, not JSON
        assert "== New ==" in files[0]["content"]

    @pytest.mark.asyncio
    async def test_dashboard_update_applies_patch(
        self,
        test_session: AsyncSession,
        test_draft: Draft,
        seeded_dashboard: Dashboard,  # noqa: ARG002
    ):
        """Dashboard UPDATE applies patch to canonical and produces wikitext file."""
        change = DraftChange(
            draft_id=test_draft.id,
            change_type=ChangeType.UPDATE,
            entity_type="dashboard",
            entity_key="Existing_Dashboard",
            patch=[
                {
                    "op": "add",
                    "path": "/pages/-",
                    "value": {"name": "NewPage", "wikitext": "== New Page =="},
                }
            ],
        )
        test_session.add(change)
        await test_session.commit()

        files = await build_files_from_draft_v2(test_draft.id, test_session)

        # Root page + subpage
        assert len(files) == 2
        paths = {f["path"] for f in files}
        assert "dashboards/Existing_Dashboard.wikitext" in paths
        assert "dashboards/Existing_Dashboard/NewPage.wikitext" in paths

    @pytest.mark.asyncio
    async def test_dashboard_delete_produces_deletion_marker(
        self,
        test_session: AsyncSession,
        test_draft: Draft,
        seeded_dashboard: Dashboard,  # noqa: ARG002
    ):
        """Dashboard DELETE produces file deletion marker."""
        change = DraftChange(
            draft_id=test_draft.id,
            change_type=ChangeType.DELETE,
            entity_type="dashboard",
            entity_key="Existing_Dashboard",
        )
        test_session.add(change)
        await test_session.commit()

        files = await build_files_from_draft_v2(test_draft.id, test_session)

        assert len(files) == 1
        assert files[0]["path"] == "dashboards/Existing_Dashboard.wikitext"
        assert files[0].get("delete") is True


# ============================================================================
# Resource PR File Tests
# ============================================================================


class TestResourcePRFiles:
    """Tests for resource entity file generation."""

    @pytest.mark.asyncio
    async def test_resource_create_produces_correct_path(
        self, test_session: AsyncSession, test_draft: Draft
    ):
        """Resource CREATE produces file at resources/{key}.wikitext (full path)."""
        change = DraftChange(
            draft_id=test_draft.id,
            change_type=ChangeType.CREATE,
            entity_type="resource",
            entity_key="Equipment/New_Microscope",
            replacement_json={
                "id": "Equipment/New_Microscope",
                "category": "Equipment",
                "label": "New Microscope",
                "description": "",
            },
        )
        test_session.add(change)
        await test_session.commit()

        files = await build_files_from_draft_v2(test_draft.id, test_session)

        assert len(files) == 1
        assert files[0]["path"] == "resources/Equipment/New_Microscope.wikitext"
        # Content is wikitext with OntologySync markers
        assert "<!-- OntologySync Start -->" in files[0]["content"]
        assert "[[Category:Equipment]]" in files[0]["content"]

    @pytest.mark.asyncio
    async def test_resource_update_applies_patch(
        self,
        test_session: AsyncSession,
        test_draft: Draft,
        seeded_resource: Resource,  # noqa: ARG002
    ):
        """Resource UPDATE applies patch to canonical and produces wikitext file."""
        change = DraftChange(
            draft_id=test_draft.id,
            change_type=ChangeType.UPDATE,
            entity_type="resource",
            entity_key="Equipment/Lab_Microscope",
            patch=[{"op": "add", "path": "/Has_serial_number", "value": "SN-12345"}],
        )
        test_session.add(change)
        await test_session.commit()

        files = await build_files_from_draft_v2(test_draft.id, test_session)

        assert len(files) == 1
        assert files[0]["path"] == "resources/Equipment/Lab_Microscope.wikitext"
        content = files[0]["content"]
        assert "Zeiss" in content  # Original value preserved
        assert "SN-12345" in content  # New value added

    @pytest.mark.asyncio
    async def test_resource_delete_produces_deletion_marker(
        self,
        test_session: AsyncSession,
        test_draft: Draft,
        seeded_resource: Resource,  # noqa: ARG002
    ):
        """Resource DELETE produces file deletion marker."""
        change = DraftChange(
            draft_id=test_draft.id,
            change_type=ChangeType.DELETE,
            entity_type="resource",
            entity_key="Equipment/Lab_Microscope",
        )
        test_session.add(change)
        await test_session.commit()

        files = await build_files_from_draft_v2(test_draft.id, test_session)

        assert len(files) == 1
        assert files[0]["path"] == "resources/Equipment/Lab_Microscope.wikitext"
        assert files[0].get("delete") is True


# ============================================================================
# Multiple Changes Test
# ============================================================================


class TestMultipleChanges:
    """Tests for PR builder with multiple changes."""

    @pytest.mark.asyncio
    async def test_mixed_dashboard_resource_changes(
        self, test_session: AsyncSession, test_draft: Draft
    ):
        """Multiple dashboard and resource changes produce correct files."""
        # Dashboard CREATE
        change1 = DraftChange(
            draft_id=test_draft.id,
            change_type=ChangeType.CREATE,
            entity_type="dashboard",
            entity_key="Dashboard_A",
            replacement_json={
                "id": "Dashboard_A",
                "label": "Dashboard A",
                "description": "",
                "pages": [{"name": "", "wikitext": "Content"}],
            },
        )
        # Resource CREATE
        change2 = DraftChange(
            draft_id=test_draft.id,
            change_type=ChangeType.CREATE,
            entity_type="resource",
            entity_key="Category/Resource_B",
            replacement_json={
                "id": "Category/Resource_B",
                "category": "Category",
                "label": "B",
                "description": "",
            },
        )
        test_session.add_all([change1, change2])
        await test_session.commit()

        files = await build_files_from_draft_v2(test_draft.id, test_session)

        assert len(files) == 2
        paths = {f["path"] for f in files}
        assert "dashboards/Dashboard_A.wikitext" in paths
        assert "resources/Category/Resource_B.wikitext" in paths
