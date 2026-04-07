"""Generate OntologySync wikitext files from structured entity dicts.

This is the inverse of wikitext_parser.py. Given a dict in the same format
as the DB's canonical_json, it produces wikitext using SemanticSchemas
template call syntax (e.g. {{Property|has_type=Text|...}}).

Used by the PR builder to generate wikitext files for GitHub PRs.
"""

from __future__ import annotations

from typing import Any

from app.services.parsers.wikitext_parser import to_page_name
from app.services.resource_validation import RESERVED_KEYS, get_entity_categories

# ─── Helpers ──────────────────────────────────────────────────────────────────


def _to_param(name: str) -> str:
    """Convert a property display name to a template parameter name.

    Follows SemanticSchemas NamingHelper convention: lowercase, spaces to underscores.
    """
    return name.lower().replace(" ", "_")


def _comma_join(entity_keys: list[str]) -> str:
    """Join entity keys as comma-separated page names (spaces, no namespace prefix)."""
    return ", ".join(to_page_name(k) for k in entity_keys)


def _build_template_call(template_name: str, params: list[tuple[str, str]]) -> str:
    """Build a {{TemplateName|param=value|...}} string.

    Only includes params with non-empty values.
    """
    parts = ["{{" + template_name]
    for name, value in params:
        if value:
            parts.append(f"|{name}={value}")
    parts.append("}}")
    return "\n".join(parts)


# ─── Entity-specific generators ─────────────────────────────────────────────


def generate_category_wikitext(entity: dict[str, Any]) -> str:
    """Generate wikitext for a category entity."""
    label = entity.get("label", "")
    page_name = to_page_name(entity.get("id", ""))

    params: list[tuple[str, str]] = [
        ("has_description", entity.get("description", "")),
        ("display_label", label if label and label != page_name else ""),
        ("has_parent_category", _comma_join(entity.get("parents", []))),
        ("has_required_property", _comma_join(entity.get("required_properties", []))),
        ("has_optional_property", _comma_join(entity.get("optional_properties", []))),
        ("has_required_subobject", _comma_join(entity.get("required_subobjects", []))),
        ("has_optional_subobject", _comma_join(entity.get("optional_subobjects", []))),
    ]

    lines = [
        "<!-- OntologySync Start -->",
        _build_template_call("Category", params),
        "<!-- OntologySync End -->",
        "[[Category:OntologySync-managed]]",
    ]
    return "\n".join(lines) + "\n"


def generate_property_wikitext(entity: dict[str, Any]) -> str:
    """Generate wikitext for a property entity."""
    label = entity.get("label", "")
    page_name = to_page_name(entity.get("id", ""))

    # Allows_value_from_category: convert entity key to page name (no namespace prefix)
    from_cat = entity.get("Allows_value_from_category", "")
    from_cat_value = to_page_name(from_cat) if from_cat else ""

    # has_display_template: convert entity key to page name (no namespace prefix)
    template = entity.get("has_display_template", "")
    template_value = to_page_name(template) if template else ""

    # parent_property: convert entity key to page name (no namespace prefix)
    parent = entity.get("parent_property", "")
    parent_value = to_page_name(parent) if parent else ""

    params: list[tuple[str, str]] = [
        ("has_description", entity.get("description", "")),
        ("has_type", entity.get("datatype", "")),
        ("display_label", label if label and label != page_name else ""),
        ("allows_multiple_values", "Yes" if entity.get("cardinality") == "multiple" else ""),
        ("allows_value", ", ".join(entity.get("allowed_values", []))),
        ("allows_value_from_category", from_cat_value),
        ("allows_pattern", entity.get("allowed_pattern", "") or ""),
        ("allows_value_list", entity.get("allowed_value_list", "") or ""),
        ("display_units", ", ".join(entity.get("display_units", []))),
        (
            "display_precision",
            str(entity["display_precision"]) if entity.get("display_precision") is not None else "",
        ),
        ("has_unique_values", "Yes" if entity.get("unique_values") is True else ""),
        ("has_template", template_value),
        ("subproperty_of", parent_value),
    ]

    lines = [
        "<!-- OntologySync Start -->",
        _build_template_call("Property", params),
        "<!-- OntologySync End -->",
        "[[Category:OntologySync-managed-property]]",
    ]
    return "\n".join(lines) + "\n"


