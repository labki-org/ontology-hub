"""v2.0 ingest service for populating database from labki-ontology repo."""

import logging
import time
from datetime import datetime
from typing import Any

from sqlalchemy import delete, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.v2 import (
    # Entities
    Bundle,
    # Relationships
    BundleDashboard,
    BundleModule,
    Category,
    CategoryParent,
    CategoryProperty,
    CategorySubobject,
    Dashboard,
    # Version tracking
    IngestStatus,
    Module,
    ModuleDashboard,
    ModuleDependency,
    ModuleEntity,
    OntologyVersion,
    Property,
    Resource,
    Subobject,
    SubobjectProperty,
    Template,
    # Mat view refresh
    refresh_category_property_effective,
)
from app.services.github import GitHubClient
from app.services.parsers import EntityParser, ParsedEntities, PendingRelationship
from app.services.parsers.wikitext_parser import (
    parse_module_vocab,
    parse_wikitext,
)
from app.services.validators import SchemaValidator

logger = logging.getLogger(__name__)

# Entity directories and their file types
# "wikitext" = .wikitext files parsed via wikitext_parser
# "vocab.json" = .vocab.json files parsed as JSON with module metadata
# "json" = plain .json files (bundles)
ENTITY_DIRECTORIES: dict[str, str] = {
    "categories": "wikitext",
    "properties": "wikitext",
    "subobjects": "wikitext",
    "modules": "vocab.json",
    "bundles": "json",
    "templates": "wikitext",
    "dashboards": "wikitext",
    "resources": "wikitext",
}


