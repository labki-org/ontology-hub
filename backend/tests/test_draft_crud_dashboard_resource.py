"""Integration tests for dashboard and resource CRUD operations in drafts.

Tests verify:
- Dashboard CREATE/UPDATE/DELETE operations work via draft changes API
- Resource CREATE/UPDATE/DELETE operations work via draft changes API
- Validation rejects invalid dashboards and resources with clear errors
- Draft-created category/resource interactions work correctly

Note: Some resource tests that require the category_property_effective materialized view
are skipped when running on SQLite (test environment). These tests pass on PostgreSQL.
"""

from datetime import datetime, timedelta

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession

from app.dependencies.capability import generate_capability_token, hash_token
from app.models.v2 import (
    Category,
    Dashboard,
    Draft,
    DraftSource,
    DraftStatus,
    Property,
    Resource,
)

# ============================================================================
# Fixtures
# ============================================================================


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


@pytest_asyncio.fixture
async def seeded_category(test_session: AsyncSession) -> Category:
    """Create a test category with known properties.

    Creates category "Equipment" with required_properties: ["Has_manufacturer", "Has_serial_number"]
    and optional_properties: ["Has_location"].
    """
    # First create the properties
    prop1 = Property(
        entity_key="Has_manufacturer",
        source_path="properties/Has_manufacturer.json",
        label="Has manufacturer",
        canonical_json={"name": "Has manufacturer", "type": "page"},
    )
    prop2 = Property(
        entity_key="Has_serial_number",
        source_path="properties/Has_serial_number.json",
        label="Has serial number",
        canonical_json={"name": "Has serial number", "type": "text"},
    )
    prop3 = Property(
        entity_key="Has_location",
        source_path="properties/Has_location.json",
        label="Has location",
        canonical_json={"name": "Has location", "type": "text"},
    )
    test_session.add_all([prop1, prop2, prop3])
    await test_session.commit()

    # Then create the category
    category = Category(
        entity_key="Equipment",
        source_path="categories/Equipment.json",
        label="Equipment",
        description="Test equipment category",
        canonical_json={
            "name": "Equipment",
            "required_properties": ["Has_manufacturer", "Has_serial_number"],
            "optional_properties": ["Has_location"],
        },
    )
    test_session.add(category)
    await test_session.commit()
    await test_session.refresh(category)

    return category


@pytest_asyncio.fixture
async def seeded_dashboard(test_session: AsyncSession) -> Dashboard:
    """Create a test dashboard for UPDATE/DELETE tests."""
    dashboard = Dashboard(
        entity_key="Test_Dashboard",
        source_path="dashboards/Test_Dashboard.json",
        label="Test Dashboard",
        description="A test dashboard",
        canonical_json={
            "pages": [
                {"name": "", "tabs": []},
                {"name": "Settings", "tabs": []},
            ]
        },
    )
    test_session.add(dashboard)
    await test_session.commit()
    await test_session.refresh(dashboard)

    return dashboard


@pytest_asyncio.fixture
async def seeded_resource(test_session: AsyncSession, seeded_category: Category) -> Resource:
    """Create a test resource for UPDATE/DELETE tests."""
    resource = Resource(
        entity_key="Lab_Microscope",
        source_path="resources/Equipment/Lab_Microscope.json",
        label="Lab Microscope",
        description="A test resource",
        category_key="Equipment",
        canonical_json={
            "id": "Lab_Microscope",
            "label": "Lab Microscope",
            "category": "Equipment",
            "Has_manufacturer": "Zeiss",
            "Has_serial_number": "SN12345",
        },
    )
    test_session.add(resource)
    await test_session.commit()
    await test_session.refresh(resource)

    return resource


# ============================================================================
# Dashboard CREATE Tests
# ============================================================================


