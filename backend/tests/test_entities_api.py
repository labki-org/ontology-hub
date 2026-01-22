"""Tests for Entity API endpoints.

Tests entity retrieval, listing, and pagination:
- GET /api/v1/entities - Overview of entity types
- GET /api/v1/entities/{type} - List entities with pagination
- GET /api/v1/entities/{type}/{id} - Get single entity
- Soft delete filtering
"""

from datetime import datetime

import pytest
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.entity import Entity, EntityType


pytestmark = pytest.mark.asyncio


class TestEntityRetrieval:
    """Tests for GET /api/v1/entities/{type}/{id}."""

    async def test_get_entity_returns_entity(
        self, client: AsyncClient, test_session: AsyncSession
    ):
        """GET with valid type and ID returns entity."""
        # Create entity in database
        entity = Entity(
            entity_id="Person",
            entity_type=EntityType.CATEGORY,
            label="Person",
            description="A human being",
            schema_definition={"properties": ["name", "age"]},
            commit_sha="abc123",
        )
        test_session.add(entity)
        await test_session.commit()
        await test_session.refresh(entity)

        # Retrieve via API
        response = await client.get("/api/v1/entities/category/Person")
        assert response.status_code == 200

        data = response.json()
        assert data["entity_id"] == "Person"
        assert data["entity_type"] == "category"
        assert data["label"] == "Person"
        assert data["description"] == "A human being"
        assert data["schema_definition"] == {"properties": ["name", "age"]}
        assert data["commit_sha"] == "abc123"
        assert "id" in data
        assert "created_at" in data
        assert "updated_at" in data

    async def test_get_entity_returns_404_for_nonexistent(self, client: AsyncClient):
        """GET with non-existent entity_id returns 404."""
        response = await client.get("/api/v1/entities/category/NonExistent")
        assert response.status_code == 404
        assert response.json()["detail"] == "Entity not found"

    async def test_get_entity_returns_404_for_wrong_type(
        self, client: AsyncClient, test_session: AsyncSession
    ):
        """GET with wrong entity_type returns 404 even if entity_id exists."""
        # Create a category entity
        entity = Entity(
            entity_id="TestEntity",
            entity_type=EntityType.CATEGORY,
            label="Test",
        )
        test_session.add(entity)
        await test_session.commit()

        # Try to get it as a property - should 404
        response = await client.get("/api/v1/entities/property/TestEntity")
        assert response.status_code == 404


class TestEntityListing:
    """Tests for GET /api/v1/entities/{type}."""

    async def test_list_entities_returns_list(
        self, client: AsyncClient, test_session: AsyncSession
    ):
        """GET returns list of entities for the type."""
        # Create multiple entities
        for i in range(3):
            entity = Entity(
                entity_id=f"Entity{i}",
                entity_type=EntityType.PROPERTY,
                label=f"Entity {i}",
            )
            test_session.add(entity)
        await test_session.commit()

        response = await client.get("/api/v1/entities/property")
        assert response.status_code == 200

        data = response.json()
        assert "items" in data
        assert "has_next" in data
        assert "next_cursor" in data
        assert len(data["items"]) == 3
        assert data["has_next"] is False
        assert data["next_cursor"] is None

    async def test_list_entities_returns_empty_for_no_data(self, client: AsyncClient):
        """GET returns empty list when no entities exist."""
        response = await client.get("/api/v1/entities/subobject")
        assert response.status_code == 200

        data = response.json()
        assert data["items"] == []
        assert data["has_next"] is False
        assert data["next_cursor"] is None

    async def test_list_entities_pagination_with_cursor(
        self, client: AsyncClient, test_session: AsyncSession
    ):
        """GET with pagination returns correct pages."""
        # Create 25 entities (more than default limit of 20)
        for i in range(25):
            entity = Entity(
                entity_id=f"Cat{i:02d}",  # Cat00, Cat01, ... Cat24
                entity_type=EntityType.CATEGORY,
                label=f"Category {i}",
            )
            test_session.add(entity)
        await test_session.commit()

        # First page (default limit 20)
        response = await client.get("/api/v1/entities/category")
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 20
        assert data["has_next"] is True
        assert data["next_cursor"] is not None

        # Second page using cursor
        cursor = data["next_cursor"]
        response2 = await client.get(f"/api/v1/entities/category?cursor={cursor}")
        assert response2.status_code == 200
        data2 = response2.json()
        assert len(data2["items"]) == 5  # Remaining 5 entities
        assert data2["has_next"] is False
        assert data2["next_cursor"] is None

        # Verify no overlap between pages
        first_ids = {item["entity_id"] for item in data["items"]}
        second_ids = {item["entity_id"] for item in data2["items"]}
        assert first_ids.isdisjoint(second_ids)

    async def test_list_entities_custom_limit(
        self, client: AsyncClient, test_session: AsyncSession
    ):
        """GET with custom limit returns correct number."""
        for i in range(10):
            entity = Entity(
                entity_id=f"Prop{i}",
                entity_type=EntityType.PROPERTY,
                label=f"Property {i}",
            )
            test_session.add(entity)
        await test_session.commit()

        response = await client.get("/api/v1/entities/property?limit=5")
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 5
        assert data["has_next"] is True

    async def test_list_entities_max_limit_enforced(self, client: AsyncClient):
        """GET with limit > 100 is capped."""
        response = await client.get("/api/v1/entities/category?limit=200")
        # FastAPI validates this - should return 422
        assert response.status_code == 422

    async def test_list_entities_ordered_by_entity_id(
        self, client: AsyncClient, test_session: AsyncSession
    ):
        """GET returns entities ordered by entity_id."""
        # Create in non-alphabetical order
        for name in ["Zebra", "Apple", "Mango"]:
            entity = Entity(
                entity_id=name,
                entity_type=EntityType.CATEGORY,
                label=name,
            )
            test_session.add(entity)
        await test_session.commit()

        response = await client.get("/api/v1/entities/category")
        data = response.json()
        ids = [item["entity_id"] for item in data["items"]]
        assert ids == ["Apple", "Mango", "Zebra"]


