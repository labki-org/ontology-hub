"""Tests for Module and Profile API endpoints.

Tests module and profile retrieval, listing, and search:
- GET /api/v1/modules - List modules with optional search
- GET /api/v1/modules/{id} - Get single module
- GET /api/v1/modules/{id}/entities - Get entities grouped by type
- GET /api/v1/profiles - List profiles with optional search
- GET /api/v1/profiles/{id} - Get single profile
- GET /api/v1/profiles/{id}/modules - Get modules in profile
- Soft delete filtering
"""

from datetime import datetime

import pytest
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.entity import Entity, EntityType
from app.models.module import Module, Profile


pytestmark = pytest.mark.asyncio


class TestModuleList:
    """Tests for GET /api/v1/modules."""

    async def test_list_modules_returns_list(
        self, client: AsyncClient, test_session: AsyncSession
    ):
        """GET returns list of modules ordered by label."""
        # Create modules
        test_session.add(Module(
            module_id="zebra-module",
            label="Zebra Module",
            description="Last alphabetically",
            category_ids=["Cat1"],
        ))
        test_session.add(Module(
            module_id="alpha-module",
            label="Alpha Module",
            description="First alphabetically",
            category_ids=["Cat2", "Cat3"],
        ))
        await test_session.commit()

        response = await client.get("/api/v1/modules")
        assert response.status_code == 200

        data = response.json()
        assert len(data) == 2
        # Should be ordered by label
        assert data[0]["module_id"] == "alpha-module"
        assert data[0]["label"] == "Alpha Module"
        assert data[1]["module_id"] == "zebra-module"

    async def test_list_modules_empty(self, client: AsyncClient):
        """GET returns empty list when no modules exist."""
        response = await client.get("/api/v1/modules")
        assert response.status_code == 200
        assert response.json() == []

    async def test_list_modules_with_search(
        self, client: AsyncClient, test_session: AsyncSession
    ):
        """GET with search param filters by label."""
        test_session.add(Module(
            module_id="core",
            label="Core Module",
            category_ids=[],
        ))
        test_session.add(Module(
            module_id="extended",
            label="Extended Features",
            category_ids=[],
        ))
        await test_session.commit()

        # Search for "core"
        response = await client.get("/api/v1/modules?search=core")
        assert response.status_code == 200

        data = response.json()
        assert len(data) == 1
        assert data[0]["module_id"] == "core"

    async def test_list_modules_search_case_insensitive(
        self, client: AsyncClient, test_session: AsyncSession
    ):
        """Search is case-insensitive."""
        test_session.add(Module(
            module_id="core",
            label="Core Module",
            category_ids=[],
        ))
        await test_session.commit()

        response = await client.get("/api/v1/modules?search=CORE")
        assert response.status_code == 200
        assert len(response.json()) == 1

    async def test_list_modules_search_min_length(self, client: AsyncClient):
        """Search with too short query returns 422."""
        response = await client.get("/api/v1/modules?search=a")
        assert response.status_code == 422

    async def test_list_modules_excludes_deleted(
        self, client: AsyncClient, test_session: AsyncSession
    ):
        """GET excludes soft-deleted modules."""
        test_session.add(Module(
            module_id="active",
            label="Active Module",
            category_ids=[],
        ))
        test_session.add(Module(
            module_id="deleted",
            label="Deleted Module",
            category_ids=[],
            deleted_at=datetime.utcnow(),
        ))
        await test_session.commit()

        response = await client.get("/api/v1/modules")
        assert response.status_code == 200

        data = response.json()
        assert len(data) == 1
        assert data[0]["module_id"] == "active"


