"""v2.0 ingest service for populating database from labki-schemas repo."""

import logging
import time
from datetime import datetime
from typing import Any

from sqlalchemy import delete, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.v2 import (
    # Entities
    Bundle,
    Category,
    Module,
    Property,
    Subobject,
    Template,
    # Relationships
    BundleModule,
    CategoryParent,
    CategoryProperty,
    ModuleEntity,
    # Version tracking
    OntologyVersion,
    IngestStatus,
    # Mat view refresh
    refresh_category_property_effective,
)
from app.services.github import GitHubClient
from app.services.parsers import EntityParser, ParsedEntities, PendingRelationship
from app.services.validators import SchemaValidator

logger = logging.getLogger(__name__)

# Entity directories and their schema file paths
ENTITY_DIRECTORIES = {
    "categories": "categories/_schema.json",
    "properties": "properties/_schema.json",
    "subobjects": "subobjects/_schema.json",
    "modules": "modules/_schema.json",
    "bundles": "bundles/_schema.json",
    "templates": "templates/_schema.json",
}


class IngestService:
    """Service for ingesting canonical data from labki-schemas repo."""

    def __init__(
        self,
        github_client: GitHubClient,
        session: AsyncSession,
    ):
        self._github = github_client
        self._session = session
        self._warnings: list[str] = []
        self._errors: list[str] = []

    async def load_schemas(
        self,
        owner: str,
        repo: str,
        ref: str,
    ) -> dict[str, dict]:
        """Load all _schema.json files from repo."""
        schemas = {}
        for entity_type, path in ENTITY_DIRECTORIES.items():
            try:
                content = await self._github.get_file_content(owner, repo, path, ref=ref)
                schemas[entity_type] = content
            except Exception as e:
                self._warnings.append(f"Schema not found: {path} - {e}")
        return schemas

    async def load_entity_files(
        self,
        owner: str,
        repo: str,
        ref: str,
    ) -> dict[str, list[tuple[str, dict]]]:
        """Load all entity JSON files from repo.

        Returns:
            {entity_type: [(source_path, content), ...]}
        """
        # Get repository tree
        tree_entries = await self._github.get_repository_tree(owner, repo, ref)

        files: dict[str, list[tuple[str, dict]]] = {
            key: [] for key in ENTITY_DIRECTORIES.keys()
        }

        for entry in tree_entries:
            path = entry.get("path", "")
            parts = path.split("/")
            if len(parts) < 2:
                continue

            directory = parts[0]
            filename = parts[-1]

            # Skip _schema.json files
            if filename == "_schema.json":
                continue

            if directory in files:
                try:
                    content = await self._github.get_file_content(owner, repo, path, ref=ref)
                    files[directory].append((path, content))
                except Exception as e:
                    self._warnings.append(f"Failed to load {path}: {e}")

        return files

    async def delete_all_canonical(self) -> None:
        """Delete all canonical data in correct FK order."""
        # 1. Delete relationships first (they reference entities)
        await self._session.execute(delete(ModuleEntity))
        await self._session.execute(delete(BundleModule))
        await self._session.execute(delete(CategoryProperty))
        await self._session.execute(delete(CategoryParent))

        # 2. Delete entities (order doesn't matter after relationships cleared)
        await self._session.execute(delete(Template))
        await self._session.execute(delete(Bundle))
        await self._session.execute(delete(Module))
        await self._session.execute(delete(Subobject))
        await self._session.execute(delete(Property))
        await self._session.execute(delete(Category))

        # 3. Delete previous OntologyVersion (only keep latest)
        await self._session.execute(delete(OntologyVersion))

    async def insert_entities(self, parsed: ParsedEntities) -> None:
        """Insert all parsed entities into database."""
        self._session.add_all(parsed.categories)
        self._session.add_all(parsed.properties)
        self._session.add_all(parsed.subobjects)
        self._session.add_all(parsed.modules)
        self._session.add_all(parsed.bundles)
        self._session.add_all(parsed.templates)

        # Flush to generate UUIDs
        await self._session.flush()

    async def resolve_and_insert_relationships(
        self,
        pending: list[PendingRelationship],
    ) -> None:
        """Resolve entity keys to UUIDs and insert relationship rows."""
        # Build lookup tables from freshly inserted entities
        categories = {
            c.entity_key: c.id
            for c in (await self._session.execute(select(Category))).scalars().all()
        }
        properties = {
            p.entity_key: p.id
            for p in (await self._session.execute(select(Property))).scalars().all()
        }
        modules = {
            m.entity_key: m.id
            for m in (await self._session.execute(select(Module))).scalars().all()
        }
        bundles = {
            b.entity_key: b.id
            for b in (await self._session.execute(select(Bundle))).scalars().all()
        }

        for rel in pending:
            if rel.type == "category_parent":
                cat_id = categories.get(rel.source_key)
                parent_id = categories.get(rel.target_key)
                if cat_id and parent_id:
                    self._session.add(CategoryParent(
                        category_id=cat_id,
                        parent_id=parent_id,
                    ))
                else:
                    self._warnings.append(
                        f"Unresolved parent: {rel.source_key} -> {rel.target_key}"
                    )

            elif rel.type == "category_property":
                cat_id = categories.get(rel.source_key)
                prop_id = properties.get(rel.target_key)
                if cat_id and prop_id:
                    self._session.add(CategoryProperty(
                        category_id=cat_id,
                        property_id=prop_id,
                        is_required=rel.extra.get("is_required", False),
                    ))
                else:
                    self._warnings.append(
                        f"Unresolved category_property: {rel.source_key} -> {rel.target_key}"
                    )

            elif rel.type == "module_entity":
                module_id = modules.get(rel.source_key)
                if module_id:
                    self._session.add(ModuleEntity(
                        module_id=module_id,
                        entity_type=rel.extra["entity_type"],
                        entity_key=rel.target_key,
                    ))
                else:
                    self._warnings.append(
                        f"Unresolved module: {rel.source_key}"
                    )

            elif rel.type == "bundle_module":
                bundle_id = bundles.get(rel.source_key)
                module_id = modules.get(rel.target_key)
                if bundle_id and module_id:
                    self._session.add(BundleModule(
                        bundle_id=bundle_id,
                        module_id=module_id,
                    ))
                else:
                    self._warnings.append(
                        f"Unresolved bundle_module: {rel.source_key} -> {rel.target_key}"
                    )

    async def refresh_mat_view(self) -> None:
        """Refresh materialized view in separate transaction."""
        await refresh_category_property_effective(self._session)
