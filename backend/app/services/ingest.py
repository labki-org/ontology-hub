"""v2.0 ingest service for populating database from labki-ontology repo."""

import asyncio
import json
import logging
import shutil
import tempfile
import time
from datetime import datetime
from pathlib import Path
from typing import Any

from sqlalchemy import delete, select
from sqlmodel import col
from sqlmodel.ext.asyncio.session import AsyncSession

from app.config import settings
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
from app.services.parsers import EntityParser, ParsedEntities, PendingRelationship
from app.services.parsers.wikitext_parser import (
    parse_dashboard_annotations,
    parse_wikitext,
)

logger = logging.getLogger(__name__)

# Entity directories and their file types
# "wikitext" = .wikitext files parsed via wikitext_parser
# "json" = plain .json files (modules, bundles)
ENTITY_DIRECTORIES: dict[str, str] = {
    "categories": "wikitext",
    "properties": "wikitext",
    "subobjects": "wikitext",
    "modules": "json",
    "bundles": "json",
    "templates": "wikitext",
    "dashboards": "wikitext",
    "resources": "wikitext",
}


class IngestService:
    """Service for ingesting canonical data from labki-ontology repo."""

    def __init__(
        self,
        session: AsyncSession,
    ):
        self._session = session
        self._warnings: list[str] = []
        self._errors: list[str] = []

    def load_entity_files_from_disk(
        self,
        repo_path: Path,
    ) -> dict[str, list[tuple[str, dict]]]:
        """Load all entity files from a local clone (.wikitext, .json).

        Wikitext files are parsed into structured dicts via wikitext_parser.
        JSON files (modules, bundles) are loaded as-is.

        Returns:
            {entity_type: [(source_path, content_dict), ...]}
        """
        files: dict[str, list[tuple[str, dict]]] = {key: [] for key in ENTITY_DIRECTORIES}

        for directory, file_type in ENTITY_DIRECTORIES.items():
            dir_path = repo_path / directory
            if not dir_path.exists():
                continue

            if file_type == "wikitext":
                for wikitext_path in sorted(dir_path.rglob("*.wikitext")):
                    rel_path = wikitext_path.relative_to(repo_path)
                    parts = rel_path.parts

                    # Skip deeply nested files for non-nested dirs
                    if len(parts) != 2 and directory not in (
                        "templates",
                        "resources",
                        "dashboards",
                    ):
                        continue

                    entity_key = "/".join(parts[1:]).removesuffix(".wikitext")

                    try:
                        raw = wikitext_path.read_text(encoding="utf-8")

                        # Dashboards: assemble multi-page structure
                        if directory == "dashboards":
                            page_name = entity_key.split("/", 1)[1] if "/" in entity_key else ""
                            dashboard_id = entity_key.split("/")[0]
                            content: dict[str, Any] = {
                                "_dashboard_id": dashboard_id,
                                "_page_name": page_name,
                                "_wikitext": raw,
                            }
                            files[directory].append((str(rel_path), content))
                            continue

                        content = parse_wikitext(raw, directory, entity_key)
                        files[directory].append((str(rel_path), content))
                    except Exception as e:
                        self._warnings.append(f"Failed to load {rel_path}: {e}")

            elif file_type == "json":
                for json_path in sorted(dir_path.glob("*.json")):
                    rel_path = json_path.relative_to(repo_path)
                    parts = rel_path.parts

                    if len(parts) != 2:
                        continue

                    try:
                        content = json.loads(json_path.read_text(encoding="utf-8"))
                        files[directory].append((str(rel_path), content))
                    except Exception as e:
                        self._warnings.append(f"Failed to load {rel_path}: {e}")

        # Post-process dashboards: assemble multi-page structures
        files["dashboards"] = self._assemble_dashboards(files["dashboards"])

        return files

    def _assemble_dashboards(self, raw_pages: list[tuple[str, dict]]) -> list[tuple[str, dict]]:
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

            # Extract annotation properties from root page wikitext
            root_page = next((p for p in pages if p["name"] == ""), None)
            annotations = parse_dashboard_annotations(root_page["wikitext"]) if root_page else {}

            dashboard_dict: dict[str, Any] = {
                "id": dashboard_id,
                "label": annotations.pop("_annotation_label", dashboard_id.replace("_", " ")),
                "description": annotations.pop("_annotation_description", ""),
                "categories": ["Dashboard"],
                "pages": pages,
            }
            # Merge dynamic fields from annotations
            dashboard_dict.update(annotations)
            result.append((source_path or f"dashboards/{dashboard_id}.wikitext", dashboard_dict))

        return result

    async def delete_all_canonical(self) -> None:
        """Delete all canonical data in correct FK order."""
        # 1. Delete relationships first (they reference entities)
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


