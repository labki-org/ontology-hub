"""Repository indexing service for syncing entities from GitHub."""

import logging
from datetime import datetime
from typing import Any

from sqlalchemy.dialects.postgresql import insert
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.entity import Entity, EntityType
from app.models.module import Module, Profile
from app.services.github import GitHubClient

logger = logging.getLogger(__name__)

# Map directory names to entity types
DIRECTORY_TO_TYPE: dict[str, EntityType] = {
    "categories": EntityType.CATEGORY,
    "properties": EntityType.PROPERTY,
    "subobjects": EntityType.SUBOBJECT,
}


class IndexerService:
    """Service for indexing repository entities into database."""

    def __init__(self, github_client: GitHubClient, session: AsyncSession):
        """Initialize indexer with GitHub client and database session.

        Args:
            github_client: Configured GitHubClient for API calls
            session: SQLModel async session for database operations
        """
        self._github = github_client
        self._session = session

    def parse_entity_file(
        self, content: dict[str, Any], entity_type: EntityType
    ) -> dict[str, Any]:
        """Extract entity data from JSON file content.

        Args:
            content: Parsed JSON content from entity file
            entity_type: Type of entity (category, property, subobject)

        Returns:
            Dict with entity_id, label, description, schema_definition
        """
        # Entity files use 'id' for the entity identifier
        entity_id = content.get("id", content.get("@id", ""))

        # Get label from various possible fields
        label = content.get("label", content.get("name", entity_id))

        # Description can be in description or comment
        description = content.get("description", content.get("comment", None))

        return {
            "entity_id": entity_id,
            "entity_type": entity_type,
            "label": label,
            "description": description,
            "schema_definition": content,  # Store full definition
        }

    async def upsert_entity(
        self, entity_data: dict[str, Any], commit_sha: str
    ) -> None:
        """Upsert entity with atomic insert-or-update semantics.

        Uses PostgreSQL ON CONFLICT DO UPDATE on (entity_id, entity_type).

        Args:
            entity_data: Entity fields from parse_entity_file
            commit_sha: Git commit SHA for versioning
        """
        now = datetime.utcnow()

        stmt = insert(Entity).values(
            **entity_data,
            commit_sha=commit_sha,
            created_at=now,
            updated_at=now,
        )

        # On conflict, update all fields except id and created_at
        update_dict = {
            "label": stmt.excluded.label,
            "description": stmt.excluded.description,
            "schema_definition": stmt.excluded.schema_definition,
            "commit_sha": stmt.excluded.commit_sha,
            "updated_at": now,
            "deleted_at": None,  # Un-delete if previously soft-deleted
        }

        stmt = stmt.on_conflict_do_update(
            constraint="uq_entities_entity_id_type",
            set_=update_dict,
        )

        await self._session.execute(stmt)

    def parse_module_file(self, content: dict[str, Any]) -> dict[str, Any]:
        """Extract module data from JSON file content.

        Args:
            content: Parsed JSON content from module file

        Returns:
            Dict with module_id, label, description, category_ids, dependencies
        """
        module_id = content.get("id", content.get("@id", ""))
        label = content.get("label", content.get("name", module_id))
        description = content.get("description", content.get("comment", None))
        category_ids = content.get("categories", content.get("categoryIds", []))
        dependencies = content.get("dependencies", content.get("requires", []))

        return {
            "module_id": module_id,
            "label": label,
            "description": description,
            "category_ids": category_ids,
            "dependencies": dependencies,
        }

    async def upsert_module(
        self, content: dict[str, Any], commit_sha: str
    ) -> None:
        """Parse and upsert a module file.

        Args:
            content: Parsed JSON content from module file
            commit_sha: Git commit SHA for versioning
        """
        module_data = self.parse_module_file(content)
        now = datetime.utcnow()

        stmt = insert(Module).values(
            **module_data,
            commit_sha=commit_sha,
            created_at=now,
            updated_at=now,
        )

        update_dict = {
            "label": stmt.excluded.label,
            "description": stmt.excluded.description,
            "category_ids": stmt.excluded.category_ids,
            "dependencies": stmt.excluded.dependencies,
            "commit_sha": stmt.excluded.commit_sha,
            "updated_at": now,
            "deleted_at": None,
        }

        stmt = stmt.on_conflict_do_update(
            index_elements=["module_id"],
            set_=update_dict,
        )

        await self._session.execute(stmt)

    def parse_profile_file(self, content: dict[str, Any]) -> dict[str, Any]:
        """Extract profile data from JSON file content.

        Args:
            content: Parsed JSON content from profile file

        Returns:
            Dict with profile_id, label, description, module_ids
        """
        profile_id = content.get("id", content.get("@id", ""))
        label = content.get("label", content.get("name", profile_id))
        description = content.get("description", content.get("comment", None))
        module_ids = content.get("modules", content.get("moduleIds", []))

        return {
            "profile_id": profile_id,
            "label": label,
            "description": description,
            "module_ids": module_ids,
        }

    async def upsert_profile(
        self, content: dict[str, Any], commit_sha: str
    ) -> None:
        """Parse and upsert a profile file.

        Args:
            content: Parsed JSON content from profile file
            commit_sha: Git commit SHA for versioning
        """
        profile_data = self.parse_profile_file(content)
        now = datetime.utcnow()

        stmt = insert(Profile).values(
            **profile_data,
            commit_sha=commit_sha,
            created_at=now,
            updated_at=now,
        )

        update_dict = {
            "label": stmt.excluded.label,
            "description": stmt.excluded.description,
            "module_ids": stmt.excluded.module_ids,
            "commit_sha": stmt.excluded.commit_sha,
            "updated_at": now,
            "deleted_at": None,
        }

        stmt = stmt.on_conflict_do_update(
            index_elements=["profile_id"],
            set_=update_dict,
        )

        await self._session.execute(stmt)