class TestModuleGet:
    """Tests for GET /api/v1/modules/{module_id}."""

    async def test_get_module_returns_module(
        self, client: AsyncClient, test_session: AsyncSession
    ):
        """GET with valid module_id returns module."""
        module = Module(
            module_id="core",
            label="Core Module",
            description="The core module",
            category_ids=["Person", "Organization"],
            dependencies=["base"],
            commit_sha="abc123",
        )
        test_session.add(module)
        await test_session.commit()

        response = await client.get("/api/v1/modules/core")
        assert response.status_code == 200

        data = response.json()
        assert data["module_id"] == "core"
        assert data["label"] == "Core Module"
        assert data["description"] == "The core module"
        assert data["category_ids"] == ["Person", "Organization"]
        assert data["dependencies"] == ["base"]
        assert data["commit_sha"] == "abc123"
        assert "id" in data
        assert "created_at" in data
        assert "updated_at" in data

    async def test_get_module_not_found(self, client: AsyncClient):
        """GET with non-existent module_id returns 404."""
        response = await client.get("/api/v1/modules/nonexistent")
        assert response.status_code == 404
        assert response.json()["detail"] == "Module not found"

    async def test_get_module_excludes_deleted(
        self, client: AsyncClient, test_session: AsyncSession
    ):
        """GET returns 404 for soft-deleted module."""
        module = Module(
            module_id="deleted",
            label="Deleted Module",
            category_ids=[],
            deleted_at=datetime.utcnow(),
        )
        test_session.add(module)
        await test_session.commit()

        response = await client.get("/api/v1/modules/deleted")
        assert response.status_code == 404


class TestModuleEntities:
    """Tests for GET /api/v1/modules/{module_id}/entities."""

    async def test_get_module_entities_returns_grouped(
        self, client: AsyncClient, test_session: AsyncSession
    ):
        """GET returns entities grouped by type."""
        # Create entities
        test_session.add(Entity(
            entity_id="Person",
            entity_type=EntityType.CATEGORY,
            label="Person",
            schema_definition={"properties": ["has_name"], "subobjects": ["Address"]},
        ))
        test_session.add(Entity(
            entity_id="has_name",
            entity_type=EntityType.PROPERTY,
            label="Has Name",
        ))
        test_session.add(Entity(
            entity_id="Address",
            entity_type=EntityType.SUBOBJECT,
            label="Address",
        ))
        # Create module
        test_session.add(Module(
            module_id="core",
            label="Core Module",
            category_ids=["Person"],
        ))
        await test_session.commit()

        response = await client.get("/api/v1/modules/core/entities")
        assert response.status_code == 200

        data = response.json()
        assert "categories" in data
        assert "properties" in data
        assert "subobjects" in data

        assert len(data["categories"]) == 1
        assert data["categories"][0]["entity_id"] == "Person"

        assert len(data["properties"]) == 1
        assert data["properties"][0]["entity_id"] == "has_name"

        assert len(data["subobjects"]) == 1
        assert data["subobjects"][0]["entity_id"] == "Address"

    async def test_get_module_entities_multiple_categories(
        self, client: AsyncClient, test_session: AsyncSession
    ):
        """GET aggregates entities from multiple categories."""
        # Create entities
        test_session.add(Entity(
            entity_id="Person",
            entity_type=EntityType.CATEGORY,
            label="Person",
            schema_definition={"properties": ["has_name", "has_age"]},
        ))
        test_session.add(Entity(
            entity_id="Organization",
            entity_type=EntityType.CATEGORY,
            label="Organization",
            schema_definition={"properties": ["has_name", "has_founded"]},
        ))
        test_session.add(Entity(
            entity_id="has_name",
            entity_type=EntityType.PROPERTY,
            label="Has Name",
        ))
        test_session.add(Entity(
            entity_id="has_age",
            entity_type=EntityType.PROPERTY,
            label="Has Age",
        ))
        test_session.add(Entity(
            entity_id="has_founded",
            entity_type=EntityType.PROPERTY,
            label="Has Founded Date",
        ))
        # Create module with both categories
        test_session.add(Module(
            module_id="core",
            label="Core Module",
            category_ids=["Person", "Organization"],
        ))
        await test_session.commit()

        response = await client.get("/api/v1/modules/core/entities")
        assert response.status_code == 200

        data = response.json()
        assert len(data["categories"]) == 2
        assert len(data["properties"]) == 3  # has_name appears once (deduplicated)

    async def test_get_module_entities_not_found(self, client: AsyncClient):
        """GET returns 404 for non-existent module."""
        response = await client.get("/api/v1/modules/nonexistent/entities")
        assert response.status_code == 404
        assert response.json()["detail"] == "Module not found"

    async def test_get_module_entities_empty(
        self, client: AsyncClient, test_session: AsyncSession
    ):
        """GET returns empty lists for module with no categories."""
        test_session.add(Module(
            module_id="empty",
            label="Empty Module",
            category_ids=[],
        ))
        await test_session.commit()

        response = await client.get("/api/v1/modules/empty/entities")
        assert response.status_code == 200

        data = response.json()
        assert data["categories"] == []
        assert data["properties"] == []
        assert data["subobjects"] == []

    async def test_get_module_entities_excludes_deleted(
        self, client: AsyncClient, test_session: AsyncSession
    ):
        """GET excludes soft-deleted entities."""
        # Create active category
        test_session.add(Entity(
            entity_id="Person",
            entity_type=EntityType.CATEGORY,
            label="Person",
            schema_definition={},
        ))
        # Create soft-deleted category
        test_session.add(Entity(
            entity_id="DeletedCat",
            entity_type=EntityType.CATEGORY,
            label="Deleted Category",
            schema_definition={},
            deleted_at=datetime.utcnow(),
        ))
        # Create module with both
        test_session.add(Module(
            module_id="mixed",
            label="Mixed Module",
            category_ids=["Person", "DeletedCat"],
        ))
        await test_session.commit()

        response = await client.get("/api/v1/modules/mixed/entities")
        assert response.status_code == 200

        data = response.json()
        assert len(data["categories"]) == 1
        assert data["categories"][0]["entity_id"] == "Person"


