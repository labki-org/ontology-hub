"""Inheritance resolution service for category entities.

Resolves full inheritance chain for a category, returning nodes and edges
suitable for React Flow graph visualization.
"""

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.entity import Entity, EntityType
from app.schemas.entity import InheritanceEdge, InheritanceNode, InheritanceResponse


async def get_inheritance_chain(
    session: AsyncSession,
    entity_id: str,
) -> InheritanceResponse:
    """Resolve full inheritance chain for a category.

    Returns nodes (categories) and edges (parent relationships)
    for React Flow graph visualization.

    Args:
        session: Database session
        entity_id: Target category entity_id

    Returns:
        InheritanceResponse with nodes, edges, and has_circular flag

    Raises:
        ValueError: If entity_id is not a category or doesn't exist
    """
    # First, verify the target entity exists and is a category
    query = select(Entity).where(
        Entity.entity_type == EntityType.CATEGORY,
        Entity.entity_id == entity_id,
        Entity.deleted_at.is_(None),
    )
    result = await session.execute(query)
    target_entity = result.scalar_one_or_none()

    if not target_entity:
        raise ValueError(f"Category not found: {entity_id}")

    # Track visited nodes to detect circular references
    visited: set[str] = set()
    nodes: list[InheritanceNode] = []
    edges: list[InheritanceEdge] = []
    has_circular = False

    # Build nodes and edges by traversing parents and finding children
    async def add_node(eid: str, is_current: bool = False) -> Entity | None:
        """Add a node for the given entity_id if not already visited."""
        nonlocal has_circular

        if eid in visited:
            has_circular = True
            return None

        visited.add(eid)

        # Fetch the entity
        query = select(Entity).where(
            Entity.entity_type == EntityType.CATEGORY,
            Entity.entity_id == eid,
            Entity.deleted_at.is_(None),
        )
        result = await session.execute(query)
        entity = result.scalar_one_or_none()

        if entity:
            nodes.append(
                InheritanceNode(
                    id=entity.entity_id,
                    label=entity.label,
                    entity_id=entity.entity_id,
                    is_current=is_current,
                )
            )

        return entity

    # Start with target entity
    await add_node(entity_id, is_current=True)

    # Resolve parents (ancestors) - recursive traversal
    async def resolve_parents(eid: str) -> None:
        """Recursively resolve parent categories."""
        query = select(Entity).where(
            Entity.entity_type == EntityType.CATEGORY,
            Entity.entity_id == eid,
            Entity.deleted_at.is_(None),
        )
        result = await session.execute(query)
        entity = result.scalar_one_or_none()

        if not entity:
            return

        schema = entity.schema_definition or {}
        parent_id = schema.get("parent")

        if parent_id and isinstance(parent_id, str):
            # Add edge from child to parent
            edges.append(InheritanceEdge(source=eid, target=parent_id))

            # Add parent node if not visited
            parent_entity = await add_node(parent_id)
            if parent_entity:
                # Recursively resolve grandparents
                await resolve_parents(parent_id)

    await resolve_parents(entity_id)

    # Find children - categories where schema_definition["parent"] == entity_id
    query = select(Entity).where(
        Entity.entity_type == EntityType.CATEGORY,
        Entity.deleted_at.is_(None),
    )
    result = await session.execute(query)
    all_categories = result.scalars().all()

    for category in all_categories:
        if category.entity_id in visited:
            continue

        schema = category.schema_definition or {}
        parent_id = schema.get("parent")

        if parent_id == entity_id:
            # This category is a direct child
            await add_node(category.entity_id)
            edges.append(InheritanceEdge(source=category.entity_id, target=entity_id))

    return InheritanceResponse(
        nodes=nodes,
        edges=edges,
        has_circular=has_circular,
    )