def generate_subobject_wikitext(entity: dict[str, Any]) -> str:
    """Generate wikitext for a subobject entity."""
    label = entity.get("label", "")
    page_name = to_page_name(entity.get("id", ""))

    params: list[tuple[str, str]] = [
        ("has_description", entity.get("description", "")),
        ("display_label", label if label and label != page_name else ""),
        ("has_required_property", _comma_join(entity.get("required_properties", []))),
        ("has_optional_property", _comma_join(entity.get("optional_properties", []))),
    ]

    lines = [
        "<!-- OntologySync Start -->",
        _build_template_call("Subobject", params),
        "<!-- OntologySync End -->",
        "[[Category:OntologySync-managed-subobject]]",
    ]
    return "\n".join(lines) + "\n"


def generate_template_wikitext(entity: dict[str, Any]) -> str:
    """Generate wikitext for a template. Templates are raw wikitext content."""
    return (entity.get("wikitext", "") or "") + "\n"


def generate_dashboard_page_wikitext(wikitext_content: str) -> str:
    """Generate wikitext for a dashboard subpage. Subpages are pure wikitext."""
    return (wikitext_content or "") + "\n"


# Keys in canonical_json that are NOT dynamic property fields for dashboards
_DASHBOARD_RESERVED = RESERVED_KEYS | {"pages"}


def generate_dashboard_root_wikitext(entity: dict[str, Any], root_wikitext: str) -> str:
    """Generate wikitext for a dashboard root page with annotation block.

    Produces the OntologySync marker block with {{Dashboard|...}} template
    call containing category properties, followed by category memberships
    and the page's body content.
    """
    params: list[tuple[str, str]] = []

    desc = entity.get("description", "") or ""
    if desc:
        params.append(("has_description", desc))

    # Dynamic property fields (Has_dashboard_scope, Has_parent_dashboard, etc.)
    for key, value in entity.items():
        if key in _DASHBOARD_RESERVED:
            continue
        param_name = _to_param(to_page_name(key))
        param_value = ", ".join(str(v) for v in value) if isinstance(value, list) else str(value)
        params.append((param_name, param_value))

    lines = [
        "<!-- OntologySync Start -->",
        _build_template_call("Dashboard", params),
        "<!-- OntologySync End -->",
        "[[Category:Dashboard]]",
        "[[Category:OntologySync-managed-dashboard]]",
    ]

    # Extract body content (everything after markers/categories in original wikitext)
    body = _extract_dashboard_body(root_wikitext)
    if body:
        lines.append("")
        lines.append(body)

    return "\n".join(lines) + "\n"


def _extract_dashboard_body(wikitext: str) -> str:
    """Extract content after annotation block and category markers.

    If the wikitext has no markers (e.g., newly created via the form),
    the entire content is treated as the body.
    """
    if not wikitext:
        return ""

    # If no markers, the entire wikitext is the body
    if "<!-- OntologySync Start -->" not in wikitext:
        return wikitext.strip()

    lines = wikitext.split("\n")
    last_structural = -1
    in_block = False
    import re
    cat_re = re.compile(r"^\[\[Category:[^\]]+\]\]$")

    for i, line in enumerate(lines):
        trimmed = line.strip()
        if trimmed == "<!-- OntologySync Start -->":
            in_block = True
            last_structural = i
        elif trimmed == "<!-- OntologySync End -->":
            in_block = False
            last_structural = i
        elif in_block or cat_re.match(trimmed):
            last_structural = i

    if last_structural < 0 or last_structural >= len(lines) - 1:
        return ""

    return "\n".join(lines[last_structural + 1 :]).strip()


def generate_resource_wikitext(entity: dict[str, Any]) -> str:
    """Generate wikitext for a resource entity."""
    categories = get_entity_categories(entity)
    template_name = to_page_name(categories[0]) if categories else "Resource"

    params: list[tuple[str, str]] = [
        ("has_description", entity.get("description", "") or ""),
        ("display_label", entity.get("label", "") or ""),
    ]

    # Dynamic property fields
    for key, value in entity.items():
        if key in RESERVED_KEYS:
            continue
        param_name = _to_param(to_page_name(key))
        param_value = ", ".join(str(v) for v in value) if isinstance(value, list) else str(value)
        params.append((param_name, param_value))

    lines = [
        "<!-- OntologySync Start -->",
        _build_template_call(template_name, params),
        "<!-- OntologySync End -->",
    ]

    # Category memberships (supports multiple)
    for cat in categories:
        lines.append(f"[[Category:{to_page_name(cat)}]]")
    lines.append("[[Category:OntologySync-managed-resource]]")

    # Free-form body content
    body = entity.get("wikitext", "")
    if body:
        lines.append("")
        lines.append(body)

    return "\n".join(lines) + "\n"


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
    For modules, use json.dumps() directly (simple JSON format).
    """
    generator = _GENERATORS.get(entity_type)
    if not generator:
        raise ValueError(f"Unknown entity type for wikitext generation: {entity_type}")
    result: str = generator(entity_json)
    return result
