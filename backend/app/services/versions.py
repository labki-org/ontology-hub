"""Version diff computation service.

Provides functionality to fetch entity snapshots at specific git refs
and compute field-level diffs between versions.
"""

from typing import Any

from app.services.github import GitHubClient, ENTITY_DIRECTORIES
from app.config import settings


async def get_entities_at_version(
    github_client: GitHubClient,
    ref: str,
) -> dict[str, dict[str, Any]]:
    """Fetch all entities at a specific git ref.

    Args:
        github_client: GitHub API client
        ref: Git ref (tag, branch, or commit SHA)

    Returns:
        Dict mapping "type/entity_id" to entity data
    """
    owner, repo = settings.github_repo.split("/")

    # Get tree at this ref
    tree = await github_client.get_repository_tree(owner, repo, sha=ref)

    entities = {}
    for entry in tree:
        path = entry["path"]
        parts = path.split("/")
        if len(parts) != 2:
            continue
        entity_type, filename = parts
        if entity_type not in ENTITY_DIRECTORIES:
            continue
        if not filename.endswith(".json"):
            continue

        entity_id = filename[:-5]  # Remove .json
        content = await github_client.get_file_at_ref(owner, repo, path, ref)
        entities[f"{entity_type}/{entity_id}"] = content

    return entities


def compute_entity_diff(
    old_entities: dict[str, dict[str, Any]],
    new_entities: dict[str, dict[str, Any]],
) -> dict[str, list[dict[str, Any]]]:
    """Compute diff between two entity snapshots.

    Args:
        old_entities: Entity snapshot at old version
        new_entities: Entity snapshot at new version

    Returns:
        Dict with "added", "modified", "deleted" lists containing change objects:
        - added: [{"key": "...", "entity_type": "...", "entity_id": "...", "new": {...}}]
        - modified: [{"key": "...", "entity_type": "...", "entity_id": "...", "old": {...}, "new": {...}}]
        - deleted: [{"key": "...", "entity_type": "...", "entity_id": "...", "old": {...}}]
    """
    all_keys = set(old_entities.keys()) | set(new_entities.keys())

    added: list[dict[str, Any]] = []
    modified: list[dict[str, Any]] = []
    deleted: list[dict[str, Any]] = []

    for key in all_keys:
        entity_type, entity_id = key.split("/", 1)
        old = old_entities.get(key)
        new = new_entities.get(key)

        if old is None and new is not None:
            added.append({
                "key": key,
                "entity_type": entity_type,
                "entity_id": entity_id,
                "new": new,
            })
        elif old is not None and new is None:
            deleted.append({
                "key": key,
                "entity_type": entity_type,
                "entity_id": entity_id,
                "old": old,
            })
        elif old != new:
            modified.append({
                "key": key,
                "entity_type": entity_type,
                "entity_id": entity_id,
                "old": old,
                "new": new,
            })

    return {"added": added, "modified": modified, "deleted": deleted}