class TestEntityTypeFiltering:
    """Tests for entity type filtering."""

    async def test_only_returns_requested_type(
        self, client: AsyncClient, test_session: AsyncSession
    ):
        """GET /entities/{type} only returns that type."""
        # Create entities of different types
        test_session.add(Entity(
            entity_id="Cat1",
            entity_type=EntityType.CATEGORY,
            label="Category 1",
        ))
        test_session.add(Entity(
            entity_id="Prop1",
            entity_type=EntityType.PROPERTY,
            label="Property 1",
        ))
        test_session.add(Entity(
            entity_id="Sub1",
            entity_type=EntityType.SUBOBJECT,
            label="Subobject 1",
        ))
        await test_session.commit()

        # Get categories
        response = await client.get("/api/v1/entities/category")
        data = response.json()
        assert len(data["items"]) == 1
        assert data["items"][0]["entity_id"] == "Cat1"
        assert data["items"][0]["entity_type"] == "category"

        # Get properties
        response = await client.get("/api/v1/entities/property")
        data = response.json()
        assert len(data["items"]) == 1
        assert data["items"][0]["entity_id"] == "Prop1"

        # Get subobjects
        response = await client.get("/api/v1/entities/subobject")
        data = response.json()
        assert len(data["items"]) == 1
        assert data["items"][0]["entity_id"] == "Sub1"


class TestSoftDeleteFiltering:
    """Tests for soft delete exclusion."""

    async def test_get_entity_excludes_soft_deleted(
        self, client: AsyncClient, test_session: AsyncSession
    ):
        """GET single entity returns 404 for soft-deleted entity."""
        entity = Entity(
            entity_id="DeletedEntity",
            entity_type=EntityType.CATEGORY,
            label="Deleted",
            deleted_at=datetime.utcnow(),  # Soft deleted
        )
        test_session.add(entity)
        await test_session.commit()

        response = await client.get("/api/v1/entities/category/DeletedEntity")
        assert response.status_code == 404

    async def test_list_entities_excludes_soft_deleted(
        self, client: AsyncClient, test_session: AsyncSession
    ):
        """GET list excludes soft-deleted entities."""
        # Create active entity
        test_session.add(Entity(
            entity_id="ActiveEntity",
            entity_type=EntityType.CATEGORY,
            label="Active",
        ))
        # Create soft-deleted entity
        test_session.add(Entity(
            entity_id="DeletedEntity",
            entity_type=EntityType.CATEGORY,
            label="Deleted",
            deleted_at=datetime.utcnow(),
        ))
        await test_session.commit()

        response = await client.get("/api/v1/entities/category")
        data = response.json()
        assert len(data["items"]) == 1
        assert data["items"][0]["entity_id"] == "ActiveEntity"