class TestProfileList:
    """Tests for GET /api/v1/profiles."""

    async def test_list_profiles_returns_list(
        self, client: AsyncClient, test_session: AsyncSession
    ):
        """GET returns list of profiles ordered by label."""
        test_session.add(Profile(
            profile_id="zebra-profile",
            label="Zebra Profile",
            module_ids=["mod1"],
        ))
        test_session.add(Profile(
            profile_id="alpha-profile",
            label="Alpha Profile",
            module_ids=["mod2", "mod3"],
        ))
        await test_session.commit()

        response = await client.get("/api/v1/profiles")
        assert response.status_code == 200

        data = response.json()
        assert len(data) == 2
        # Should be ordered by label
        assert data[0]["profile_id"] == "alpha-profile"
        assert data[1]["profile_id"] == "zebra-profile"

    async def test_list_profiles_empty(self, client: AsyncClient):
        """GET returns empty list when no profiles exist."""
        response = await client.get("/api/v1/profiles")
        assert response.status_code == 200
        assert response.json() == []

    async def test_list_profiles_with_search(
        self, client: AsyncClient, test_session: AsyncSession
    ):
        """GET with search param filters by label."""
        test_session.add(Profile(
            profile_id="standard",
            label="Standard Profile",
            module_ids=[],
        ))
        test_session.add(Profile(
            profile_id="extended",
            label="Extended Profile",
            module_ids=[],
        ))
        await test_session.commit()

        response = await client.get("/api/v1/profiles?search=standard")
        assert response.status_code == 200

        data = response.json()
        assert len(data) == 1
        assert data[0]["profile_id"] == "standard"

    async def test_list_profiles_excludes_deleted(
        self, client: AsyncClient, test_session: AsyncSession
    ):
        """GET excludes soft-deleted profiles."""
        test_session.add(Profile(
            profile_id="active",
            label="Active Profile",
            module_ids=[],
        ))
        test_session.add(Profile(
            profile_id="deleted",
            label="Deleted Profile",
            module_ids=[],
            deleted_at=datetime.utcnow(),
        ))
        await test_session.commit()

        response = await client.get("/api/v1/profiles")
        assert response.status_code == 200

        data = response.json()
        assert len(data) == 1
        assert data[0]["profile_id"] == "active"


