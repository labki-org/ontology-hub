"""Parse OntologySync wikitext files into structured entity dicts.

Wikitext files use semantic annotations within <!-- OntologySync Start/End --> blocks.
Each annotation is a [[Property::Value]] pair on its own line.

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

_ANNOTATION_RE = re.compile(r"^\[\[([^:\[\]]+)::(.+)\]\]$")
_CATEGORY_RE = re.compile(r"^\[\[Category:([^\]]+)\]\]$")

_START_MARKER = "<!-- OntologySync Start -->"
_END_MARKER = "<!-- OntologySync End -->"


def to_page_name(entity_key: str) -> str:
    """Convert an entity key (underscores) to a wiki page name (spaces)."""
    return entity_key.replace("_", " ")


def to_entity_key(page_name: str) -> str:
    """Convert a wiki page name (spaces) to an entity key (underscores)."""
    return page_name.replace(" ", "_")


def _strip_namespace(value: str, expected_ns: str) -> str:
    """Strip a namespace prefix and convert to entity key."""
    prefix = expected_ns + ":"
    stripped = value[len(prefix) :] if value.startswith(prefix) else value
    return to_entity_key(stripped)


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


def extract_annotations(wikitext: str) -> dict[str, list[str]]:
    """Extract semantic annotations from within OntologySync Start/End markers.

    Returns a dict mapping property names to lists of values.
    """
    annotations: dict[str, list[str]] = {}

    for trimmed, in_block in _iter_lines_by_block(wikitext):
        if not in_block:
            continue
        match = _ANNOTATION_RE.match(trimmed)
        if match:
            prop, value = match.group(1), match.group(2)
            annotations.setdefault(prop, []).append(value)

    return annotations


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


def _first(annotations: dict[str, list[str]], prop: str, default: str = "") -> str:
    """Get first value for a property, or default."""
    values = annotations.get(prop, [])
    return values[0] if values else default


def _all_stripped(
    annotations: dict[str, list[str]], prop: str, ns: str
) -> list[str]:
    """Get all values for a property, stripping namespace prefix."""
    return [_strip_namespace(v, ns) for v in annotations.get(prop, [])]


# ─── Entity-specific parsers ────────────────────────────────────────────────


def parse_category_wikitext(wikitext: str, entity_key: str) -> dict[str, Any]:
    """Parse category wikitext into dict matching the JSON format."""
    ann = extract_annotations(wikitext)

    result: dict[str, Any] = {
        "id": entity_key,
        "label": _first(ann, "Display label", to_page_name(entity_key)),
        "description": _first(ann, "Has description", ""),
    }

    parents = _all_stripped(ann, "Has parent category", "Category")
    if parents:
        result["parents"] = parents

    req_props = _all_stripped(ann, "Has required property", "Property")
    if req_props:
        result["required_properties"] = req_props

    opt_props = _all_stripped(ann, "Has optional property", "Property")
    if opt_props:
        result["optional_properties"] = opt_props

    req_subs = _all_stripped(ann, "Has required subobject", "Subobject")
    if req_subs:
        result["required_subobjects"] = req_subs

    opt_subs = _all_stripped(ann, "Has optional subobject", "Subobject")
    if opt_subs:
        result["optional_subobjects"] = opt_subs

    return result


def parse_property_wikitext(wikitext: str, entity_key: str) -> dict[str, Any]:
    """Parse property wikitext into dict matching the JSON format."""
    ann = extract_annotations(wikitext)

    result: dict[str, Any] = {
        "id": entity_key,
        "label": _first(ann, "Display label", to_page_name(entity_key)),
        "description": _first(ann, "Has description", ""),
        "datatype": _first(ann, "Has type", ""),
        "cardinality": "multiple"
        if _first(ann, "Allows multiple values") == "true"
        else "single",
    }

    allowed_vals = ann.get("Allows value")
    if allowed_vals:
        result["allowed_values"] = allowed_vals

    from_cat = _first(ann, "Allows value from category")
    if from_cat:
        result["Allows_value_from_category"] = _strip_namespace(
            from_cat, "Category"
        )

    pattern = _first(ann, "Allows pattern")
    if pattern:
        result["allowed_pattern"] = pattern

    value_list = _first(ann, "Allows value list")
    if value_list:
        result["allowed_value_list"] = value_list

    display_units = ann.get("Display units")
    if display_units:
        result["display_units"] = display_units

    precision = _first(ann, "Display precision")
    if precision:
        result["display_precision"] = int(precision)

    unique = _first(ann, "Has unique values")
    if unique == "true":
        result["unique_values"] = True

    template = _first(ann, "Has template")
    if template:
        result["has_display_template"] = _strip_namespace(template, "Template")

    parent_prop = _first(ann, "Subproperty of")
    if parent_prop:
        result["parent_property"] = _strip_namespace(parent_prop, "Property")

    return result


def parse_subobject_wikitext(wikitext: str, entity_key: str) -> dict[str, Any]:
    """Parse subobject wikitext into dict matching the JSON format."""
    ann = extract_annotations(wikitext)

    result: dict[str, Any] = {
        "id": entity_key,
        "label": _first(ann, "Display label", to_page_name(entity_key)),
        "description": _first(ann, "Has description", ""),
    }

    req_props = _all_stripped(ann, "Has required property", "Property")
    if req_props:
        result["required_properties"] = req_props

    opt_props = _all_stripped(ann, "Has optional property", "Property")
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

    Needs raw line indices (unlike extract_annotations/extract_categories),
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
    ann = extract_annotations(wikitext)
    categories = extract_categories(wikitext)

    # Find all content categories (non-management)
    content_categories = [
        to_entity_key(c) for c in categories if not c.startswith("OntologySync-managed")
    ]

    result: dict[str, Any] = {
        "id": entity_key,
        "label": _first(ann, "Display label", to_page_name(entity_key.split("/")[-1])),
        "description": _first(ann, "Has description", ""),
        "categories": content_categories,
    }

    # Add dynamic property fields
    metadata_keys = {"Display label", "Has description"}
    for prop, values in ann.items():
        if prop in metadata_keys:
            continue
        key = to_entity_key(prop)
        result[key] = values[0] if len(values) == 1 else values

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

    for etype, keys in entities.items():
        if keys:
            result[etype] = keys

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


def parse_wikitext(
    wikitext: str, entity_type: str, entity_key: str
) -> dict[str, Any]:
    """Parse a wikitext file into a structured dict, dispatching by entity type.

    For dashboards, use parse_dashboard_page() directly since they need
    multi-file assembly by the caller.
    """
    parser = _WIKITEXT_PARSERS.get(entity_type)
    if not parser:
        raise ValueError(f"Unknown entity type for wikitext parsing: {entity_type}")
    return parser(wikitext, entity_key)
