"""PR builder service for v2 draft model.

Converts DraftChange records to repository file format and generates
structured PR bodies with categorized changes and semver suggestions.
"""

import json
from copy import deepcopy
from datetime import datetime
from typing import Any
from uuid import UUID

import jsonpatch
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.v2 import (
    Bundle,
    Category,
    ChangeType,
    DraftChange,
    Module,
    Property,
    Subobject,
    Template,
)

# Type stub for validation report (will be defined in validation_v2.py later)
try:
    from app.schemas.validation_v2 import DraftValidationReportV2
except ImportError:
    # Fallback for when validation_v2.py doesn't exist yet
    from typing import Protocol

    class DraftValidationReportV2(Protocol):
        """Protocol for validation report structure."""

        is_valid: bool
        suggested_semver: str
        errors: list[Any]
        warnings: list[Any]
        semver_reasons: list[str]
        module_suggestions: dict[str, str]
        bundle_suggestions: dict[str, str]


# Entity type to table model mapping
ENTITY_MODELS = {
    "category": Category,
    "property": Property,
    "subobject": Subobject,
    "module": Module,
    "bundle": Bundle,
    "template": Template,
}

# Entity type to repo directory mapping
ENTITY_DIRS = {
    "category": "categories",
    "property": "properties",
    "subobject": "subobjects",
    "module": "modules",
    "bundle": "bundles",
    "template": "templates",
}


async def get_canonical_json(
    session: AsyncSession,
    entity_type: str,
    entity_key: str,
) -> dict | None:
    """Get canonical JSON for an entity."""
    model = ENTITY_MODELS.get(entity_type)
    if not model:
        return None

    result = await session.execute(select(model).where(model.entity_key == entity_key))
    entity = result.scalar_one_or_none()
    if entity and hasattr(entity, "canonical_json"):
        return entity.canonical_json
    return None


def serialize_for_repo(entity_json: dict, _entity_type: str) -> dict:
    """Convert effective entity JSON to repository format.

    Repo format uses "id" instead of "entity_key" for compatibility.
    """
    result = deepcopy(entity_json)

    # Remove internal fields
    for internal_field in ["_change_status", "_deleted", "_patch_error", "entity_key"]:
        result.pop(internal_field, None)

    # Ensure "id" field exists (repo format uses "id", not "entity_key")
    if "id" not in result and "entity_key" in entity_json:
        # Extract just the filename part from entity_key (e.g., "categories/Person" -> "Person")
        entity_key = entity_json.get("entity_key", "")
        if "/" in entity_key:
            result["id"] = entity_key.split("/")[-1]
        else:
            result["id"] = entity_key

    return result


async def build_files_from_draft_v2(
    draft_id: UUID,
    session: AsyncSession,
) -> list[dict]:
    """Build list of files from v2 draft changes for PR creation.

    For each DraftChange:
    - CREATE: File with replacement_json serialized
    - UPDATE: File with effective JSON (canonical + patch applied)
    - DELETE: File deletion marker

    Args:
        draft_id: UUID of the draft
        session: Database session

    Returns:
        List of dicts with "path" and "content" keys (or "delete": True for deletions)
    """
    # Load all draft changes
    query = select(DraftChange).where(DraftChange.draft_id == draft_id)
    result = await session.execute(query)
    changes = list(result.scalars().all())

    files = []

    for change in changes:
        entity_dir = ENTITY_DIRS.get(change.entity_type, change.entity_type)

        # Extract filename from entity_key (e.g., "categories/Person" -> "Person")
        if "/" in change.entity_key:
            filename = change.entity_key.split("/")[-1]
        else:
            filename = change.entity_key

        file_path = f"{entity_dir}/{filename}.json"

        if change.change_type == ChangeType.CREATE:
            # New entity - use replacement_json
            if change.replacement_json:
                repo_json = serialize_for_repo(change.replacement_json, change.entity_type)
                content = json.dumps(repo_json, indent=2) + "\n"
                files.append({"path": file_path, "content": content})

        elif change.change_type == ChangeType.UPDATE:
            # Modified entity - apply patch to canonical
            canonical = await get_canonical_json(session, change.entity_type, change.entity_key)
            if canonical and change.patch:
                try:
                    patch = jsonpatch.JsonPatch(change.patch)
                    effective = patch.apply(deepcopy(canonical))
                    repo_json = serialize_for_repo(effective, change.entity_type)
                    content = json.dumps(repo_json, indent=2) + "\n"
                    files.append({"path": file_path, "content": content})
                except jsonpatch.JsonPatchException:
                    # Patch failed - skip this file (validation should have caught this)
                    pass
            elif canonical:
                # No patch but canonical exists - shouldn't happen, but handle gracefully
                repo_json = serialize_for_repo(canonical, change.entity_type)
                content = json.dumps(repo_json, indent=2) + "\n"
                files.append({"path": file_path, "content": content})

        elif change.change_type == ChangeType.DELETE:
            # Deleted entity - mark for deletion
            files.append({"path": file_path, "delete": True})

    return files


