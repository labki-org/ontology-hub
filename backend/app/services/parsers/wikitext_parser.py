"""Parse OntologySync wikitext files into structured entity dicts.

Wikitext files use SemanticSchemas template call syntax within
<!-- OntologySync Start/End --> blocks.  Each entity is represented as a
template call like {{Property|has_type=Text|has_description=...}}.

This parser produces dicts in the same format as the old JSON entity files,
so downstream code (entity_parser.py, validation, draft overlay) works unchanged.
"""

from __future__ import annotations

import re
from typing import Any

# Namespace constant to entity type mapping (for vocab.json parsing)
NAMESPACE_TO_ENTITY_TYPE: dict[str, str] = {
    "NS_CATEGORY": "categories",
    "SMW_NS_PROPERTY": "properties",
    "NS_SUBOBJECT": "subobjects",
    "NS_TEMPLATE": "templates",
    "NS_ONTOLOGY_DASHBOARD": "dashboards",
    "NS_ONTOLOGY_RESOURCE": "resources",
}

_CATEGORY_RE = re.compile(r"^\[\[Category:([^\]]+)\]\]$")

_START_MARKER = "<!-- OntologySync Start -->"
_END_MARKER = "<!-- OntologySync End -->"


def to_page_name(entity_key: str) -> str:
    """Convert an entity key (underscores) to a wiki page name (spaces)."""
    return entity_key.replace("_", " ")


def to_entity_key(page_name: str) -> str:
    """Convert a wiki page name (spaces) to an entity key (underscores)."""
    return page_name.replace(" ", "_")


def _iter_lines_by_block(
    wikitext: str,
) -> list[tuple[str, bool]]:
    """Classify each trimmed line as inside or outside the annotation block.

    Returns (trimmed_line, inside_block) pairs, excluding the marker lines.
    """
    result: list[tuple[str, bool]] = []
    in_block = False

    for line in wikitext.split("\n"):
        trimmed = line.strip()
        if trimmed == _START_MARKER:
            in_block = True
            continue
        if trimmed == _END_MARKER:
            in_block = False
            continue
        result.append((trimmed, in_block))

    return result


def _extract_template_call(wikitext: str) -> tuple[str, dict[str, str]]:
    """Extract template name and parameters from a template call within markers.

    Parses content like:
        <!-- OntologySync Start -->
        {{Property
        |has_type=Text
        |has_description=A description
        }}
        <!-- OntologySync End -->

    Returns (template_name, {"has_type": "Text", "has_description": "A description"}).
    """
    # Extract content between markers
    start = wikitext.find(_START_MARKER)
    end = wikitext.find(_END_MARKER)
    if start < 0 or end < 0 or end <= start:
        return ("", {})

    block = wikitext[start + len(_START_MARKER) : end].strip()

    # Find template call delimiters
    if not block.startswith("{{") or not block.endswith("}}"):
        return ("", {})

    # Strip {{ and }}
    inner = block[2:-2]

    # Split on | at start of line to get template name and params
    # The first segment is the template name (possibly with leading whitespace)
    parts = re.split(r"\n\|", inner)
    template_name = parts[0].strip()

    params: dict[str, str] = {}
    for part in parts[1:]:
        eq_pos = part.find("=")
        if eq_pos > 0:
            key = part[:eq_pos].strip()
            value = part[eq_pos + 1 :].strip()
            if value:
                params[key] = value

    return (template_name, params)


def _split_comma(value: str) -> list[str]:
    """Split a comma-separated value string into a list, stripping whitespace."""
    if not value:
        return []
    return [v.strip() for v in value.split(",") if v.strip()]


def _comma_to_keys(value: str) -> list[str]:
    """Split comma-separated page names and convert each to an entity key."""
    return [to_entity_key(v) for v in _split_comma(value)]


def extract_categories(wikitext: str) -> list[str]:
    """Extract [[Category:X]] markers outside the annotation block."""
    categories: list[str] = []

    for trimmed, in_block in _iter_lines_by_block(wikitext):
        if in_block:
            continue
        match = _CATEGORY_RE.match(trimmed)
        if match:
            categories.append(match.group(1))

    return categories


# ─── Entity-specific parsers ────────────────────────────────────────────────


