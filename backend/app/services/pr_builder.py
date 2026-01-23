"""PR builder service for file serialization and PR body generation.

Converts draft payloads to repository file format and generates structured PR bodies.
"""

import json
from datetime import datetime
from typing import Any

from app.models.draft import (
    DraftDiffResponse,
    DraftPayload,
    EntityDefinition,
    ModuleDefinition,
    ProfileDefinition,
)


def serialize_entity_for_repo(entity: EntityDefinition, entity_type: str) -> dict:
    """Convert draft entity format to repository file format.

    Args:
        entity: Entity definition from draft
        entity_type: "categories", "properties", or "subobjects"

    Returns:
        Entity in repo format (uses "id" not "entity_id")
    """
    # Base fields common to all entity types
    repo_entity: dict[str, Any] = {
        "id": entity.entity_id,
        "label": entity.label,
    }

    # Add description if present
    if entity.description:
        repo_entity["description"] = entity.description

    # Add entity-type-specific fields from schema_definition
    if entity_type == "categories":
        repo_entity.update(
            {
                "parent": entity.schema_definition.get("parent"),
                "properties": entity.schema_definition.get("properties", []),
                "subobjects": entity.schema_definition.get("subobjects", []),
            }
        )
    elif entity_type == "properties":
        repo_entity.update(
            {
                "datatype": entity.schema_definition.get("datatype"),
                "cardinality": entity.schema_definition.get("cardinality"),
            }
        )
    elif entity_type == "subobjects":
        repo_entity["properties"] = entity.schema_definition.get("properties", [])

    return repo_entity


def serialize_module_for_repo(module: ModuleDefinition) -> dict:
    """Convert draft module format to repository file format.

    Args:
        module: Module definition from draft

    Returns:
        Module in repo format (uses "id" and "categories")
    """
    repo_module: dict[str, Any] = {
        "id": module.module_id,
        "label": module.label,
    }

    if module.description:
        repo_module["description"] = module.description

    repo_module["categories"] = module.category_ids
    repo_module["dependencies"] = module.dependencies

    return repo_module


def serialize_profile_for_repo(profile: ProfileDefinition) -> dict:
    """Convert draft profile format to repository file format.

    Args:
        profile: Profile definition from draft

    Returns:
        Profile in repo format (uses "id" and "modules")
    """
    repo_profile: dict[str, Any] = {
        "id": profile.profile_id,
        "label": profile.label,
    }

    if profile.description:
        repo_profile["description"] = profile.description

    repo_profile["modules"] = profile.module_ids

    return repo_profile


def build_files_from_draft(payload: DraftPayload) -> list[dict]:
    """Build list of files from draft payload for PR creation.

    Args:
        payload: Draft payload containing entities, modules, profiles

    Returns:
        List of dicts with "path" and "content" keys for Git tree creation
    """
    files = []

    # Process categories
    for category in payload.entities.categories:
        repo_entity = serialize_entity_for_repo(category, "categories")
        content = json.dumps(repo_entity, indent=2) + "\n"
        files.append({"path": f"categories/{category.entity_id}.json", "content": content})

    # Process properties
    for prop in payload.entities.properties:
        repo_entity = serialize_entity_for_repo(prop, "properties")
        content = json.dumps(repo_entity, indent=2) + "\n"
        files.append({"path": f"properties/{prop.entity_id}.json", "content": content})

    # Process subobjects
    for subobj in payload.entities.subobjects:
        repo_entity = serialize_entity_for_repo(subobj, "subobjects")
        content = json.dumps(repo_entity, indent=2) + "\n"
        files.append({"path": f"subobjects/{subobj.entity_id}.json", "content": content})

    # Process modules
    for module in payload.modules:
        repo_module = serialize_module_for_repo(module)
        content = json.dumps(repo_module, indent=2) + "\n"
        files.append({"path": f"modules/{module.module_id}.json", "content": content})

    # Process profiles
    for profile in payload.profiles:
        repo_profile = serialize_profile_for_repo(profile)
        content = json.dumps(repo_profile, indent=2) + "\n"
        files.append({"path": f"profiles/{profile.profile_id}.json", "content": content})

    return files


