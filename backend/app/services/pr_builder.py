"""PR builder service for v2 draft model.

Converts DraftChange records to repository file format and generates
structured PR bodies with categorized changes and semver suggestions.
"""

import json
from copy import deepcopy
from datetime import datetime
from uuid import UUID

import jsonpatch
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.v2 import (
    Bundle,
    Category,
    ChangeType,
    Dashboard,
    DraftChange,
    Module,
    Property,
    Resource,
    Subobject,
    Template,
)
from app.services.generators.wikitext_generator import (
    generate_dashboard_page_wikitext,
    generate_dashboard_root_wikitext,
    generate_wikitext,
)

# Entity type to table model mapping
ENTITY_MODELS = {
    "category": Category,
    "property": Property,
    "subobject": Subobject,
    "module": Module,
    "bundle": Bundle,
    "template": Template,
    "dashboard": Dashboard,
    "resource": Resource,
}

# Entity type to repo directory mapping
ENTITY_DIRS = {
    "category": "categories",
    "property": "properties",
    "subobject": "subobjects",
    "module": "modules",
    "bundle": "bundles",
    "template": "templates",
    "dashboard": "dashboards",
    "resource": "resources",
}

# Entity type to file extension mapping
ENTITY_EXTENSIONS = {
    "category": ".wikitext",
    "property": ".wikitext",
    "subobject": ".wikitext",
    "template": ".wikitext",
    "dashboard": ".wikitext",
    "resource": ".wikitext",
    "module": ".json",
    "bundle": ".json",
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

    # All entity models have entity_key
    result = await session.execute(select(model).where(col(model.entity_key) == entity_key))  # type: ignore[attr-defined]
    entity = result.scalar_one_or_none()
    if entity and hasattr(entity, "canonical_json"):
        canonical: dict = entity.canonical_json
        return canonical
    return None


def _clean_entity_json(entity_json: dict) -> dict:
    """Remove internal fields from entity JSON before serialization."""
    result = deepcopy(entity_json)
    for internal_field in ["_change_status", "_deleted", "_patch_error", "entity_key"]:
        result.pop(internal_field, None)

    # Ensure "id" field exists
    if "id" not in result and "entity_key" in entity_json:
        entity_key = entity_json.get("entity_key", "")
        result["id"] = entity_key.split("/")[-1] if "/" in entity_key else entity_key

    return result


def serialize_for_repo(entity_json: dict, entity_type: str) -> str:
    """Convert effective entity JSON to repository file content.

    Generates wikitext for most entity types, vocab.json for modules,
    and plain JSON for bundles.
    """
    cleaned = _clean_entity_json(entity_json)

    # Module -> simple JSON
    if entity_type == "module":
        return json.dumps(cleaned, indent=2) + "\n"

    # Bundle -> plain JSON (unchanged format)
    if entity_type == "bundle":
        return json.dumps(cleaned, indent=2) + "\n"

    # Dashboard -> annotation block + body content for root page
    if entity_type == "dashboard":
        pages = cleaned.get("pages", [])
        root = next((p for p in pages if p.get("name") == ""), None)
        root_wikitext = root["wikitext"] if root else ""
        return generate_dashboard_root_wikitext(cleaned, root_wikitext)

    # Wikitext entity types (category, property, subobject, template, resource)
    return generate_wikitext(cleaned, entity_type)


def _append_dashboard_subpages(
    files: list[dict[str, str | bool]],
    entity_dir: str,
    entity_key: str,
    ext: str,
    entity_json: dict,
) -> None:
    """Append dashboard subpage files for non-root pages."""
    if not entity_json.get("pages"):
        return
    for page in entity_json["pages"]:
        name = page.get("name")
        if name:
            sub_path = f"{entity_dir}/{entity_key}/{name}{ext}"
            sub_content = generate_dashboard_page_wikitext(page.get("wikitext", ""))
            files.append({"path": sub_path, "content": sub_content})


async def build_files_from_draft_v2(
    draft_id: UUID,
    session: AsyncSession,
) -> list[dict[str, str | bool]]:
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

    files: list[dict[str, str | bool]] = []

    for change in changes:
        entity_dir = ENTITY_DIRS.get(change.entity_type, change.entity_type)
        ext = ENTITY_EXTENSIONS.get(change.entity_type, ".wikitext")

        # Build file path using entity_key (preserves nested paths like Property/Page)
        entity_key = change.entity_key
        file_path = f"{entity_dir}/{entity_key}{ext}"

        if change.change_type == ChangeType.CREATE:
            if change.replacement_json:
                content = serialize_for_repo(change.replacement_json, change.entity_type)
                files.append({"path": file_path, "content": content})
                _append_dashboard_subpages(
                    files, entity_dir, entity_key, ext, change.replacement_json
                )

        elif change.change_type == ChangeType.UPDATE:
            canonical = await get_canonical_json(session, change.entity_type, change.entity_key)
            if canonical and change.patch:
                try:
                    patch = jsonpatch.JsonPatch(change.patch)
                    effective = patch.apply(deepcopy(canonical))
                    content = serialize_for_repo(effective, change.entity_type)
                    files.append({"path": file_path, "content": content})
                    _append_dashboard_subpages(files, entity_dir, entity_key, ext, effective)
                except jsonpatch.JsonPatchException:
                    pass
            elif canonical:
                content = serialize_for_repo(canonical, change.entity_type)
                files.append({"path": file_path, "content": content})

        elif change.change_type == ChangeType.DELETE:
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


def generate_pr_title(
    changes: list[DraftChange],
    base_commit_sha: str | None,
    user_title: str | None = None,
) -> str:
    """Generate PR title.

    Format: "[ontology @{sha_prefix}] {summary}"
    Examples:
    - "[ontology @a1b2c3d] Add category: Lab_member"
    - "[ontology @a1b2c3d] 3 additions, 2 updates"

    Args:
        changes: List of DraftChange records
        base_commit_sha: Base commit SHA the draft is based on
        user_title: Optional user-provided title

    Returns:
        PR title with context prefix
    """
    # Build prefix with commit SHA
    sha_prefix = base_commit_sha[:7] if base_commit_sha else "unknown"
    prefix = f"[ontology @{sha_prefix}]"

    # Use user title if provided
    if user_title:
        return f"{prefix} {user_title}"

    # Generate summary based on changes
    if not changes:
        return f"{prefix} Schema update (no changes)"

    # Count by change type
    creates = sum(1 for c in changes if c.change_type == ChangeType.CREATE)
    updates = sum(1 for c in changes if c.change_type == ChangeType.UPDATE)
    deletes = sum(1 for c in changes if c.change_type == ChangeType.DELETE)

    # For single change, be specific
    if len(changes) == 1:
        change = changes[0]
        action = (
            "Add"
            if change.change_type == ChangeType.CREATE
            else "Update"
            if change.change_type == ChangeType.UPDATE
            else "Delete"
        )
        return f"{prefix} {action} {change.entity_type}: {change.entity_key}"

    # For multiple changes, summarize
    parts = []
    if creates:
        parts.append(f"{creates} addition{'s' if creates != 1 else ''}")
    if updates:
        parts.append(f"{updates} update{'s' if updates != 1 else ''}")
    if deletes:
        parts.append(f"{deletes} deletion{'s' if deletes != 1 else ''}")

    summary = ", ".join(parts)
    return f"{prefix} {summary}"


def generate_pr_body_v2(
    changes: list[DraftChange],
    is_valid: bool,
    errors: list | None = None,
    warnings: list | None = None,
    draft_title: str | None = None,
    user_comment: str | None = None,
) -> str:
    """Generate markdown PR body with changes and validation status.

    Args:
        changes: List of DraftChange records
        is_valid: Whether validation passed
        errors: Validation errors (if any)
        warnings: Validation warnings (if any)
        draft_title: Optional draft title
        user_comment: Optional user comment to include

    Returns:
        Markdown string for PR body
    """
    errors = errors or []
    warnings = warnings or []
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
    status = "Passed" if is_valid else "Failed"
    sections.append(f"**Status:** {status}\n")

    # Errors (if any)
    if errors:
        sections.append(f"### Errors ({len(errors)})\n")
        for error in errors:
            sections.append(f"- `{error.entity_key}`: {error.message}")
        sections.append("")

    # Warnings (if any)
    if warnings:
        sections.append(f"### Warnings ({len(warnings)})\n")
        for warning in warnings:
            sections.append(f"- `{warning.entity_key}`: {warning.message}")
        sections.append("")

    # Footer
    sections.append("---")
    sections.append("*Created via [Ontology Hub](https://ontology.labki.org)*")

    return "\n".join(sections)