class IngestService:
    """Service for ingesting canonical data from labki-ontology repo."""

    def __init__(
        self,
        github_client: GitHubClient,
        session: AsyncSession,
    ):
        self._github = github_client
        self._session = session
        self._warnings: list[str] = []
        self._errors: list[str] = []

    async def load_entity_files(
        self,
        owner: str,
        repo: str,
        ref: str,
    ) -> dict[str, list[tuple[str, dict]]]:
        """Load all entity files from repo (.wikitext, .vocab.json, .json).

        Wikitext files are parsed into structured dicts via wikitext_parser.
        Module vocab.json files are parsed for module metadata.
        Bundle .json files are loaded as-is.

        Returns:
            {entity_type: [(source_path, content_dict), ...]}
        """
        tree_entries = await self._github.get_repository_tree(owner, repo, ref)

        files: dict[str, list[tuple[str, dict]]] = {key: [] for key in ENTITY_DIRECTORIES}

        for entry in tree_entries:
            path = entry.get("path", "")
            parts = path.split("/")

            if len(parts) < 2:
                continue

            directory = parts[0]
            filename = parts[-1]

            if directory not in files:
                continue

            file_type = ENTITY_DIRECTORIES.get(directory)

            # ── Wikitext entities ──
            if file_type == "wikitext" and filename.endswith(".wikitext"):
                # Allow nested paths for templates, resources, dashboards
                # e.g. templates/Property/Page.wikitext, dashboards/Core_overview/Setup.wikitext
                if len(parts) != 2 and directory not in (
                    "templates",
                    "resources",
                    "dashboards",
                ):
                    continue

                # Derive entity key from path
                entity_key = "/".join(parts[1:]).removesuffix(".wikitext")

                try:
                    raw = await self._github.get_file_content_raw(
                        owner, repo, path, ref=ref
                    )

                    # Dashboards: assemble multi-page structure
                    if directory == "dashboards":
                        # For dashboards, we assemble pages into a single entity later
                        # Store raw wikitext with a special marker for post-processing
                        page_name = entity_key.split("/", 1)[1] if "/" in entity_key else ""
                        dashboard_id = entity_key.split("/")[0]
                        content = {
                            "_dashboard_id": dashboard_id,
                            "_page_name": page_name,
                            "_wikitext": raw,
                        }
                        files[directory].append((path, content))
                        continue

                    # Parse wikitext to structured dict
                    content = parse_wikitext(raw, directory, entity_key)
                    files[directory].append((path, content))
                except Exception as e:
                    self._warnings.append(f"Failed to load {path}: {e}")

            # ── Module vocab.json ──
            elif file_type == "vocab.json" and filename.endswith(".vocab.json"):
                if len(parts) != 2:
                    continue
                try:
                    content = await self._github.get_file_content(
                        owner, repo, path, ref=ref
                    )
                    # Transform vocab.json into module dict format
                    module_dict = parse_module_vocab(content)
                    files[directory].append((path, module_dict))
                except Exception as e:
                    self._warnings.append(f"Failed to load {path}: {e}")

            # ── Bundle JSON ──
            elif file_type == "json" and filename.endswith(".json"):
                if len(parts) != 2:
                    continue
                try:
                    content = await self._github.get_file_content(
                        owner, repo, path, ref=ref
                    )
                    files[directory].append((path, content))
                except Exception as e:
                    self._warnings.append(f"Failed to load {path}: {e}")

        # Post-process dashboards: assemble multi-page structures
        files["dashboards"] = self._assemble_dashboards(files["dashboards"])

        return files

    def _assemble_dashboards(
        self, raw_pages: list[tuple[str, dict]]
    ) -> list[tuple[str, dict]]:
        """Assemble dashboard pages into single dashboard entities.

        Multiple wikitext files (root + subpages) combine into one dashboard dict
        with a 'pages' array matching the old JSON format.
        """
        # Group pages by dashboard ID
        by_dashboard: dict[str, list[tuple[str, dict]]] = {}
        for path, page_data in raw_pages:
            dashboard_id = page_data["_dashboard_id"]
            by_dashboard.setdefault(dashboard_id, []).append((path, page_data))

        result: list[tuple[str, dict]] = []
        for dashboard_id, pages_data in by_dashboard.items():
            pages = []
            source_path = ""
            for path, page_data in pages_data:
                page_name = page_data["_page_name"]
                wikitext = page_data["_wikitext"]
                pages.append({"name": page_name, "wikitext": wikitext.rstrip()})
                if page_name == "":
                    source_path = path  # Use root page path as source

            # Sort: root page first, then subpages alphabetically
            pages.sort(key=lambda p: (p["name"] != "", p["name"]))

            dashboard_dict = {
                "id": dashboard_id,
                "label": dashboard_id.replace("_", " "),
                "description": "",
                "pages": pages,
            }
            result.append((source_path or f"dashboards/{dashboard_id}.wikitext", dashboard_dict))

        return result

    async def delete_all_canonical(self) -> None:
        """Delete all canonical data in correct FK order."""
        # 1. Delete relationships first (they reference entities)
        await self._session.execute(delete(ModuleDependency))
        await self._session.execute(delete(ModuleEntity))
        await self._session.execute(delete(BundleModule))
        await self._session.execute(delete(ModuleDashboard))
        await self._session.execute(delete(BundleDashboard))
        await self._session.execute(delete(SubobjectProperty))
        await self._session.execute(delete(CategorySubobject))
        await self._session.execute(delete(CategoryProperty))
        await self._session.execute(delete(CategoryParent))

        # 2. Delete entities (order doesn't matter after relationships cleared)
        await self._session.execute(delete(Template))
        await self._session.execute(delete(Resource))
        await self._session.execute(delete(Dashboard))
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
        self._session.add_all(parsed.dashboards)
        self._session.add_all(parsed.resources)

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
        subobjects = {
            s.entity_key: s.id
            for s in (await self._session.execute(select(Subobject))).scalars().all()
        }
        modules = {
            m.entity_key: m.id
            for m in (await self._session.execute(select(Module))).scalars().all()
        }
        bundles = {
            b.entity_key: b.id
            for b in (await self._session.execute(select(Bundle))).scalars().all()
        }
        dashboards = {
            d.entity_key: d.id
            for d in (await self._session.execute(select(Dashboard))).scalars().all()
        }

        for rel in pending:
            if rel.type == "category_parent":
                cat_id = categories.get(rel.source_key)
                parent_id = categories.get(rel.target_key)
                if cat_id and parent_id:
                    self._session.add(
                        CategoryParent(
                            category_id=cat_id,
                            parent_id=parent_id,
                        )
                    )
                else:
                    self._warnings.append(
                        f"Unresolved parent: {rel.source_key} -> {rel.target_key}"
                    )

            elif rel.type == "category_property":
                cat_id = categories.get(rel.source_key)
                prop_id = properties.get(rel.target_key)
                if cat_id and prop_id:
                    self._session.add(
                        CategoryProperty(
                            category_id=cat_id,
                            property_id=prop_id,
                            is_required=rel.extra.get("is_required", False),
                        )
                    )
                else:
                    self._warnings.append(
                        f"Unresolved category_property: {rel.source_key} -> {rel.target_key}"
                    )

            elif rel.type == "category_subobject":
                cat_id = categories.get(rel.source_key)
                sub_id = subobjects.get(rel.target_key)
                if cat_id and sub_id:
                    self._session.add(
                        CategorySubobject(
                            category_id=cat_id,
                            subobject_id=sub_id,
                            is_required=rel.extra.get("is_required", False),
                        )
                    )
                else:
                    self._warnings.append(
                        f"Unresolved category_subobject: {rel.source_key} -> {rel.target_key}"
                    )

            elif rel.type == "subobject_property":
                sub_id = subobjects.get(rel.source_key)
                prop_id = properties.get(rel.target_key)
                if sub_id and prop_id:
                    self._session.add(
                        SubobjectProperty(
                            subobject_id=sub_id,
                            property_id=prop_id,
                            is_required=rel.extra.get("is_required", False),
                        )
                    )
                else:
                    self._warnings.append(
                        f"Unresolved subobject_property: {rel.source_key} -> {rel.target_key}"
                    )

            elif rel.type == "module_entity":
                module_id = modules.get(rel.source_key)
                if module_id:
                    # Convert enum to value string for storage
                    entity_type = rel.extra["entity_type"]
                    entity_type_value = (
                        entity_type.value if hasattr(entity_type, "value") else entity_type
                    )
                    self._session.add(
                        ModuleEntity(
                            module_id=module_id,
                            entity_type=entity_type_value,
                            entity_key=rel.target_key,
                        )
                    )
                else:
                    self._warnings.append(f"Unresolved module: {rel.source_key}")

            elif rel.type == "module_dependency":
                module_id = modules.get(rel.source_key)
                dep_id = modules.get(rel.target_key)
                if module_id and dep_id:
                    self._session.add(
                        ModuleDependency(
                            module_id=module_id,
                            dependency_id=dep_id,
                        )
                    )
                else:
                    self._warnings.append(
                        f"Unresolved module_dependency: {rel.source_key} -> {rel.target_key}"
                    )

            elif rel.type == "bundle_module":
                bundle_id = bundles.get(rel.source_key)
                module_id = modules.get(rel.target_key)
                if bundle_id and module_id:
                    self._session.add(
                        BundleModule(
                            bundle_id=bundle_id,
                            module_id=module_id,
                        )
                    )
                else:
                    self._warnings.append(
                        f"Unresolved bundle_module: {rel.source_key} -> {rel.target_key}"
                    )

            elif rel.type == "module_dashboard":
                module_id = modules.get(rel.source_key)
                dashboard_id = dashboards.get(rel.target_key)
                if module_id and dashboard_id:
                    self._session.add(
                        ModuleDashboard(
                            module_id=module_id,
                            dashboard_id=dashboard_id,
                        )
                    )
                else:
                    self._warnings.append(
                        f"Unresolved module_dashboard: {rel.source_key} -> {rel.target_key}"
                    )

            elif rel.type == "bundle_dashboard":
                bundle_id = bundles.get(rel.source_key)
                dashboard_id = dashboards.get(rel.target_key)
                if bundle_id and dashboard_id:
                    self._session.add(
                        BundleDashboard(
                            bundle_id=bundle_id,
                            dashboard_id=dashboard_id,
                        )
                    )
                else:
                    self._warnings.append(
                        f"Unresolved bundle_dashboard: {rel.source_key} -> {rel.target_key}"
                    )

    async def refresh_mat_view(self) -> None:
        """Refresh materialized view in separate transaction."""
        await refresh_category_property_effective(self._session)