class TestProfileGet:
    """Tests for GET /api/v1/profiles/{profile_id}."""

    async def test_get_profile_returns_profile(
        self, client: AsyncClient, test_session: AsyncSession
    ):
        """GET with valid profile_id returns profile."""
        profile = Profile(
            profile_id="standard",
            label="Standard Profile",
            description="The standard profile",
            module_ids=["core", "extended"],
            commit_sha="abc123",
        )
        test_session.add(profile)
        await test_session.commit()

        response = await client.get("/api/v1/profiles/standard")
        assert response.status_code == 200

        data = response.json()
        assert data["profile_id"] == "standard"
        assert data["label"] == "Standard Profile"
        assert data["description"] == "The standard profile"
        assert data["module_ids"] == ["core", "extended"]
        assert data["commit_sha"] == "abc123"
        assert "id" in data
        assert "created_at" in data
        assert "updated_at" in data

    async def test_get_profile_not_found(self, client: AsyncClient):
        """GET with non-existent profile_id returns 404."""
        response = await client.get("/api/v1/profiles/nonexistent")
        assert response.status_code == 404
        assert response.json()["detail"] == "Profile not found"

    async def test_get_profile_excludes_deleted(
        self, client: AsyncClient, test_session: AsyncSession
    ):
        """GET returns 404 for soft-deleted profile."""
        profile = Profile(
            profile_id="deleted",
            label="Deleted Profile",
            module_ids=[],
            deleted_at=datetime.utcnow(),
        )
        test_session.add(profile)
        await test_session.commit()

        response = await client.get("/api/v1/profiles/deleted")
        assert response.status_code == 404


class TestProfileModules:
    """Tests for GET /api/v1/profiles/{profile_id}/modules."""

    async def test_get_profile_modules_returns_modules(
        self, client: AsyncClient, test_session: AsyncSession
    ):
        """GET returns modules in profile."""
        # Create modules
        test_session.add(Module(
            module_id="core",
            label="Core Module",
            category_ids=["Person"],
        ))
        test_session.add(Module(
            module_id="extended",
            label="Extended Module",
            category_ids=["Event"],
        ))
        # Create profile
        test_session.add(Profile(
            profile_id="standard",
            label="Standard Profile",
            module_ids=["core", "extended"],
        ))
        await test_session.commit()

        response = await client.get("/api/v1/profiles/standard/modules")
        assert response.status_code == 200

        data = response.json()
        assert len(data) == 2
        # Should be ordered by label
        module_ids = [m["module_id"] for m in data]
        assert "core" in module_ids
        assert "extended" in module_ids

    async def test_get_profile_modules_not_found(self, client: AsyncClient):
        """GET returns 404 for non-existent profile."""
        response = await client.get("/api/v1/profiles/nonexistent/modules")
        assert response.status_code == 404
        assert response.json()["detail"] == "Profile not found"

    async def test_get_profile_modules_empty(
        self, client: AsyncClient, test_session: AsyncSession
    ):
        """GET returns empty list for profile with no modules."""
        test_session.add(Profile(
            profile_id="empty",
            label="Empty Profile",
            module_ids=[],
        ))
        await test_session.commit()

        response = await client.get("/api/v1/profiles/empty/modules")
        assert response.status_code == 200
        assert response.json() == []

    async def test_get_profile_modules_excludes_deleted(
        self, client: AsyncClient, test_session: AsyncSession
    ):
        """GET excludes soft-deleted modules."""
        # Create modules
        test_session.add(Module(
            module_id="active",
            label="Active Module",
            category_ids=[],
        ))
        test_session.add(Module(
            module_id="deleted",
            label="Deleted Module",
            category_ids=[],
            deleted_at=datetime.utcnow(),
        ))
        # Create profile referencing both
        test_session.add(Profile(
            profile_id="mixed",
            label="Mixed Profile",
            module_ids=["active", "deleted"],
        ))
        await test_session.commit()

        response = await client.get("/api/v1/profiles/mixed/modules")
        assert response.status_code == 200

        data = response.json()
        assert len(data) == 1
        assert data[0]["module_id"] == "active"
