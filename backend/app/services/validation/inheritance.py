"""Circular inheritance detection using Python graphlib."""

from graphlib import CycleError, TopologicalSorter

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.draft import DraftPayload
from app.models.entity import Entity, EntityType
from app.schemas.validation import ValidationResult


async def check_circular_inheritance(
    payload: DraftPayload,
    session: AsyncSession,
) -> list[ValidationResult]:
    """Detect circular inheritance in category parent relationships.

    Checks the full inheritance graph including both canonical and draft categories.
    Uses Python's graphlib.TopologicalSorter for cycle detection.

    Args:
        payload: Draft payload containing categories
        session: Database session for canonical category lookup

    Returns:
        List of ValidationResult for any circular dependencies found
    """
    results: list[ValidationResult] = []

    # Build map of draft category parents
    draft_parents: dict[str, str | None] = {}
    for category in payload.entities.categories:
        draft_parents[category.entity_id] = category.schema_definition.get("parent")

    # Fetch canonical category parents (not in draft)
    stmt = select(Entity).where(
        Entity.entity_type == EntityType.CATEGORY, Entity.deleted_at.is_(None)
    )
    result = await session.execute(stmt)
    canonical_categories = result.scalars().all()

    canonical_parents: dict[str, str | None] = {}
    for cat in canonical_categories:
        if cat.entity_id not in draft_parents:
            canonical_parents[cat.entity_id] = cat.schema_definition.get("parent")

    # Combined parent map (draft overrides canonical)
    all_parents = {**canonical_parents, **draft_parents}

    # Build graph: child -> {parents}
    # TopologicalSorter expects node -> {dependencies} format
    graph: dict[str, set[str]] = {}
    for category_id, parent in all_parents.items():
        if parent:
            graph[category_id] = {parent}
        else:
            graph[category_id] = set()

    # Use TopologicalSorter for cycle detection
    ts = TopologicalSorter(graph)

    try:
        ts.prepare()  # Raises CycleError if cycle exists
    except CycleError as e:
        # e.args[1] contains the cycle path
        cycle_path = e.args[1]
        cycle_str = " -> ".join(cycle_path)

        # Report error for each category in the cycle that's in the draft
        for category_id in set(cycle_path):
            if category_id in draft_parents:
                results.append(
                    ValidationResult(
                        entity_type="category",
                        entity_id=category_id,
                        field="parent",
                        code="CIRCULAR_INHERITANCE",
                        message=f"Circular inheritance detected: {cycle_str}",
                        severity="error",
                    )
                )

    return results