class TestEntityOverview:
    """Tests for GET /api/v1/entities (overview)."""

    async def test_overview_returns_type_counts(
        self, client: AsyncClient, test_session: AsyncSession
    ):
        """GET /entities returns count per type."""
        # Create entities of each type
        for i in range(3):
            test_session.add(Entity(
                entity_id=f"Cat{i}",
                entity_type=EntityType.CATEGORY,
                label=f"Cat {i}",
            ))
        for i in range(5):
            test_session.add(Entity(
                entity_id=f"Prop{i}",
                entity_type=EntityType.PROPERTY,
                label=f"Prop {i}",
            ))
        await test_session.commit()

        response = await client.get("/api/v1/entities/")
        assert response.status_code == 200

        data = response.json()
        assert "types" in data
        assert "total" in data
        assert data["total"] == 8

        type_counts = {t["entity_type"]: t["count"] for t in data["types"]}
        assert type_counts.get("category") == 3
        assert type_counts.get("property") == 5

    async def test_overview_excludes_soft_deleted(
        self, client: AsyncClient, test_session: AsyncSession
    ):
        """GET /entities excludes soft-deleted from counts."""
        test_session.add(Entity(
            entity_id="Active",
            entity_type=EntityType.CATEGORY,
            label="Active",
        ))
        test_session.add(Entity(
            entity_id="Deleted",
            entity_type=EntityType.CATEGORY,
            label="Deleted",
            deleted_at=datetime.utcnow(),
        ))
        await test_session.commit()

        response = await client.get("/api/v1/entities/")
        data = response.json()
        assert data["total"] == 1

    async def test_overview_empty_when_no_entities(self, client: AsyncClient):
        """GET /entities returns empty overview when no entities."""
        response = await client.get("/api/v1/entities/")
        assert response.status_code == 200

        data = response.json()
        assert data["types"] == []
        assert data["total"] == 0


