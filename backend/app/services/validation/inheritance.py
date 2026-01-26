"""Circular inheritance detection for v2 drafts.

Uses Python graphlib for cycle detection in category parent graphs.
"""

from graphlib import CycleError, TopologicalSorter

from app.schemas.validation import ValidationResultV2


def check_circular_inheritance_v2(
    effective_entities: dict[str, dict[str, dict]],
) -> list[ValidationResultV2]:
    """Detect circular inheritance in category parent relationships.

    Checks the full inheritance graph from effective entities (includes draft changes).
    Uses Python's graphlib.TopologicalSorter for cycle detection.

    Args:
        effective_entities: Dict like {"category": {"Person": {...}, ...}, ...}

    Returns:
        List of ValidationResultV2 for any circular dependencies found
    """
    results: list[ValidationResultV2] = []

    # Get all categories from effective entities
    categories = effective_entities.get("category", {})

    # Build parent map
    parent_map: dict[str, list[str]] = {}
    for entity_key, category_json in categories.items():
        # Skip deleted entities
        if category_json.get("_deleted"):
            continue

        # v2 uses "parents" array (multiple inheritance)
        parents = category_json.get("parents", [])
        parent_map[entity_key] = parents

    # Build graph: child -> {parents} for TopologicalSorter
    # TopologicalSorter expects node -> {dependencies} format
    graph: dict[str, set[str]] = {}
    for category_key, parents in parent_map.items():
        graph[category_key] = set(parents) if parents else set()

    # Use TopologicalSorter for cycle detection
    ts = TopologicalSorter(graph)

    try:
        ts.prepare()  # Raises CycleError if cycle exists
    except CycleError as e:
        # Extract cycle path from CycleError
        # e.args[1] contains the cycle as a tuple
        cycle_nodes = e.args[1] if len(e.args) > 1 else []

        if cycle_nodes:
            # Create cycle path string
            cycle_path = list(cycle_nodes)
            cycle_path.append(cycle_path[0])  # Close the cycle
            cycle_str = " -> ".join(cycle_path)

            # Report error for each category in the cycle
            for category_key in set(cycle_nodes):
                results.append(
                    ValidationResultV2(
                        entity_type="category",
                        entity_key=category_key,
                        field_path="/parents",
                        code="CIRCULAR_INHERITANCE",
                        message=f"Circular inheritance detected: {cycle_str}",
                        severity="error",
                    )
                )

    return results
