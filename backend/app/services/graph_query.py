"""Graph query service for neighborhood and module-scoped visualization.

This service provides graph traversal queries using recursive CTEs for
neighborhood graphs (GRP-01) and module-scoped graphs (GRP-02). It includes
module membership for hull rendering (GRP-03) and applies draft overlay
for change status badges (GRP-04).
"""

from typing import Optional

from sqlalchemy import text
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.v2 import Category, CategoryParent, Module, ModuleEntity, EntityType
from app.schemas.graph import GraphEdge, GraphNode, GraphResponse
from app.services.draft_overlay import DraftOverlayService


class GraphQueryService:
    """Service for graph traversal queries supporting visualization.

    Provides neighborhood traversal using recursive CTEs and module-scoped
    queries. All results include module membership for hull rendering and
    apply draft overlay for change status when a draft context is provided.

    Usage:
        service = GraphQueryService(session, draft_overlay)
        graph = await service.get_neighborhood_graph("Person", depth=2)
    """

    def __init__(
        self, session: AsyncSession, draft_overlay: DraftOverlayService
    ) -> None:
        """Initialize graph query service.

        Args:
            session: Async database session
            draft_overlay: Draft overlay service for change status computation
        """
        self.session = session
        self.draft_overlay = draft_overlay

    async def get_neighborhood_graph(
        self,
        entity_key: str,
        entity_type: str = "category",
        depth: int = 2,
    ) -> GraphResponse:
        """Get neighborhood graph for entity within specified depth (GRP-01).

        Returns nodes and edges for ancestors and descendants up to depth levels.
        Includes module membership for hull rendering (GRP-03).
        Applies draft overlay for change_status (GRP-04).

        Args:
            entity_key: Starting entity key (e.g., "Person")
            entity_type: Type of starting entity (default "category")
            depth: Max traversal depth (default 2)

        Returns:
            GraphResponse with nodes, edges, and cycle detection flag

        Raises:
            ValueError: If starting entity not found
        """
        if entity_type != "category":
            # For now, only category graphs are supported
            raise ValueError(f"Entity type '{entity_type}' not supported for graph queries")

        # Verify starting entity exists
        start_query = select(Category).where(Category.entity_key == entity_key)
        result = await self.session.execute(start_query)
        start_category = result.scalar_one_or_none()

        if not start_category:
            # Check if it's a draft-created category
            draft_creates = await self.draft_overlay.get_draft_creates("category")
            draft_match = next(
                (c for c in draft_creates if c.get("entity_key") == entity_key),
                None,
            )
            if not draft_match:
                raise ValueError(f"Category '{entity_key}' not found")

        # Execute recursive CTE for neighborhood traversal
        # The CTE finds all ancestors and descendants within depth levels
        # Path array prevents infinite loops from circular inheritance
        cte_query = text("""
            WITH RECURSIVE neighborhood AS (
                -- Base: starting category
                SELECT c.id, c.entity_key, c.label, 0 as depth, 'start' as direction, ARRAY[c.id] as path
                FROM categories c WHERE c.entity_key = :entity_key

                UNION ALL

                -- Ancestors (parents)
                SELECT c.id, c.entity_key, c.label, n.depth + 1, 'ancestor'::text, n.path || c.id
                FROM categories c
                JOIN category_parent cp ON cp.parent_id = c.id
                JOIN neighborhood n ON n.id = cp.category_id
                WHERE n.depth < :max_depth AND NOT c.id = ANY(n.path)

                UNION ALL

                -- Descendants (children)
                SELECT c.id, c.entity_key, c.label, n.depth + 1, 'descendant'::text, n.path || c.id
                FROM categories c
                JOIN category_parent cp ON cp.category_id = c.id
                JOIN neighborhood n ON n.id = cp.parent_id
                WHERE n.depth < :max_depth AND NOT c.id = ANY(n.path)
            )
            SELECT DISTINCT ON (id) id, entity_key, label, depth
            FROM neighborhood ORDER BY id, depth
        """)

        result = await self.session.execute(
            cte_query, {"entity_key": entity_key, "max_depth": depth}
        )
        rows = result.fetchall()

        # Collect entity keys for batch operations
        entity_keys = [row.entity_key for row in rows]

        # Add draft-created categories that should be in the neighborhood
        # (categories created in draft that relate to existing categories)
        draft_creates = await self.draft_overlay.get_draft_creates("category")
        for draft_cat in draft_creates:
            draft_key = draft_cat.get("entity_key")
            if draft_key and draft_key not in entity_keys:
                # Check if this draft category has a parent in our neighborhood
                parents = draft_cat.get("parents", [])
                if any(p in entity_keys for p in parents):
                    entity_keys.append(draft_key)

        # Batch load module membership
        module_membership = await self._get_module_membership(entity_keys, entity_type)

        # Build nodes with draft overlay applied
        nodes: list[GraphNode] = []
        has_cycles = False

        for row in rows:
            # Get canonical category for overlay
            cat_query = select(Category).where(Category.entity_key == row.entity_key)
            cat_result = await self.session.execute(cat_query)
            category = cat_result.scalar_one_or_none()

            # Apply draft overlay to get effective data with change_status
            effective = await self.draft_overlay.apply_overlay(
                category, "category", row.entity_key
            )

            change_status = None
            if effective:
                change_status = effective.get("_change_status")

            nodes.append(
                GraphNode(
                    id=row.entity_key,
                    label=row.label,
                    entity_type=entity_type,
                    depth=row.depth,
                    modules=module_membership.get(row.entity_key, []),
                    change_status=change_status,
                )
            )

        # Add draft-created categories as nodes
        for draft_cat in draft_creates:
            draft_key = draft_cat.get("entity_key")
            if draft_key in entity_keys and not any(n.id == draft_key for n in nodes):
                nodes.append(
                    GraphNode(
                        id=draft_key,
                        label=draft_cat.get("label", draft_key),
                        entity_type=entity_type,
                        depth=1,  # Draft-created are adjacent to existing
                        modules=module_membership.get(draft_key, []),
                        change_status="added",
                    )
                )

        # Build edges from category_parent relationships
        edges = await self._get_edges_for_categories(entity_keys)

        # Add edges from draft-created categories
        for draft_cat in draft_creates:
            draft_key = draft_cat.get("entity_key")
            if draft_key in entity_keys:
                parents = draft_cat.get("parents", [])
                for parent_key in parents:
                    if parent_key in entity_keys:
                        edges.append(
                            GraphEdge(
                                source=draft_key,
                                target=parent_key,
                                edge_type="parent",
                            )
                        )

        # Check for cycles by looking for duplicate nodes in original CTE
        # (if any path contained a cycle, the CTE would have been truncated)
        cycle_check_query = text("""
            WITH RECURSIVE cycle_check AS (
                SELECT c.id, ARRAY[c.id] as path, false as has_cycle
                FROM categories c WHERE c.entity_key = :entity_key

                UNION ALL

                SELECT c.id, cc.path || c.id, c.id = ANY(cc.path)
                FROM categories c
                JOIN category_parent cp ON cp.parent_id = c.id
                JOIN cycle_check cc ON cc.id = cp.category_id
                WHERE array_length(cc.path, 1) < :max_depth + 5 AND NOT cc.has_cycle
            )
            SELECT EXISTS(SELECT 1 FROM cycle_check WHERE has_cycle) as has_cycles
        """)

        cycle_result = await self.session.execute(
            cycle_check_query, {"entity_key": entity_key, "max_depth": depth}
        )
        cycle_row = cycle_result.fetchone()
        has_cycles = bool(cycle_row and cycle_row.has_cycles)

        return GraphResponse(nodes=nodes, edges=edges, has_cycles=has_cycles)

    async def get_module_graph(
        self,
        module_key: str,
    ) -> GraphResponse:
        """Get graph of all entities in a module (GRP-02).

        Returns nodes and edges for all entities in the module.
        Includes module membership for hull rendering (GRP-03).
        Applies draft overlay for change_status (GRP-04).

        Args:
            module_key: Module entity key to get graph for

        Returns:
            GraphResponse with all module entities as nodes

        Raises:
            ValueError: If module not found
        """
        # Verify module exists
        module_query = select(Module).where(Module.entity_key == module_key)
        result = await self.session.execute(module_query)
        module = result.scalar_one_or_none()

        if not module:
            raise ValueError(f"Module '{module_key}' not found")

        # Get all category entity_keys in this module
        membership_query = select(ModuleEntity.entity_key).where(
            ModuleEntity.module_id == module.id,
            ModuleEntity.entity_type == EntityType.CATEGORY,
        )
        result = await self.session.execute(membership_query)
        entity_keys = [row[0] for row in result.fetchall()]

        if not entity_keys:
            return GraphResponse(nodes=[], edges=[], has_cycles=False)

        # Get category data for all module entities
        categories_query = select(Category).where(Category.entity_key.in_(entity_keys))
        result = await self.session.execute(categories_query)
        categories = result.scalars().all()

        # Batch load module membership (categories may belong to multiple modules)
        module_membership = await self._get_module_membership(entity_keys, "category")

        # Build nodes with draft overlay applied
        nodes: list[GraphNode] = []
        for category in categories:
            # Apply draft overlay to get effective data with change_status
            effective = await self.draft_overlay.apply_overlay(
                category, "category", category.entity_key
            )

            change_status = None
            if effective:
                change_status = effective.get("_change_status")

            nodes.append(
                GraphNode(
                    id=category.entity_key,
                    label=category.label,
                    entity_type="category",
                    depth=None,  # No depth concept in module graph
                    modules=module_membership.get(category.entity_key, []),
                    change_status=change_status,
                )
            )

        # Add draft-created categories that belong to this module
        draft_creates = await self.draft_overlay.get_draft_creates("category")
        for draft_cat in draft_creates:
            draft_key = draft_cat.get("entity_key")
            # Check if draft category declares membership in this module
            # (Draft-created entities would declare their module in canonical_json)
            draft_modules = draft_cat.get("modules", [])
            if module_key in draft_modules or draft_key in entity_keys:
                if not any(n.id == draft_key for n in nodes):
                    entity_keys.append(draft_key)
                    nodes.append(
                        GraphNode(
                            id=draft_key,
                            label=draft_cat.get("label", draft_key),
                            entity_type="category",
                            depth=None,
                            modules=module_membership.get(draft_key, [module_key]),
                            change_status="added",
                        )
                    )

        # Build edges from category_parent relationships
        edges = await self._get_edges_for_categories(entity_keys)

        # Add edges from draft-created categories
        for draft_cat in draft_creates:
            draft_key = draft_cat.get("entity_key")
            if draft_key in entity_keys:
                parents = draft_cat.get("parents", [])
                for parent_key in parents:
                    if parent_key in entity_keys:
                        edges.append(
                            GraphEdge(
                                source=draft_key,
                                target=parent_key,
                                edge_type="parent",
                            )
                        )

        # Check for cycles within module graph
        has_cycles = await self._check_cycles_in_subgraph(entity_keys)

        return GraphResponse(nodes=nodes, edges=edges, has_cycles=has_cycles)

    async def _get_module_membership(
        self,
        entity_keys: list[str],
        entity_type: str = "category",
    ) -> dict[str, list[str]]:
        """Batch load module membership for entities to avoid N+1 queries.

        Args:
            entity_keys: List of entity keys to look up
            entity_type: Entity type for filtering (default "category")

        Returns:
            Dict mapping entity_key to list of module entity_keys
        """
        if not entity_keys:
            return {}

        # Map EntityType string to enum
        try:
            etype = EntityType(entity_type)
        except ValueError:
            return {}

        # Query module membership with module details
        query = (
            select(ModuleEntity.entity_key, Module.entity_key.label("module_key"))
            .join(Module, Module.id == ModuleEntity.module_id)
            .where(
                ModuleEntity.entity_key.in_(entity_keys),
                ModuleEntity.entity_type == etype,
            )
        )

        result = await self.session.execute(query)
        rows = result.fetchall()

        # Group by entity_key
        membership: dict[str, list[str]] = {}
        for row in rows:
            entity_key = row.entity_key
            module_key = row.module_key
            if entity_key not in membership:
                membership[entity_key] = []
            membership[entity_key].append(module_key)

        return membership

    async def _get_edges_for_categories(
        self,
        entity_keys: list[str],
    ) -> list[GraphEdge]:
        """Get parent-child edges for a set of categories.

        Only returns edges where both source and target are in entity_keys.

        Args:
            entity_keys: List of category entity keys

        Returns:
            List of GraphEdge objects representing parent relationships
        """
        if not entity_keys:
            return []

        # Query edges where both category and parent are in our set
        edge_query = (
            select(
                Category.entity_key.label("child_key"),
                text("p.entity_key as parent_key"),
            )
            .join(CategoryParent, CategoryParent.category_id == Category.id)
            .join(
                text("categories p"),
                text("p.id = category_parent.parent_id"),
            )
            .where(
                Category.entity_key.in_(entity_keys),
                text("p.entity_key IN :parent_keys"),
            )
        )

        # Execute with parameter binding
        result = await self.session.execute(
            edge_query, {"parent_keys": tuple(entity_keys)}
        )
        rows = result.fetchall()

        return [
            GraphEdge(source=row.child_key, target=row.parent_key, edge_type="parent")
            for row in rows
        ]

    async def _check_cycles_in_subgraph(
        self,
        entity_keys: list[str],
    ) -> bool:
        """Check if there are any cycles in a subgraph.

        Args:
            entity_keys: List of category entity keys defining the subgraph

        Returns:
            True if cycles detected, False otherwise
        """
        if not entity_keys:
            return False

        # For each entity, trace ancestors looking for cycles
        cycle_query = text("""
            WITH RECURSIVE ancestors AS (
                SELECT c.id, c.entity_key, ARRAY[c.id] as path, false as has_cycle
                FROM categories c
                WHERE c.entity_key = ANY(:entity_keys)

                UNION ALL

                SELECT p.id, p.entity_key, a.path || p.id, p.id = ANY(a.path)
                FROM categories p
                JOIN category_parent cp ON cp.parent_id = p.id
                JOIN ancestors a ON a.id = cp.category_id
                WHERE array_length(a.path, 1) < 50 AND NOT a.has_cycle
            )
            SELECT EXISTS(SELECT 1 FROM ancestors WHERE has_cycle) as has_cycles
        """)

        result = await self.session.execute(
            cycle_query, {"entity_keys": entity_keys}
        )
        row = result.fetchone()
        return bool(row and row.has_cycles)