async def clone_repo(owner: str, repo: str, token: str | None, dest: str) -> str:
    """Shallow-clone a GitHub repo into dest. Returns the HEAD commit SHA."""
    if token:
        repo_url = f"https://x-access-token:{token}@github.com/{owner}/{repo}.git"
    else:
        repo_url = f"https://github.com/{owner}/{repo}.git"

    proc = await asyncio.create_subprocess_exec(
        "git",
        "clone",
        "--depth",
        "1",
        repo_url,
        dest,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await proc.communicate()
    if proc.returncode != 0:
        raise RuntimeError(f"git clone failed: {stderr.decode()}")

    proc = await asyncio.create_subprocess_exec(
        "git",
        "-C",
        dest,
        "rev-parse",
        "HEAD",
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, _ = await proc.communicate()
    return stdout.decode().strip()


async def sync_repository_v2(
    session: AsyncSession,
    owner: str,
    repo: str,
    github_token: str | None = None,
) -> dict[str, Any]:
    """Perform full v2.0 repository sync by cloning the repo locally.

    Shallow-clones the repo, reads entity files from disk, parses entities,
    atomically replaces all canonical data, and refreshes mat view.

    Args:
        session: SQLModel async session
        owner: Repository owner
        repo: Repository name
        github_token: GitHub token (required for private repos)

    Returns:
        Dict with sync stats: commit_sha, entity_counts, warnings, errors, duration
    """
    start_time = time.time()
    logger.info("Starting v2.0 repository sync for %s/%s", owner, repo)

    # Mark current version as in-progress so the status endpoint can detect it
    existing_version = (
        await session.execute(
            select(OntologyVersion).order_by(col(OntologyVersion.created_at).desc()).limit(1)
        )
    ).scalar_one_or_none()
    if existing_version:
        existing_version.ingest_status = IngestStatus.IN_PROGRESS
        await session.commit()

    service = IngestService(session)
    tmpdir = tempfile.mkdtemp(prefix="ontology-sync-")

    try:
        # 1. Shallow clone and get commit SHA
        commit_sha = await clone_repo(owner, repo, github_token, tmpdir)
        logger.info("Cloned to %s at commit %s", tmpdir, commit_sha)

        # 2. Load entity files from disk
        entity_files = service.load_entity_files_from_disk(Path(tmpdir))
        total_files = sum(len(files) for files in entity_files.values())
        logger.info("Loaded %d entity files from disk", total_files)

        # Copy media files to persistent storage
        media_dir = Path(tmpdir) / "media"
        media_storage = Path(settings.MEDIA_STORAGE_PATH)
        media_count = 0
        MEDIA_EXTS = {".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"}
        if media_dir.exists():
            media_storage.mkdir(parents=True, exist_ok=True)
            for media_path in sorted(media_dir.iterdir()):
                if media_path.is_file() and (
                    media_path.suffix.lower() in MEDIA_EXTS
                    or media_path.suffix.lower() == ".json"
                ):
                    shutil.copy2(str(media_path), str(media_storage / media_path.name))
                    media_count += 1
            if media_count:
                logger.info("Copied %d media files to %s", media_count, media_storage)

        # 3. Validate parsed entities (basic structural checks)
        validation_errors: list[str] = []
        for _entity_type, files_list in entity_files.items():
            for path, content in files_list:
                if not content.get("id"):
                    validation_errors.append(f"{path}: missing 'id' field")

        if validation_errors:
            for error in validation_errors[:10]:
                logger.error("Validation error: %s", error)
            if len(validation_errors) > 10:
                logger.error("... and %d more validation errors", len(validation_errors) - 10)

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

        # 4. Parse all entities
        parser = EntityParser()
        parsed = parser.parse_all(entity_files)
        logger.info("Parsed entities: %s", parsed.entity_counts())

        # 5. Replace canonical data
        await service.delete_all_canonical()
        logger.info("Deleted existing canonical data")

        await service.insert_entities(parsed)
        logger.info("Inserted entities")

        await service.resolve_and_insert_relationships(parsed.relationships)
        logger.info("Inserted relationships")

        version = OntologyVersion(
            commit_sha=commit_sha,
            ingest_status=IngestStatus.COMPLETED,
            entity_counts=parsed.entity_counts(),
            warnings=service._warnings if service._warnings else None,
            ingested_at=datetime.utcnow(),
        )
        session.add(version)

        await session.commit()

        # 6. Refresh mat view (must be separate transaction)
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

    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)