async def sync_repository(
    github_client: GitHubClient,
    session: AsyncSession,
    owner: str,
    repo: str,
) -> dict[str, Any]:
    """Perform full repository sync from GitHub to database.

    Fetches all entity, module, and profile JSON files from the repository
    and upserts them into the database within a single transaction.

    Args:
        github_client: Configured GitHubClient
        session: SQLModel async session
        owner: Repository owner
        repo: Repository name

    Returns:
        Dict with sync stats: commit_sha, entities_synced, modules_synced,
        profiles_synced, files_processed, errors
    """
    import time

    start_time = time.time()

    logger.info("Starting repository sync for %s/%s", owner, repo)

    # Get latest commit SHA
    commit_sha = await github_client.get_latest_commit_sha(owner, repo)
    logger.info("Syncing to commit %s", commit_sha)

    # Get repository tree
    tree_entries = await github_client.get_repository_tree(owner, repo, commit_sha)
    logger.info("Found %d JSON files to process", len(tree_entries))

    indexer = IndexerService(github_client, session)

    # Track stats
    stats = {
        "commit_sha": commit_sha,
        "entities_synced": 0,
        "modules_synced": 0,
        "profiles_synced": 0,
        "files_processed": 0,
        "errors": 0,
    }

    # Process files within a transaction
    async with session.begin():
        for entry in tree_entries:
            path = entry.get("path", "")
            directory = path.split("/")[0] if "/" in path else ""

            try:
                # Fetch file content
                content = await github_client.get_file_content(
                    owner, repo, path, ref=commit_sha
                )
                stats["files_processed"] += 1

                # Process based on directory type
                if directory in DIRECTORY_TO_TYPE:
                    entity_type = DIRECTORY_TO_TYPE[directory]
                    entity_data = indexer.parse_entity_file(content, entity_type)
                    await indexer.upsert_entity(entity_data, commit_sha)
                    stats["entities_synced"] += 1
                    logger.debug(
                        "Synced entity %s (%s)",
                        entity_data["entity_id"],
                        entity_type.value,
                    )

                elif directory == "modules":
                    await indexer.upsert_module(content, commit_sha)
                    stats["modules_synced"] += 1
                    logger.debug("Synced module from %s", path)

                elif directory == "profiles":
                    await indexer.upsert_profile(content, commit_sha)
                    stats["profiles_synced"] += 1
                    logger.debug("Synced profile from %s", path)

            except Exception as e:
                stats["errors"] += 1
                logger.warning(
                    "Error processing %s: %s",
                    path,
                    str(e),
                    exc_info=True,
                )
                # Continue processing other files

    duration = time.time() - start_time
    logger.info(
        "Sync complete in %.2fs: %d entities, %d modules, %d profiles, %d errors",
        duration,
        stats["entities_synced"],
        stats["modules_synced"],
        stats["profiles_synced"],
        stats["errors"],
    )

    return stats