def parse_category_wikitext(wikitext: str, entity_key: str) -> dict[str, Any]:
    """Parse category wikitext into dict matching the JSON format."""
    _, params = _extract_template_call(wikitext)

    result: dict[str, Any] = {
        "id": entity_key,
        "label": params.get("display_label", to_page_name(entity_key)),
        "description": params.get("has_description", ""),
    }

    parents = _comma_to_keys(params.get("has_parent_category", ""))
    if parents:
        result["parents"] = parents

    req_props = _comma_to_keys(params.get("has_required_property", ""))
    if req_props:
        result["required_properties"] = req_props

    opt_props = _comma_to_keys(params.get("has_optional_property", ""))
    if opt_props:
        result["optional_properties"] = opt_props

    req_subs = _comma_to_keys(params.get("has_required_subobject", ""))
    if req_subs:
        result["required_subobjects"] = req_subs

    opt_subs = _comma_to_keys(params.get("has_optional_subobject", ""))
    if opt_subs:
        result["optional_subobjects"] = opt_subs

    return result


def parse_property_wikitext(wikitext: str, entity_key: str) -> dict[str, Any]:
    """Parse property wikitext into dict matching the JSON format."""
    _, params = _extract_template_call(wikitext)

    result: dict[str, Any] = {
        "id": entity_key,
        "label": params.get("display_label", to_page_name(entity_key)),
        "description": params.get("has_description", ""),
        "datatype": params.get("has_type", ""),
        "cardinality": "multiple" if params.get("allows_multiple_values") == "Yes" else "single",
    }

    allowed_vals = _split_comma(params.get("allows_value", ""))
    if allowed_vals:
        result["allowed_values"] = allowed_vals

    from_cat = params.get("allows_value_from_category", "")
    if from_cat:
        result["Allows_value_from_category"] = to_entity_key(from_cat)

    pattern = params.get("allows_pattern", "")
    if pattern:
        result["allowed_pattern"] = pattern

    value_list = params.get("allows_value_list", "")
    if value_list:
        result["allowed_value_list"] = value_list

    display_units = _split_comma(params.get("display_units", ""))
    if display_units:
        result["display_units"] = display_units

    precision = params.get("display_precision", "")
    if precision:
        result["display_precision"] = int(precision)

    if params.get("has_unique_values") == "Yes":
        result["unique_values"] = True

    template = params.get("has_template", "")
    if template:
        result["has_display_template"] = to_entity_key(template)

    parent_prop = params.get("subproperty_of", "")
    if parent_prop:
        result["parent_property"] = to_entity_key(parent_prop)

    return result


def parse_subobject_wikitext(wikitext: str, entity_key: str) -> dict[str, Any]:
    """Parse subobject wikitext into dict matching the JSON format."""
    _, params = _extract_template_call(wikitext)

    result: dict[str, Any] = {
        "id": entity_key,
        "label": params.get("display_label", to_page_name(entity_key)),
        "description": params.get("has_description", ""),
    }

    req_props = _comma_to_keys(params.get("has_required_property", ""))
    if req_props:
        result["required_properties"] = req_props

    opt_props = _comma_to_keys(params.get("has_optional_property", ""))
    if opt_props:
        result["optional_properties"] = opt_props

    return result


def parse_template_wikitext(wikitext: str, entity_key: str) -> dict[str, Any]:
    """Parse template wikitext. Templates are raw wikitext with no annotation block."""
    return {
        "id": entity_key,
        "label": to_page_name(entity_key),
        "description": "",
        "wikitext": wikitext.rstrip(),
    }


def parse_dashboard_page(wikitext: str, page_name: str) -> dict[str, str]:
    """Parse a single dashboard page."""
    return {
        "name": page_name,
        "wikitext": wikitext.rstrip(),
    }


def _extract_body(wikitext: str) -> str:
    """Extract free-form body content after the annotation block and category markers.

    Needs raw line indices (unlike extract_categories),
    so it tracks block state inline rather than using _iter_lines_by_block.
    """
    lines = wikitext.split("\n")
    last_structural = -1
    in_block = False

    for i, line in enumerate(lines):
        trimmed = line.strip()
        if trimmed == _START_MARKER:
            in_block = True
            last_structural = i
        elif trimmed == _END_MARKER:
            in_block = False
            last_structural = i
        elif in_block or _CATEGORY_RE.match(trimmed):
            last_structural = i

    if last_structural < 0 or last_structural >= len(lines) - 1:
        return ""

    return "\n".join(lines[last_structural + 1 :]).strip()


