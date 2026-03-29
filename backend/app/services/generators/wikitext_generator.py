"""Generate OntologySync wikitext files from structured entity dicts.

This is the inverse of wikitext_parser.py. Given a dict in the same format
as the DB's canonical_json, it produces wikitext with semantic annotations.

Used by the PR builder to generate wikitext files for GitHub PRs.
"""

from __future__ import annotations

import json
from typing import Any

from app.services.parsers.wikitext_parser import NAMESPACE_TO_ENTITY_TYPE, to_page_name
from app.services.resource_validation import RESERVED_KEYS, get_entity_categories

# Reverse mapping: entity type -> namespace constant
ENTITY_TYPE_TO_NAMESPACE: dict[str, str] = {v: k for k, v in NAMESPACE_TO_ENTITY_TYPE.items()}


def _with_ns(entity_key: str, ns: str) -> str:
    """Add a namespace prefix to an entity key for wikitext annotations."""
    return f"{ns}:{to_page_name(entity_key)}"


# ─── Entity-specific generators ─────────────────────────────────────────────


def generate_category_wikitext(entity: dict[str, Any]) -> str:
    """Generate wikitext for a category entity."""
    lines = ["<!-- OntologySync Start -->"]

    if entity.get("description"):
        lines.append(f"[[Has description::{entity['description']}]]")
    if entity.get("label") and entity["label"] != to_page_name(entity.get("id", "")):
        lines.append(f"[[Display label::{entity['label']}]]")

    for parent in entity.get("parents", []):
        lines.append(f"[[Has parent category::{_with_ns(parent, 'Category')}]]")
    for prop in entity.get("required_properties", []):
        lines.append(f"[[Has required property::{_with_ns(prop, 'Property')}]]")
    for prop in entity.get("optional_properties", []):
        lines.append(f"[[Has optional property::{_with_ns(prop, 'Property')}]]")
    for sub in entity.get("required_subobjects", []):
        lines.append(f"[[Has required subobject::{_with_ns(sub, 'Subobject')}]]")
    for sub in entity.get("optional_subobjects", []):
        lines.append(f"[[Has optional subobject::{_with_ns(sub, 'Subobject')}]]")

    lines.append("<!-- OntologySync End -->")
    lines.append("[[Category:OntologySync-managed]]")

    return "\n".join(lines) + "\n"


def generate_property_wikitext(entity: dict[str, Any]) -> str:
    """Generate wikitext for a property entity."""
    lines = ["<!-- OntologySync Start -->"]

    lines.append(f"[[Has type::{entity.get('datatype', '')}]]")

    if entity.get("description"):
        lines.append(f"[[Has description::{entity['description']}]]")
    if entity.get("label") and entity["label"] != to_page_name(entity.get("id", "")):
        lines.append(f"[[Display label::{entity['label']}]]")

    if entity.get("cardinality") == "multiple":
        lines.append("[[Allows multiple values::true]]")

    if isinstance(entity.get("allowed_values"), list):
        for value in entity["allowed_values"]:
            lines.append(f"[[Allows value::{value}]]")

    if entity.get("Allows_value_from_category"):
        lines.append(
            f"[[Allows value from category::{_with_ns(entity['Allows_value_from_category'], 'Category')}]]"
        )

    if entity.get("allowed_pattern"):
        lines.append(f"[[Allows pattern::{entity['allowed_pattern']}]]")

    if entity.get("allowed_value_list"):
        lines.append(f"[[Allows value list::{entity['allowed_value_list']}]]")

    if entity.get("display_units"):
        for unit in entity["display_units"]:
            lines.append(f"[[Display units::{unit}]]")

    if entity.get("display_precision") is not None:
        lines.append(f"[[Display precision::{entity['display_precision']}]]")

    if entity.get("unique_values") is True:
        lines.append("[[Has unique values::true]]")

    if entity.get("has_display_template"):
        lines.append(f"[[Has template::{_with_ns(entity['has_display_template'], 'Template')}]]")

    if entity.get("parent_property"):
        lines.append(f"[[Subproperty of::{_with_ns(entity['parent_property'], 'Property')}]]")

    lines.append("<!-- OntologySync End -->")
    lines.append("[[Category:OntologySync-managed-property]]")

    return "\n".join(lines) + "\n"