async def sync_repository_v2(
    github_client: GitHubClient,
    session: AsyncSession,
    owner: str,
    repo: str,
) -> dict[str, Any]:
    """Perform full v2.0 repository sync from GitHub to database.

    Fetches all entity files, validates against schemas, parses entities,
    atomically replaces all canonical data, and refreshes mat view.

    Args:
        github_client: Configured GitHubClient
        session: SQLModel async session
        owner: Repository owner
        repo: Repository name

    Returns:
        Dict with sync stats: commit_sha, entity_counts, warnings, errors, duration
    """
    start_time = time.time()
    logger.info("Starting v2.0 repository sync for %s/%s", owner, repo)

    service = IngestService(github_client, session)

    # 1. Get latest commit SHA
    commit_sha = await github_client.get_latest_commit_sha(owner, repo)
    logger.info("Syncing to commit %s", commit_sha)

    # 2. Load entity files (wikitext + vocab.json + json)
    entity_files = await service.load_entity_files(owner, repo, commit_sha)
    total_files = sum(len(files) for files in entity_files.values())
    logger.info("Loaded %d entity files", total_files)

    # 3. Validate parsed entities (basic structural checks)
    # Wikitext files are already parsed into structured dicts by the loader.
    # JSON Schema validation is no longer needed since the source format is wikitext.
    validation_errors: list[str] = []
    for entity_type, files_list in entity_files.items():
        for path, content in files_list:
            if not content.get("id"):
                validation_errors.append(f"{path}: missing 'id' field")

    if validation_errors:
        # Log errors and abort - don't ingest invalid data
        for error in validation_errors[:10]:  # Log first 10
            logger.error("Validation error: %s", error)
        if len(validation_errors) > 10:
            logger.error("... and %d more validation errors", len(validation_errors) - 10)

        # Create failed OntologyVersion record
        version = OntologyVersion(
            commit_sha=commit_sha,
            ingest_status=IngestStatus.FAILED,
            errors=validation_errors,
        )
        session.add(version)
        await session.commit()

        return {
            "commit_sha": commit_sha,
            "status": "failed",
            "errors": validation_errors,
            "duration": time.time() - start_time,
        }

    # 5. Parse all entities
    parser = EntityParser()
    parsed = parser.parse_all(entity_files)
    logger.info(
        "Parsed entities: %s",
        parsed.entity_counts(),
    )

    # 6. Atomic replacement within transaction
    async with session.begin():
        # Delete all existing canonical data
        await service.delete_all_canonical()
        logger.info("Deleted existing canonical data")

        # Insert new entities
        await service.insert_entities(parsed)
        logger.info("Inserted entities")

        # Resolve and insert relationships
        await service.resolve_and_insert_relationships(parsed.relationships)
        logger.info("Inserted relationships")

        # Create OntologyVersion record
        version = OntologyVersion(
            commit_sha=commit_sha,
            ingest_status=IngestStatus.COMPLETED,
            entity_counts=parsed.entity_counts(),
            warnings=service._warnings if service._warnings else None,
            ingested_at=datetime.utcnow(),
        )
        session.add(version)

        # Transaction commits on context exit

    # 7. Refresh mat view (must be separate transaction)
    try:
        await service.refresh_mat_view()
        logger.info("Refreshed category_property_effective mat view")
    except Exception as e:
        logger.warning("Mat view refresh failed (non-blocking): %s", e)
        service._warnings.append(f"Mat view refresh failed: {e}")

    duration = time.time() - start_time
    logger.info(
        "v2.0 sync complete in %.2fs: %s, %d warnings",
        duration,
        parsed.entity_counts(),
        len(service._warnings),
    )

    return {
        "commit_sha": commit_sha,
        "status": "completed",
        "entity_counts": parsed.entity_counts(),
        "warnings": service._warnings if service._warnings else None,
        "duration": duration,
    }