def generate_pr_body(
    diff: DraftDiffResponse, validation: dict, wiki_url: str, base_version: str
) -> str:
    """Generate markdown PR body with changes, validation, and semver info.

    Args:
        diff: Draft diff response showing changes
        validation: Validation results dict with is_valid, errors, warnings, etc.
        wiki_url: Source wiki URL
        base_version: Base schema version

    Returns:
        Markdown string for PR body
    """
    sections = []

    # Summary section
    sections.append("## Summary\n")
    sections.append(f"Changes proposed from [{wiki_url}]({wiki_url})")
    sections.append(f"Based on version: `{base_version}`\n")

    # Changes section
    sections.append("## Changes\n")

    # Helper to format changes for an entity type
    def format_entity_changes(entity_name: str, changes: Any) -> list[str]:
        lines = []
        if changes.added or changes.modified or changes.deleted:
            lines.append(f"### {entity_name.capitalize()}\n")
            if changes.added:
                added_ids = ", ".join([c.entity_id for c in changes.added])
                lines.append(f"- **Added:** {added_ids}")
            if changes.modified:
                modified_ids = ", ".join([c.entity_id for c in changes.modified])
                lines.append(f"- **Modified:** {modified_ids}")
            if changes.deleted:
                deleted_ids = ", ".join([c.entity_id for c in changes.deleted])
                lines.append(f"- **Deleted:** {deleted_ids}")
            lines.append("")
        return lines

    sections.extend(format_entity_changes("Categories", diff.categories))
    sections.extend(format_entity_changes("Properties", diff.properties))
    sections.extend(format_entity_changes("Subobjects", diff.subobjects))
    sections.extend(format_entity_changes("Modules", diff.modules))
    sections.extend(format_entity_changes("Profiles", diff.profiles))

    # Validation section
    sections.append("## Validation\n")
    is_valid = validation.get("is_valid", False)
    status = "Passed" if is_valid else "Failed"
    sections.append(f"**Status:** {status}")

    # Semver suggestion
    suggested_bump = validation.get("suggested_semver_bump", "patch")
    sections.append(f"**Suggested version bump:** `{suggested_bump}`\n")

    # Errors
    errors = validation.get("errors", [])
    if errors:
        sections.append(f"### Errors ({len(errors)})\n")
        for error in errors:
            field = error.get("field", "unknown")
            message = error.get("message", "")
            sections.append(f"- `{field}`: {message}")
        sections.append("")

    # Warnings
    warnings = validation.get("warnings", [])
    if warnings:
        sections.append(f"### Warnings ({len(warnings)})\n")
        for warning in warnings:
            field = warning.get("field", "unknown")
            message = warning.get("message", "")
            sections.append(f"- `{field}`: {message}")
        sections.append("")

    # Semver reasons
    semver_reasons = validation.get("semver_reasons", [])
    if semver_reasons:
        sections.append("### Version bump reasons\n")
        for reason in semver_reasons:
            sections.append(f"- {reason}")
        sections.append("")

    # Footer
    sections.append("---")
    sections.append("*Created via [Ontology Hub](https://ontology.labki.org)*")

    return "\n".join(sections)


def generate_branch_name(draft_id: str) -> str:
    """Generate branch name for draft PR.

    Args:
        draft_id: Draft UUID as string

    Returns:
        Branch name like "draft-{uuid_prefix}-{timestamp}"
    """
    timestamp = datetime.utcnow().strftime("%Y%m%d-%H%M%S")
    return f"draft-{draft_id[:8]}-{timestamp}"


def generate_commit_message(diff: DraftDiffResponse) -> str:
    """Generate commit message with change summary.

    Args:
        diff: Draft diff response

    Returns:
        Commit message with body
    """
    # Count total changes
    total_added = (
        len(diff.categories.added)
        + len(diff.properties.added)
        + len(diff.subobjects.added)
        + len(diff.modules.added)
        + len(diff.profiles.added)
    )
    total_modified = (
        len(diff.categories.modified)
        + len(diff.properties.modified)
        + len(diff.subobjects.modified)
        + len(diff.modules.modified)
        + len(diff.profiles.modified)
    )
    total_deleted = (
        len(diff.categories.deleted)
        + len(diff.properties.deleted)
        + len(diff.subobjects.deleted)
        + len(diff.modules.deleted)
        + len(diff.profiles.deleted)
    )

    # Build summary lines
    summary_parts = []
    if total_added > 0:
        summary_parts.append(f"{total_added} added")
    if total_modified > 0:
        summary_parts.append(f"{total_modified} modified")
    if total_deleted > 0:
        summary_parts.append(f"{total_deleted} deleted")

    summary = ", ".join(summary_parts) if summary_parts else "no changes"

    # Build commit message
    message = f"feat(schema): update from wiki export\n\n"
    message += f"Changes: {summary}\n"

    return message