def generate_subobject_wikitext(entity: dict[str, Any]) -> str:
    """Generate wikitext for a subobject entity."""
    lines = ["<!-- OntologySync Start -->"]

    if entity.get("description"):
        lines.append(f"[[Has description::{entity['description']}]]")
    if entity.get("label") and entity["label"] != to_page_name(entity.get("id", "")):
        lines.append(f"[[Display label::{entity['label']}]]")

    for prop in entity.get("required_properties", []):
        lines.append(f"[[Has required property::{_with_ns(prop, 'Property')}]]")
    for prop in entity.get("optional_properties", []):
        lines.append(f"[[Has optional property::{_with_ns(prop, 'Property')}]]")

    lines.append("<!-- OntologySync End -->")
    lines.append("[[Category:OntologySync-managed-subobject]]")

    return "\n".join(lines) + "\n"


def generate_template_wikitext(entity: dict[str, Any]) -> str:
    """Generate wikitext for a template. Templates are raw wikitext content."""
    return (entity.get("wikitext", "") or "") + "\n"


def generate_dashboard_page_wikitext(wikitext_content: str) -> str:
    """Generate wikitext for a dashboard page. Dashboards are pure wikitext."""
    return (wikitext_content or "") + "\n"


def generate_resource_wikitext(entity: dict[str, Any]) -> str:
    """Generate wikitext for a resource entity."""
    lines = ["<!-- OntologySync Start -->"]

    if entity.get("description"):
        lines.append(f"[[Has description::{entity['description']}]]")
    if entity.get("label"):
        lines.append(f"[[Display label::{entity['label']}]]")

    # Dynamic property fields
    for key, value in entity.items():
        if key in RESERVED_KEYS:
            continue
        page_name = to_page_name(key)
        if isinstance(value, list):
            for v in value:
                lines.append(f"[[{page_name}::{v}]]")
        else:
            lines.append(f"[[{page_name}::{value}]]")

    lines.append("<!-- OntologySync End -->")

    # Category memberships (supports multiple)
    for cat in get_entity_categories(entity):
        lines.append(f"[[Category:{to_page_name(cat)}]]")
    lines.append("[[Category:OntologySync-managed-resource]]")

    # Free-form body content
    body = entity.get("wikitext", "")
    if body:
        lines.append("")
        lines.append(body)

    return "\n".join(lines) + "\n"


def generate_module_vocab_json(
    entity: dict[str, Any],
    ontology_version: str = "",
) -> str:
    """Generate a module vocab.json string from a structured module dict.

    The entity dict should contain the standard module fields (id, version, label,
    description, dependencies) plus entity arrays (categories, properties, etc.).
    """
    manual_categories = set(entity.get("manual_categories", []))

    import_entries = []
    for etype, namespace in ENTITY_TYPE_TO_NAMESPACE.items():
        for key in entity.get(etype, []):
            options: dict[str, Any] = {"replaceable": True}
            # Manual categories are the only user-selected entries; everything
            # else (parent categories, properties, subobjects, etc.) is auto-derived
            is_manual = etype == "categories" and key in manual_categories
            if not is_manual:
                options["auto_included"] = True
            import_entries.append(
                {
                    "page": to_page_name(key),
                    "namespace": namespace,
                    "contents": {"importFrom": f"{etype}/{key}.wikitext"},
                    "options": options,
                }
            )

    vocab = {
        "description": entity.get("description", ""),
        "id": entity.get("id", ""),
        "version": entity.get("version", ""),
        "label": entity.get("label", entity.get("id", "")),
        "dependencies": entity.get("dependencies", []),
        "import": import_entries,
        "meta": {
            "version": "1",
            "ontologyVersion": ontology_version,
        },
    }

    return json.dumps(vocab, indent=2) + "\n"


# ─── Dispatch by entity type ────────────────────────────────────────────────

_GENERATORS: dict[str, Any] = {
    "category": generate_category_wikitext,
    "property": generate_property_wikitext,
    "subobject": generate_subobject_wikitext,
    "template": generate_template_wikitext,
    "resource": generate_resource_wikitext,
}


def generate_wikitext(entity_json: dict[str, Any], entity_type: str) -> str:
    """Generate wikitext for an entity, dispatching by singular entity_type key.

    Accepts singular keys (e.g. "category", "property") matching the
    entity_type values used by DraftChange and the PR builder.

    For dashboards, use generate_dashboard_page_wikitext() directly.
    For modules, use generate_module_vocab_json().
    """
    generator = _GENERATORS.get(entity_type)
    if not generator:
        raise ValueError(f"Unknown entity type for wikitext generation: {entity_type}")
    result: str = generator(entity_json)
    return result