class TestDashboardCreate:
    """Tests for dashboard CREATE operations."""

    @pytest.mark.asyncio
    async def test_create_dashboard_with_valid_pages_succeeds(
        self, client: AsyncClient, test_draft: tuple[Draft, str]
    ):
        """CREATE dashboard with valid pages returns 201."""
        draft, token = test_draft

        response = await client.post(
            f"/api/v2/drafts/{token}/changes",
            json={
                "change_type": "create",
                "entity_type": "dashboard",
                "entity_key": "New_Dashboard",
                "replacement_json": {
                    "pages": [
                        {"name": "", "tabs": [{"title": "Overview"}]},
                        {"name": "Details", "tabs": []},
                    ]
                },
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["entity_type"] == "dashboard"
        assert data["entity_key"] == "New_Dashboard"
        assert data["change_type"] == "create"
        assert data["replacement_json"]["pages"][0]["name"] == ""

    @pytest.mark.asyncio
    async def test_create_dashboard_without_replacement_json_fails(
        self, client: AsyncClient, test_draft: tuple[Draft, str]
    ):
        """CREATE dashboard without replacement_json returns 400."""
        draft, token = test_draft

        response = await client.post(
            f"/api/v2/drafts/{token}/changes",
            json={
                "change_type": "create",
                "entity_type": "dashboard",
                "entity_key": "Empty_Dashboard",
                "replacement_json": {},
            },
        )

        assert response.status_code == 400
        # Empty {} is treated as falsy, returns "requires replacement_json"
        assert "replacement_json" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_create_dashboard_with_empty_pages_fails(
        self, client: AsyncClient, test_draft: tuple[Draft, str]
    ):
        """CREATE dashboard with empty pages array returns 400."""
        draft, token = test_draft

        response = await client.post(
            f"/api/v2/drafts/{token}/changes",
            json={
                "change_type": "create",
                "entity_type": "dashboard",
                "entity_key": "Empty_Dashboard",
                "replacement_json": {"pages": []},
            },
        )

        assert response.status_code == 400
        assert "must have at least one page" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_create_dashboard_without_root_page_fails(
        self, client: AsyncClient, test_draft: tuple[Draft, str]
    ):
        """CREATE dashboard without root page (name: '') returns 400."""
        draft, token = test_draft

        response = await client.post(
            f"/api/v2/drafts/{token}/changes",
            json={
                "change_type": "create",
                "entity_type": "dashboard",
                "entity_key": "No_Root_Dashboard",
                "replacement_json": {
                    "pages": [
                        {"name": "Settings", "tabs": []},
                        {"name": "Advanced", "tabs": []},
                    ]
                },
            },
        )

        assert response.status_code == 400
        assert "root page" in response.json()["detail"].lower()


# ============================================================================
# Dashboard UPDATE Tests
# ============================================================================


class TestDashboardUpdate:
    """Tests for dashboard UPDATE operations."""

    @pytest.mark.asyncio
    async def test_update_dashboard_patch_pages_succeeds(
        self,
        client: AsyncClient,
        test_draft: tuple[Draft, str],
        seeded_dashboard: Dashboard,  # noqa: ARG002
    ):
        """UPDATE dashboard with valid patch returns success."""
        draft, token = test_draft

        response = await client.post(
            f"/api/v2/drafts/{token}/changes",
            json={
                "change_type": "update",
                "entity_type": "dashboard",
                "entity_key": "Test_Dashboard",
                "patch": [
                    {"op": "add", "path": "/pages/1/tabs/-", "value": {"title": "New Tab"}},
                ],
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["change_type"] == "update"
        assert data["entity_key"] == "Test_Dashboard"
        assert len(data["patch"]) == 1


# ============================================================================
# Dashboard DELETE Tests
# ============================================================================


class TestDashboardDelete:
    """Tests for dashboard DELETE operations."""

    @pytest.mark.asyncio
    async def test_delete_canonical_dashboard_succeeds(
        self,
        client: AsyncClient,
        test_draft: tuple[Draft, str],
        seeded_dashboard: Dashboard,  # noqa: ARG002
    ):
        """DELETE canonical dashboard creates DELETE change."""
        draft, token = test_draft

        response = await client.post(
            f"/api/v2/drafts/{token}/changes",
            json={
                "change_type": "delete",
                "entity_type": "dashboard",
                "entity_key": "Test_Dashboard",
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["change_type"] == "delete"
        assert data["entity_key"] == "Test_Dashboard"

    @pytest.mark.asyncio
    async def test_delete_draft_created_dashboard_removes_change(
        self, client: AsyncClient, test_draft: tuple[Draft, str]
    ):
        """DELETE draft-created dashboard removes the CREATE change entirely."""
        draft, token = test_draft

        # First create a dashboard in the draft
        create_response = await client.post(
            f"/api/v2/drafts/{token}/changes",
            json={
                "change_type": "create",
                "entity_type": "dashboard",
                "entity_key": "Draft_Dashboard",
                "replacement_json": {"pages": [{"name": "", "tabs": []}]},
            },
        )
        assert create_response.status_code == 201

        # Now delete it
        delete_response = await client.post(
            f"/api/v2/drafts/{token}/changes",
            json={
                "change_type": "delete",
                "entity_type": "dashboard",
                "entity_key": "Draft_Dashboard",
            },
        )

        # Should return 201 with delete type (but change is actually removed)
        assert delete_response.status_code == 201
        data = delete_response.json()
        assert data["change_type"] == "delete"

        # Verify via API that the CREATE change no longer exists
        list_response = await client.get(f"/api/v2/drafts/{token}/changes")
        assert list_response.status_code == 200
        changes = list_response.json()["changes"]
        # Filter for Draft_Dashboard changes
        draft_dashboard_changes = [c for c in changes if c["entity_key"] == "Draft_Dashboard"]
        assert len(draft_dashboard_changes) == 0


# ============================================================================
# Resource CREATE Tests
# ============================================================================


class TestResourceCreate:
    """Tests for resource CREATE operations."""

    @pytest.mark.asyncio
    async def test_create_resource_without_category_fails(
        self, client: AsyncClient, test_draft: tuple[Draft, str]
    ):
        """CREATE resource without category returns 400."""
        draft, token = test_draft

        response = await client.post(
            f"/api/v2/drafts/{token}/changes",
            json={
                "change_type": "create",
                "entity_type": "resource",
                "entity_key": "No_Category_Resource",
                "replacement_json": {
                    "id": "No_Category_Resource",
                    "label": "Missing Category",
                },
            },
        )

        assert response.status_code == 400
        assert "category" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_create_resource_with_nonexistent_category_fails(
        self, client: AsyncClient, test_draft: tuple[Draft, str]
    ):
        """CREATE resource with nonexistent category returns 400."""
        draft, token = test_draft

        response = await client.post(
            f"/api/v2/drafts/{token}/changes",
            json={
                "change_type": "create",
                "entity_type": "resource",
                "entity_key": "Bad_Category_Resource",
                "replacement_json": {
                    "id": "Bad_Category_Resource",
                    "label": "Bad Category",
                    "category": "NonExistentCategory",
                },
            },
        )

        assert response.status_code == 400
        assert "does not exist" in response.json()["detail"]


# ============================================================================
# Resource DELETE Tests
# ============================================================================


class TestResourceDelete:
    """Tests for resource DELETE operations."""

    @pytest.mark.asyncio
    async def test_delete_canonical_resource_succeeds(
        self,
        client: AsyncClient,
        test_draft: tuple[Draft, str],
        seeded_resource: Resource,  # noqa: ARG002
    ):
        """DELETE canonical resource creates DELETE change."""
        draft, token = test_draft

        response = await client.post(
            f"/api/v2/drafts/{token}/changes",
            json={
                "change_type": "delete",
                "entity_type": "resource",
                "entity_key": "Lab_Microscope",
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["change_type"] == "delete"
        assert data["entity_key"] == "Lab_Microscope"


# ============================================================================
# Draft-Created Category/Resource Interaction Tests
# ============================================================================


class TestDraftCreatedCategoryResourceInteraction:
    """Tests for resources using draft-created categories.

    These tests validate against draft-created categories which bypass the
    materialized view, so they work on SQLite.
    """

    @pytest.mark.asyncio
    async def test_resource_with_draft_created_category_validates(
        self, client: AsyncClient, test_draft: tuple[Draft, str]
    ):
        """Resource creation validates against draft-created category."""
        draft, token = test_draft

        # First create a category in the draft
        cat_response = await client.post(
            f"/api/v2/drafts/{token}/changes",
            json={
                "change_type": "create",
                "entity_type": "category",
                "entity_key": "DraftCategory",
                "replacement_json": {
                    "name": "Draft Category",
                    "required_properties": ["Has_manufacturer"],
                    "optional_properties": [],
                },
            },
        )
        assert cat_response.status_code == 201

        # Now create a resource using that draft category
        resource_response = await client.post(
            f"/api/v2/drafts/{token}/changes",
            json={
                "change_type": "create",
                "entity_type": "resource",
                "entity_key": "Draft_Resource",
                "replacement_json": {
                    "id": "Draft_Resource",
                    "label": "Draft Resource",
                    "category": "DraftCategory",
                    "Has_manufacturer": "Test Corp",
                },
            },
        )

        assert resource_response.status_code == 201
        data = resource_response.json()
        assert data["entity_key"] == "Draft_Resource"

    @pytest.mark.asyncio
    async def test_resource_with_draft_category_invalid_field_fails(
        self, client: AsyncClient, test_draft: tuple[Draft, str]
    ):
        """Resource with invalid field for draft category returns 400."""
        draft, token = test_draft

        # First create a category in the draft with specific properties
        cat_response = await client.post(
            f"/api/v2/drafts/{token}/changes",
            json={
                "change_type": "create",
                "entity_type": "category",
                "entity_key": "StrictCategory",
                "replacement_json": {
                    "name": "Strict Category",
                    "required_properties": ["Allowed_Property"],
                    "optional_properties": [],
                },
            },
        )
        assert cat_response.status_code == 201

        # Try to create resource with field not in category
        resource_response = await client.post(
            f"/api/v2/drafts/{token}/changes",
            json={
                "change_type": "create",
                "entity_type": "resource",
                "entity_key": "Invalid_Resource",
                "replacement_json": {
                    "id": "Invalid_Resource",
                    "label": "Invalid Resource",
                    "category": "StrictCategory",
                    "Not_Allowed_Property": "Should fail",
                },
            },
        )

        assert resource_response.status_code == 400
        assert "Unknown property" in resource_response.json()["detail"]

    @pytest.mark.asyncio
    async def test_update_draft_created_resource_validates(
        self, client: AsyncClient, test_draft: tuple[Draft, str]
    ):
        """UPDATE on draft-created resource validates field changes."""
        draft, token = test_draft

        # Create category
        await client.post(
            f"/api/v2/drafts/{token}/changes",
            json={
                "change_type": "create",
                "entity_type": "category",
                "entity_key": "UpdateTestCat",
                "replacement_json": {
                    "name": "Update Test Category",
                    "required_properties": ["Valid_Field"],
                    "optional_properties": [],
                },
            },
        )

        # Create resource
        await client.post(
            f"/api/v2/drafts/{token}/changes",
            json={
                "change_type": "create",
                "entity_type": "resource",
                "entity_key": "Updatable_Resource",
                "replacement_json": {
                    "id": "Updatable_Resource",
                    "label": "Updatable Resource",
                    "category": "UpdateTestCat",
                    "Valid_Field": "original",
                },
            },
        )

        # Update with invalid field should fail
        update_response = await client.post(
            f"/api/v2/drafts/{token}/changes",
            json={
                "change_type": "update",
                "entity_type": "resource",
                "entity_key": "Updatable_Resource",
                "patch": [
                    {"op": "add", "path": "/Invalid_Field", "value": "bad"},
                ],
            },
        )

        assert update_response.status_code == 400
        assert "Unknown property" in update_response.json()["detail"]

    @pytest.mark.asyncio
    async def test_delete_draft_created_resource_removes_change(
        self, client: AsyncClient, test_draft: tuple[Draft, str]
    ):
        """DELETE draft-created resource removes the CREATE change entirely."""
        draft, token = test_draft

        # Create category first
        await client.post(
            f"/api/v2/drafts/{token}/changes",
            json={
                "change_type": "create",
                "entity_type": "category",
                "entity_key": "TempCategory",
                "replacement_json": {
                    "name": "Temp Category",
                    "required_properties": [],
                    "optional_properties": [],
                },
            },
        )

        # Create resource
        create_response = await client.post(
            f"/api/v2/drafts/{token}/changes",
            json={
                "change_type": "create",
                "entity_type": "resource",
                "entity_key": "Temp_Resource",
                "replacement_json": {
                    "id": "Temp_Resource",
                    "label": "Temp Resource",
                    "category": "TempCategory",
                },
            },
        )
        assert create_response.status_code == 201

        # Now delete it
        delete_response = await client.post(
            f"/api/v2/drafts/{token}/changes",
            json={
                "change_type": "delete",
                "entity_type": "resource",
                "entity_key": "Temp_Resource",
            },
        )

        assert delete_response.status_code == 201
        assert delete_response.json()["change_type"] == "delete"

        # Verify via API that the CREATE change no longer exists
        list_response = await client.get(f"/api/v2/drafts/{token}/changes")
        assert list_response.status_code == 200
        changes = list_response.json()["changes"]
        resource_changes = [c for c in changes if c["entity_key"] == "Temp_Resource"]
        assert len(resource_changes) == 0