def parse_resource_wikitext(wikitext: str, entity_key: str) -> dict[str, Any]:
    """Parse resource wikitext into dict matching the JSON format."""
    template_name, params = _extract_template_call(wikitext)
    categories = extract_categories(wikitext)

    # Find all content categories (non-management)
    content_categories = [
        to_entity_key(c) for c in categories if not c.startswith("OntologySync-managed")
    ]

    result: dict[str, Any] = {
        "id": entity_key,
        "label": params.get("display_label", to_page_name(entity_key.split("/")[-1])),
        "description": params.get("has_description", ""),
        "categories": content_categories,
    }

    # Add dynamic property fields (everything except reserved metadata params)
    metadata_params = {"display_label", "has_description"}
    for param_name, value in params.items():
        if param_name in metadata_params:
            continue
        # Convert param name back to entity key format (e.g., "has_name" -> "Has_name")
        # Param names are lowercase; original keys had capitalized words with underscores
        # We store them as-is using the capitalized page_name -> entity_key convention
        key = to_entity_key(to_page_name(param_name).title())
        # Check if comma-separated (multi-value)
        parts = _split_comma(value)
        result[key] = parts if len(parts) > 1 else value

    # Extract free-form body content
    body = _extract_body(wikitext)
    if body:
        result["wikitext"] = body

    return result


def parse_module_vocab(vocab_json: dict[str, Any]) -> dict[str, Any]:
    """Parse a module vocab.json into a structured dict matching old module JSON format.

    Extracts entity membership from the import array by namespace.
    """
    result: dict[str, Any] = {
        "id": vocab_json["id"],
        "version": vocab_json.get("version", ""),
        "label": vocab_json.get("label", vocab_json["id"]),
        "description": vocab_json.get("description", ""),
        "dependencies": vocab_json.get("dependencies", []),
    }

    entities: dict[str, list[str]] = {
        "categories": [],
        "properties": [],
        "subobjects": [],
        "templates": [],
        "dashboards": [],
        "resources": [],
    }

    auto_included_categories: set[str] = set()

    for entry in vocab_json.get("import", []):
        entity_type = NAMESPACE_TO_ENTITY_TYPE.get(entry.get("namespace", ""))
        if not entity_type:
            continue

        import_path = entry.get("contents", {}).get("importFrom", "")
        entity_key = _import_path_to_entity_key(import_path, entity_type)

        # For dashboards, use only the root ID (subpages are part of the same entity)
        if entity_type == "dashboards" and "/" in entity_key:
            entity_key = entity_key.split("/")[0]

        if entity_key and entity_type in entities and entity_key not in entities[entity_type]:
            entities[entity_type].append(entity_key)

        # Track auto-included categories
        if entity_type == "categories" and entry.get("options", {}).get("auto_included"):
            auto_included_categories.add(entity_key)

    for etype, keys in entities.items():
        if keys:
            result[etype] = keys

    # Reconstruct manual_categories from categories minus auto-included
    if auto_included_categories and "categories" in result:
        result["manual_categories"] = [
            c for c in result["categories"] if c not in auto_included_categories
        ]

    return result


def _import_path_to_entity_key(import_path: str, entity_type: str) -> str:
    """Convert importFrom path to entity key."""
    prefix = entity_type + "/"
    relative = import_path[len(prefix) :] if import_path.startswith(prefix) else import_path
    return relative.removesuffix(".wikitext")


# ─── Dispatch by entity type ────────────────────────────────────────────────

_WIKITEXT_PARSERS: dict[str, Any] = {
    "categories": parse_category_wikitext,
    "properties": parse_property_wikitext,
    "subobjects": parse_subobject_wikitext,
    "templates": parse_template_wikitext,
    "resources": parse_resource_wikitext,
}


def parse_wikitext(wikitext: str, entity_type: str, entity_key: str) -> dict[str, Any]:
    """Parse a wikitext file into a structured dict, dispatching by entity type.

    For dashboards, use parse_dashboard_page() directly since they need
    multi-file assembly by the caller.
    """
    parser = _WIKITEXT_PARSERS.get(entity_type)
    if not parser:
        raise ValueError(f"Unknown entity type for wikitext parsing: {entity_type}")
    result: dict[str, Any] = parser(wikitext, entity_key)
    return result
