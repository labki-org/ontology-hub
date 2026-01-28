"""Tests for PR builder service - file structure verification.

Tests verify:
- Dashboard CREATE/UPDATE/DELETE produce correct file paths
- Resource CREATE/UPDATE/DELETE produce correct file paths
- Correct JSON serialization and content structure
"""

import json
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
        source_path="dashboards/Existing_Dashboard.json",
        label="Existing Dashboard",
        canonical_json={
            "id": "Existing_Dashboard",
            "pages": [
                {"name": "", "tabs": [{"title": "Main"}]},
            ]
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
        source_path="resources/Equipment/Lab_Microscope.json",
        label="Lab Microscope",
        category_key="Equipment",
        canonical_json={
            "id": "Lab_Microscope",
            "category": "Equipment",
            "label": "Lab Microscope",
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
        """Dashboard CREATE produces file at dashboards/{key}.json."""
        change = DraftChange(
            draft_id=test_draft.id,
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

        files = await build_files_from_draft_v2(test_draft.id, test_session)

        assert len(files) == 1
        assert files[0]["path"] == "dashboards/New_Dashboard.json"
        assert "delete" not in files[0]

        # Verify content is valid JSON
        content = json.loads(files[0]["content"])
        assert content["id"] == "New_Dashboard"
        assert "pages" in content

    @pytest.mark.asyncio
    async def test_dashboard_update_applies_patch(
        self, test_session: AsyncSession, test_draft: Draft, seeded_dashboard: Dashboard  # noqa: ARG002
    ):
        """Dashboard UPDATE applies patch to canonical and produces file."""
        change = DraftChange(
            draft_id=test_draft.id,
            change_type=ChangeType.UPDATE,
            entity_type="dashboard",
            entity_key="Existing_Dashboard",
            patch=[
                {"op": "add", "path": "/pages/-", "value": {"name": "NewPage", "tabs": []}}
            ],
        )
        test_session.add(change)
        await test_session.commit()

        files = await build_files_from_draft_v2(test_draft.id, test_session)

        assert len(files) == 1
        assert files[0]["path"] == "dashboards/Existing_Dashboard.json"

        content = json.loads(files[0]["content"])
        # Should have original page plus new page
        assert len(content["pages"]) == 2
        assert content["pages"][1]["name"] == "NewPage"

    @pytest.mark.asyncio
    async def test_dashboard_delete_produces_deletion_marker(
        self, test_session: AsyncSession, test_draft: Draft, seeded_dashboard: Dashboard  # noqa: ARG002
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
        assert files[0]["path"] == "dashboards/Existing_Dashboard.json"
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
        """Resource CREATE produces file at resources/{key}.json (flattened path)."""
        change = DraftChange(
            draft_id=test_draft.id,
            change_type=ChangeType.CREATE,
            entity_type="resource",
            entity_key="Equipment/New_Microscope",  # Hierarchical entity_key
            replacement_json={
                "id": "New_Microscope",
                "category": "Equipment",
                "label": "New Microscope",
            },
        )
        test_session.add(change)
        await test_session.commit()

        files = await build_files_from_draft_v2(test_draft.id, test_session)

        assert len(files) == 1
        # PR builder extracts filename from last segment
        assert files[0]["path"] == "resources/New_Microscope.json"

        content = json.loads(files[0]["content"])
        assert content["id"] == "New_Microscope"
        assert content["category"] == "Equipment"

    @pytest.mark.asyncio
    async def test_resource_update_applies_patch(
        self, test_session: AsyncSession, test_draft: Draft, seeded_resource: Resource  # noqa: ARG002
    ):
        """Resource UPDATE applies patch to canonical and produces file."""
        change = DraftChange(
            draft_id=test_draft.id,
            change_type=ChangeType.UPDATE,
            entity_type="resource",
            entity_key="Equipment/Lab_Microscope",
            patch=[
                {"op": "add", "path": "/Has_serial_number", "value": "SN-12345"}
            ],
        )
        test_session.add(change)
        await test_session.commit()

        files = await build_files_from_draft_v2(test_draft.id, test_session)

        assert len(files) == 1
        assert files[0]["path"] == "resources/Lab_Microscope.json"

        content = json.loads(files[0]["content"])
        assert content["Has_manufacturer"] == "Zeiss"  # Original value preserved
        assert content["Has_serial_number"] == "SN-12345"  # New value added

    @pytest.mark.asyncio
    async def test_resource_delete_produces_deletion_marker(
        self, test_session: AsyncSession, test_draft: Draft, seeded_resource: Resource  # noqa: ARG002
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
        assert files[0]["path"] == "resources/Lab_Microscope.json"
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
            replacement_json={"id": "Dashboard_A", "pages": [{"name": "", "tabs": []}]},
        )
        # Resource CREATE
        change2 = DraftChange(
            draft_id=test_draft.id,
            change_type=ChangeType.CREATE,
            entity_type="resource",
            entity_key="Category/Resource_B",
            replacement_json={"id": "Resource_B", "category": "Category", "label": "B"},
        )
        test_session.add_all([change1, change2])
        await test_session.commit()

        files = await build_files_from_draft_v2(test_draft.id, test_session)

        assert len(files) == 2
        paths = {f["path"] for f in files}
        assert "dashboards/Dashboard_A.json" in paths
        assert "resources/Resource_B.json" in paths