def generate_branch_name(draft_id: str) -> str:
    """Generate branch name for draft PR.

    Args:
        draft_id: Draft UUID as string

    Returns:
        Branch name like "draft-{uuid_prefix}-{timestamp}"
    """
    timestamp = datetime.utcnow().strftime("%Y%m%d-%H%M%S")
    return f"draft-{draft_id[:8]}-{timestamp}"


def generate_commit_message_v2(changes: list[DraftChange]) -> str:
    """Generate commit message from draft changes.

    Args:
        changes: List of DraftChange records

    Returns:
        Commit message with change summary
    """
    # Count by change type
    creates = sum(1 for c in changes if c.change_type == ChangeType.CREATE)
    updates = sum(1 for c in changes if c.change_type == ChangeType.UPDATE)
    deletes = sum(1 for c in changes if c.change_type == ChangeType.DELETE)

    # Build summary
    parts = []
    if creates:
        parts.append(f"{creates} added")
    if updates:
        parts.append(f"{updates} modified")
    if deletes:
        parts.append(f"{deletes} deleted")

    summary = ", ".join(parts) if parts else "no changes"

    return f"feat(schema): update from Ontology Hub\n\nChanges: {summary}\n"


def generate_pr_body_v2(
    changes: list[DraftChange],
    validation: DraftValidationReportV2,
    draft_title: str | None,
    user_comment: str | None,
) -> str:
    """Generate markdown PR body with changes, validation, and semver info.

    Args:
        changes: List of DraftChange records
        validation: Validation report
        draft_title: Optional draft title
        user_comment: Optional user comment to include

    Returns:
        Markdown string for PR body
    """
    sections = []

    # Summary section
    sections.append("## Summary\n")
    if draft_title:
        sections.append(f"**Draft:** {draft_title}\n")

    # User comment (if provided)
    if user_comment:
        sections.append(f"**Comment:** {user_comment}\n")

    # Changes section
    sections.append("## Changes\n")

    # Group changes by entity type
    by_type: dict[str, dict[str, list[str]]] = {}
    for change in changes:
        entity_type = change.entity_type
        if entity_type not in by_type:
            by_type[entity_type] = {"added": [], "modified": [], "deleted": []}

        if change.change_type == ChangeType.CREATE:
            by_type[entity_type]["added"].append(change.entity_key)
        elif change.change_type == ChangeType.UPDATE:
            by_type[entity_type]["modified"].append(change.entity_key)
        elif change.change_type == ChangeType.DELETE:
            by_type[entity_type]["deleted"].append(change.entity_key)

    # Format each entity type
    for entity_type, type_changes in by_type.items():
        if any(type_changes.values()):
            sections.append(f"### {entity_type.capitalize()}s\n")
            if type_changes["added"]:
                sections.append(f"- **Added:** {', '.join(type_changes['added'])}")
            if type_changes["modified"]:
                sections.append(f"- **Modified:** {', '.join(type_changes['modified'])}")
            if type_changes["deleted"]:
                sections.append(f"- **Deleted:** {', '.join(type_changes['deleted'])}")
            sections.append("")

    # Validation section
    sections.append("## Validation\n")
    status = "Passed" if validation.is_valid else "Failed"
    sections.append(f"**Status:** {status}")
    sections.append(f"**Suggested version bump:** `{validation.suggested_semver}`\n")

    # Errors (if any)
    if validation.errors:
        sections.append(f"### Errors ({len(validation.errors)})\n")
        for error in validation.errors:
            sections.append(f"- `{error.entity_key}`: {error.message}")
        sections.append("")

    # Warnings (if any)
    if validation.warnings:
        sections.append(f"### Warnings ({len(validation.warnings)})\n")
        for warning in validation.warnings:
            sections.append(f"- `{warning.entity_key}`: {warning.message}")
        sections.append("")

    # Semver reasons
    if validation.semver_reasons:
        sections.append("### Version bump reasons\n")
        for reason in validation.semver_reasons:
            sections.append(f"- {reason}")
        sections.append("")

    # Module/bundle version suggestions
    if validation.module_suggestions:
        sections.append("### Module version suggestions\n")
        for module_key, suggested in validation.module_suggestions.items():
            sections.append(f"- `{module_key}`: bump to `{suggested}`")
        sections.append("")

    if validation.bundle_suggestions:
        sections.append("### Bundle version suggestions\n")
        for bundle_key, suggested in validation.bundle_suggestions.items():
            sections.append(f"- `{bundle_key}`: bump to `{suggested}`")
        sections.append("")

    # Footer
    sections.append("---")
    sections.append("*Created via [Ontology Hub](https://ontology.labki.org)*")

    return "\n".join(sections)