class TestEntitySearch:
    """Tests for GET /api/v1/entities/search."""

    async def test_search_by_label(
        self, client: AsyncClient, test_session: AsyncSession
    ):
        """Search by label finds matching entity."""
        entity = Entity(
            entity_id="Person",
            entity_type=EntityType.CATEGORY,
            label="Person",
            description="A human being",
        )
        test_session.add(entity)
        await test_session.commit()

        response = await client.get("/api/v1/entities/search?q=Person")
        assert response.status_code == 200

        data = response.json()
        assert len(data["items"]) == 1
        assert data["items"][0]["entity_id"] == "Person"
        assert data["items"][0]["label"] == "Person"
        assert data["next_cursor"] is None
        assert data["has_next"] is False

    async def test_search_by_entity_id(
        self, client: AsyncClient, test_session: AsyncSession
    ):
        """Search by entity_id finds matching entity."""
        entity = Entity(
            entity_id="has_name",
            entity_type=EntityType.PROPERTY,
            label="Name",
            description="The name of something",
        )
        test_session.add(entity)
        await test_session.commit()

        response = await client.get("/api/v1/entities/search?q=has_name")
        assert response.status_code == 200

        data = response.json()
        assert len(data["items"]) == 1
        assert data["items"][0]["entity_id"] == "has_name"

    async def test_search_by_description(
        self, client: AsyncClient, test_session: AsyncSession
    ):
        """Search by description finds matching entity."""
        entity = Entity(
            entity_id="Birthday",
            entity_type=EntityType.PROPERTY,
            label="Birthday",
            description="The date someone was born",
        )
        test_session.add(entity)
        await test_session.commit()

        response = await client.get("/api/v1/entities/search?q=born")
        assert response.status_code == 200

        data = response.json()
        assert len(data["items"]) == 1
        assert data["items"][0]["entity_id"] == "Birthday"

    async def test_search_partial_match(
        self, client: AsyncClient, test_session: AsyncSession
    ):
        """Search with partial term finds multiple matches."""
        test_session.add(Entity(
            entity_id="date_of_birth",
            entity_type=EntityType.PROPERTY,
            label="Date of Birth",
        ))
        test_session.add(Entity(
            entity_id="date_created",
            entity_type=EntityType.PROPERTY,
            label="Date Created",
        ))
        test_session.add(Entity(
            entity_id="name",
            entity_type=EntityType.PROPERTY,
            label="Name",
        ))
        await test_session.commit()

        response = await client.get("/api/v1/entities/search?q=date")
        assert response.status_code == 200

        data = response.json()
        assert len(data["items"]) == 2
        entity_ids = {item["entity_id"] for item in data["items"]}
        assert entity_ids == {"date_of_birth", "date_created"}

    async def test_search_case_insensitive(
        self, client: AsyncClient, test_session: AsyncSession
    ):
        """Search is case-insensitive."""
        entity = Entity(
            entity_id="Person",
            entity_type=EntityType.CATEGORY,
            label="Person",
        )
        test_session.add(entity)
        await test_session.commit()

        # Search with lowercase
        response = await client.get("/api/v1/entities/search?q=person")
        assert response.status_code == 200
        assert len(response.json()["items"]) == 1

        # Search with uppercase
        response = await client.get("/api/v1/entities/search?q=PERSON")
        assert response.status_code == 200
        assert len(response.json()["items"]) == 1

    async def test_search_filter_by_type(
        self, client: AsyncClient, test_session: AsyncSession
    ):
        """Search with entity_type filter returns only matching type."""
        test_session.add(Entity(
            entity_id="Person",
            entity_type=EntityType.CATEGORY,
            label="Person",
        ))
        test_session.add(Entity(
            entity_id="has_person",
            entity_type=EntityType.PROPERTY,
            label="Has Person",
        ))
        await test_session.commit()

        # Search without filter - both match
        response = await client.get("/api/v1/entities/search?q=person")
        assert len(response.json()["items"]) == 2

        # Search with type filter - only category
        response = await client.get(
            "/api/v1/entities/search?q=person&entity_type=category"
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 1
        assert data["items"][0]["entity_type"] == "category"

    async def test_search_min_length(self, client: AsyncClient):
        """Search with too short query returns 422."""
        response = await client.get("/api/v1/entities/search?q=a")
        assert response.status_code == 422

    async def test_search_max_length(self, client: AsyncClient):
        """Search with too long query returns 422."""
        long_query = "a" * 101
        response = await client.get(f"/api/v1/entities/search?q={long_query}")
        assert response.status_code == 422

    async def test_search_empty_results(self, client: AsyncClient):
        """Search with no matches returns empty list."""
        response = await client.get("/api/v1/entities/search?q=nonexistent")
        assert response.status_code == 200

        data = response.json()
        assert data["items"] == []
        assert data["has_next"] is False
        assert data["next_cursor"] is None

    async def test_search_excludes_deleted(
        self, client: AsyncClient, test_session: AsyncSession
    ):
        """Search excludes soft-deleted entities."""
        # Active entity
        test_session.add(Entity(
            entity_id="ActivePerson",
            entity_type=EntityType.CATEGORY,
            label="Active Person",
        ))
        # Soft-deleted entity
        test_session.add(Entity(
            entity_id="DeletedPerson",
            entity_type=EntityType.CATEGORY,
            label="Deleted Person",
            deleted_at=datetime.utcnow(),
        ))
        await test_session.commit()

        response = await client.get("/api/v1/entities/search?q=person")
        assert response.status_code == 200

        data = response.json()
        assert len(data["items"]) == 1
        assert data["items"][0]["entity_id"] == "ActivePerson"

    async def test_search_respects_limit(
        self, client: AsyncClient, test_session: AsyncSession
    ):
        """Search respects limit parameter."""
        for i in range(10):
            test_session.add(Entity(
                entity_id=f"test_{i}",
                entity_type=EntityType.PROPERTY,
                label=f"Test {i}",
            ))
        await test_session.commit()

        response = await client.get("/api/v1/entities/search?q=test&limit=5")
        assert response.status_code == 200

        data = response.json()
        assert len(data["items"]) == 5

    async def test_search_ordered_by_label(
        self, client: AsyncClient, test_session: AsyncSession
    ):
        """Search results are ordered by label."""
        test_session.add(Entity(
            entity_id="zebra_test",
            entity_type=EntityType.PROPERTY,
            label="Zebra Test",
        ))
        test_session.add(Entity(
            entity_id="apple_test",
            entity_type=EntityType.PROPERTY,
            label="Apple Test",
        ))
        test_session.add(Entity(
            entity_id="mango_test",
            entity_type=EntityType.PROPERTY,
            label="Mango Test",
        ))
        await test_session.commit()

        response = await client.get("/api/v1/entities/search?q=test")
        assert response.status_code == 200

        data = response.json()
        labels = [item["label"] for item in data["items"]]
        assert labels == ["Apple Test", "Mango Test", "Zebra Test"]
