"""Graph query service for neighborhood and module-scoped visualization.

This service provides graph traversal queries using recursive CTEs for
neighborhood graphs (GRP-01) and module-scoped graphs (GRP-02). It includes
module membership for hull rendering (GRP-03) and applies draft overlay
for change status badges (GRP-04).
"""

import uuid
from typing import Optional

from sqlalchemy import text
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.v2 import Category, CategoryParent, Module, ModuleEntity, Property, Subobject, Template
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
        # Dispatch to type-specific neighborhood handlers
        if entity_type == "category":
            return await self._get_category_neighborhood(entity_key, depth)
        elif entity_type == "property":
            return await self._get_property_neighborhood(entity_key, depth)
        elif entity_type == "subobject":
            return await self._get_subobject_neighborhood(entity_key, depth)
        elif entity_type == "template":
            return await self._get_template_neighborhood(entity_key, depth)
        elif entity_type == "module":
            return await self._get_module_neighborhood(entity_key, depth)
        else:
            raise ValueError(f"Entity type '{entity_type}' not supported for graph queries")

    async def _get_category_neighborhood(
        self,
        entity_key: str,
        depth: int,
    ) -> GraphResponse:
        """Get neighborhood graph for a category.

        Returns nodes and edges for ancestors, descendants, properties, and subobjects.

        Args:
            entity_key: Category entity key
            depth: Max traversal depth

        Returns:
            GraphResponse with nodes, edges, and cycle detection flag
        """
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

        # Execute recursive CTEs for neighborhood traversal
        # Uses separate CTEs for ancestors and descendants (PostgreSQL limitation)
        # Path array prevents infinite loops from circular inheritance
        cte_query = text("""
            WITH RECURSIVE
            -- Base: starting category
            start_cat AS (
                SELECT c.id, c.entity_key, c.label
                FROM categories c WHERE c.entity_key = :entity_key
            ),
            -- Ancestors (parents, grandparents, etc.)
            ancestors AS (
                SELECT c.id, c.entity_key, c.label, 1 as depth, ARRAY[c.id] as path
                FROM categories c
                JOIN category_parent cp ON cp.parent_id = c.id
                JOIN start_cat s ON s.id = cp.category_id

                UNION ALL

                SELECT c.id, c.entity_key, c.label, a.depth + 1, a.path || c.id
                FROM categories c
                JOIN category_parent cp ON cp.parent_id = c.id
                JOIN ancestors a ON a.id = cp.category_id
                WHERE a.depth < :max_depth AND NOT c.id = ANY(a.path)
            ),
            -- Descendants (children, grandchildren, etc.)
            descendants AS (
                SELECT c.id, c.entity_key, c.label, 1 as depth, ARRAY[c.id] as path
                FROM categories c
                JOIN category_parent cp ON cp.category_id = c.id
                JOIN start_cat s ON s.id = cp.parent_id

                UNION ALL

                SELECT c.id, c.entity_key, c.label, d.depth + 1, d.path || c.id
                FROM categories c
                JOIN category_parent cp ON cp.category_id = c.id
                JOIN descendants d ON d.id = cp.parent_id
                WHERE d.depth < :max_depth AND NOT c.id = ANY(d.path)
            ),
            -- Combine all nodes
            neighborhood AS (
                SELECT id, entity_key, label, 0 as depth FROM start_cat
                UNION
                SELECT id, entity_key, label, depth FROM ancestors
                UNION
                SELECT id, entity_key, label, depth FROM descendants
            )
            SELECT DISTINCT ON (id) id, entity_key, label, depth
            FROM neighborhood ORDER BY id, depth
        """)

        result = await self.session.execute(
            cte_query, {"entity_key": entity_key, "max_depth": depth}
        )
        rows = result.fetchall()

        # Handle isolated draft-created entities (GRAPH-05)
        # If CTE returned no rows but entity exists in draft creates, it's an isolated node
        if not rows:
            draft_creates = await self.draft_overlay.get_draft_creates("category")
            draft_match = next(
                (c for c in draft_creates if c.get("entity_key") == entity_key),
                None,
            )
            if draft_match:
                # Return isolated draft node as single-node graph
                return GraphResponse(
                    nodes=[
                        GraphNode(
                            id=entity_key,
                            label=draft_match.get("label", entity_key),
                            entity_type="category",
                            depth=0,
                            modules=[],
                            change_status="added",
                        )
                    ],
                    edges=[],
                    has_cycles=False,
                )

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
        module_membership = await self._get_module_membership(entity_keys, "category")

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
                    entity_type="category",
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
                        entity_type="category",
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

        # Add property nodes and edges for categories in the neighborhood
        property_nodes, property_edges = await self._get_property_nodes_and_edges(
            entity_keys
        )
        nodes.extend(property_nodes)
        edges.extend(property_edges)

        # Add subobject nodes and edges for categories in the neighborhood
        subobject_nodes, subobject_edges = await self._get_subobject_nodes_and_edges(
            entity_keys
        )
        nodes.extend(subobject_nodes)
        edges.extend(subobject_edges)

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

    async def _get_property_neighborhood(
        self,
        entity_key: str,
        depth: int,
    ) -> GraphResponse:
        """Get neighborhood graph for a property.

        Shows the property as center node and categories that use this property.
        At depth > 1, includes parent categories of those categories.

        Args:
            entity_key: Property entity key
            depth: Max traversal depth

        Returns:
            GraphResponse with nodes and edges
        """
        # Verify property exists
        prop_query = select(Property).where(Property.entity_key == entity_key)
        result = await self.session.execute(prop_query)
        prop = result.scalar_one_or_none()

        if not prop:
            # Check draft creates
            draft_creates = await self.draft_overlay.get_draft_creates("property")
            draft_match = next(
                (p for p in draft_creates if p.get("entity_key") == entity_key),
                None,
            )
            if not draft_match:
                raise ValueError(f"Property '{entity_key}' not found")
            # Return isolated draft node
            return GraphResponse(
                nodes=[
                    GraphNode(
                        id=entity_key,
                        label=draft_match.get("label", entity_key),
                        entity_type="property",
                        depth=0,
                        modules=[],
                        change_status="added",
                    )
                ],
                edges=[],
                has_cycles=False,
            )

        # Get categories that use this property via category_property relationship
        category_query = text("""
            SELECT c.entity_key, c.label
            FROM categories c
            JOIN category_property cp ON cp.category_id = c.id
            JOIN properties p ON p.id = cp.property_id
            WHERE p.entity_key = :property_key
        """)
        result = await self.session.execute(category_query, {"property_key": entity_key})
        category_rows = result.fetchall()

        # Collect category keys
        category_keys = [row.entity_key for row in category_rows]

        # At depth > 1, include parent categories
        if depth > 1 and category_keys:
            parent_query = text("""
                WITH RECURSIVE ancestors AS (
                    SELECT c.id, c.entity_key, c.label, 1 as depth
                    FROM categories c
                    WHERE c.entity_key = ANY(:category_keys)

                    UNION ALL

                    SELECT p.id, p.entity_key, p.label, a.depth + 1
                    FROM categories p
                    JOIN category_parent cp ON cp.parent_id = p.id
                    JOIN ancestors a ON a.id = cp.category_id
                    WHERE a.depth < :max_depth
                )
                SELECT DISTINCT entity_key, label FROM ancestors
            """)
            result = await self.session.execute(
                parent_query, {"category_keys": category_keys, "max_depth": depth}
            )
            parent_rows = result.fetchall()
            for row in parent_rows:
                if row.entity_key not in category_keys:
                    category_keys.append(row.entity_key)

        # Build nodes list
        nodes: list[GraphNode] = []

        # Add property as center node
        prop_module_membership = await self._get_module_membership([entity_key], "property")
        effective = await self.draft_overlay.apply_overlay(prop, "property", entity_key)
        change_status = effective.get("_change_status") if effective else None

        nodes.append(
            GraphNode(
                id=entity_key,
                label=prop.label,
                entity_type="property",
                depth=0,
                modules=prop_module_membership.get(entity_key, []),
                change_status=change_status,
            )
        )

        # Add category nodes
        if category_keys:
            cat_module_membership = await self._get_module_membership(category_keys, "category")
            categories_query = select(Category).where(Category.entity_key.in_(category_keys))
            result = await self.session.execute(categories_query)
            categories = result.scalars().all()

            for cat in categories:
                effective = await self.draft_overlay.apply_overlay(cat, "category", cat.entity_key)
                change_status = effective.get("_change_status") if effective else None

                nodes.append(
                    GraphNode(
                        id=cat.entity_key,
                        label=cat.label,
                        entity_type="category",
                        depth=1,
                        modules=cat_module_membership.get(cat.entity_key, []),
                        change_status=change_status,
                    )
                )

        # Build edges: category -> property
        edges: list[GraphEdge] = []
        for row in category_rows:
            edges.append(
                GraphEdge(
                    source=row.entity_key,
                    target=entity_key,
                    edge_type="property",
                )
            )

        # Add parent edges between categories if depth > 1
        if depth > 1 and category_keys:
            parent_edges = await self._get_edges_for_categories(category_keys)
            edges.extend(parent_edges)

        return GraphResponse(nodes=nodes, edges=edges, has_cycles=False)

    async def _get_subobject_neighborhood(
        self,
        entity_key: str,
        depth: int,
    ) -> GraphResponse:
        """Get neighborhood graph for a subobject.

        Shows the subobject as center node and categories that reference it.
        At depth > 1, includes parent categories of those categories.

        Args:
            entity_key: Subobject entity key
            depth: Max traversal depth

        Returns:
            GraphResponse with nodes and edges
        """
        # Verify subobject exists
        subobj_query = select(Subobject).where(Subobject.entity_key == entity_key)
        result = await self.session.execute(subobj_query)
        subobj = result.scalar_one_or_none()

        if not subobj:
            # Check draft creates
            draft_creates = await self.draft_overlay.get_draft_creates("subobject")
            draft_match = next(
                (s for s in draft_creates if s.get("entity_key") == entity_key),
                None,
            )
            if not draft_match:
                raise ValueError(f"Subobject '{entity_key}' not found")
            # Return isolated draft node
            return GraphResponse(
                nodes=[
                    GraphNode(
                        id=entity_key,
                        label=draft_match.get("label", entity_key),
                        entity_type="subobject",
                        depth=0,
                        modules=[],
                        change_status="added",
                    )
                ],
                edges=[],
                has_cycles=False,
            )

        # Find categories that reference this subobject in their canonical_json
        # Check both optional_subobjects and required_subobjects
        categories_query = select(Category)
        result = await self.session.execute(categories_query)
        all_categories = result.scalars().all()

        referencing_categories: list[Category] = []
        for cat in all_categories:
            canonical = cat.canonical_json or {}
            optional = canonical.get("optional_subobjects", [])
            required = canonical.get("required_subobjects", [])
            all_subobjs = (optional if isinstance(optional, list) else []) + \
                         (required if isinstance(required, list) else [])
            if entity_key in all_subobjs:
                referencing_categories.append(cat)

        category_keys = [cat.entity_key for cat in referencing_categories]

        # At depth > 1, include parent categories
        if depth > 1 and category_keys:
            parent_query = text("""
                WITH RECURSIVE ancestors AS (
                    SELECT c.id, c.entity_key, c.label, 1 as depth
                    FROM categories c
                    WHERE c.entity_key = ANY(:category_keys)

                    UNION ALL

                    SELECT p.id, p.entity_key, p.label, a.depth + 1
                    FROM categories p
                    JOIN category_parent cp ON cp.parent_id = p.id
                    JOIN ancestors a ON a.id = cp.category_id
                    WHERE a.depth < :max_depth
                )
                SELECT DISTINCT entity_key, label FROM ancestors
            """)
            result = await self.session.execute(
                parent_query, {"category_keys": category_keys, "max_depth": depth}
            )
            parent_rows = result.fetchall()
            for row in parent_rows:
                if row.entity_key not in category_keys:
                    category_keys.append(row.entity_key)

        # Build nodes list
        nodes: list[GraphNode] = []

        # Add subobject as center node
        subobj_module_membership = await self._get_module_membership([entity_key], "subobject")
        effective = await self.draft_overlay.apply_overlay(subobj, "subobject", entity_key)
        change_status = effective.get("_change_status") if effective else None

        nodes.append(
            GraphNode(
                id=entity_key,
                label=subobj.label,
                entity_type="subobject",
                depth=0,
                modules=subobj_module_membership.get(entity_key, []),
                change_status=change_status,
            )
        )

        # Add category nodes
        if category_keys:
            cat_module_membership = await self._get_module_membership(category_keys, "category")
            categories_query = select(Category).where(Category.entity_key.in_(category_keys))
            result = await self.session.execute(categories_query)
            categories = result.scalars().all()

            for cat in categories:
                effective = await self.draft_overlay.apply_overlay(cat, "category", cat.entity_key)
                change_status = effective.get("_change_status") if effective else None

                nodes.append(
                    GraphNode(
                        id=cat.entity_key,
                        label=cat.label,
                        entity_type="category",
                        depth=1,
                        modules=cat_module_membership.get(cat.entity_key, []),
                        change_status=change_status,
                    )
                )

        # Build edges: category -> subobject
        edges: list[GraphEdge] = []
        for cat in referencing_categories:
            edges.append(
                GraphEdge(
                    source=cat.entity_key,
                    target=entity_key,
                    edge_type="subobject",
                )
            )

        # Add parent edges between categories if depth > 1
        if depth > 1 and category_keys:
            parent_edges = await self._get_edges_for_categories(category_keys)
            edges.extend(parent_edges)

        return GraphResponse(nodes=nodes, edges=edges, has_cycles=False)

    async def _get_template_neighborhood(
        self,
        entity_key: str,
        depth: int,
    ) -> GraphResponse:
        """Get neighborhood graph for a template.

        Shows the template as center node and other templates in the same module(s).
        Templates don't have direct relationships - they're grouped by module membership.

        Args:
            entity_key: Template entity key
            depth: Max traversal depth (used to limit number of related templates)

        Returns:
            GraphResponse with nodes (no edges between templates)
        """
        # Verify template exists
        template_query = select(Template).where(Template.entity_key == entity_key)
        result = await self.session.execute(template_query)
        template = result.scalar_one_or_none()

        if not template:
            # Check draft creates
            draft_creates = await self.draft_overlay.get_draft_creates("template")
            draft_match = next(
                (t for t in draft_creates if t.get("entity_key") == entity_key),
                None,
            )
            if not draft_match:
                raise ValueError(f"Template '{entity_key}' not found")
            # Return isolated draft node
            return GraphResponse(
                nodes=[
                    GraphNode(
                        id=entity_key,
                        label=draft_match.get("label", entity_key),
                        entity_type="template",
                        depth=0,
                        modules=[],
                        change_status="added",
                    )
                ],
                edges=[],
                has_cycles=False,
            )

        # Get module membership for this template
        template_module_membership = await self._get_module_membership([entity_key], "template")
        template_modules = template_module_membership.get(entity_key, [])

        # Build nodes list
        nodes: list[GraphNode] = []

        # Add template as center node
        effective = await self.draft_overlay.apply_overlay(template, "template", entity_key)
        change_status = effective.get("_change_status") if effective else None

        nodes.append(
            GraphNode(
                id=entity_key,
                label=template.label,
                entity_type="template",
                depth=0,
                modules=template_modules,
                change_status=change_status,
            )
        )

        # Find other templates in the same modules (limited to ~10 for performance)
        if template_modules:
            # Get module IDs for the template's modules
            module_query = select(Module.id, Module.entity_key).where(
                Module.entity_key.in_(template_modules)
            )
            result = await self.session.execute(module_query)
            module_rows = result.fetchall()
            module_ids = [row.id for row in module_rows]

            if module_ids:
                # Get other templates in those modules
                other_templates_query = (
                    select(ModuleEntity.entity_key)
                    .where(
                        ModuleEntity.module_id.in_(module_ids),
                        ModuleEntity.entity_type == "template",
                        ModuleEntity.entity_key != entity_key,
                    )
                    .limit(10)  # Limit for performance
                )
                result = await self.session.execute(other_templates_query)
                other_template_keys = [row[0] for row in result.fetchall()]

                if other_template_keys:
                    # Get template data
                    templates_query = select(Template).where(
                        Template.entity_key.in_(other_template_keys)
                    )
                    result = await self.session.execute(templates_query)
                    other_templates = result.scalars().all()

                    # Get module membership for other templates
                    other_module_membership = await self._get_module_membership(
                        other_template_keys, "template"
                    )

                    for tmpl in other_templates:
                        effective = await self.draft_overlay.apply_overlay(
                            tmpl, "template", tmpl.entity_key
                        )
                        change_status = effective.get("_change_status") if effective else None

                        nodes.append(
                            GraphNode(
                                id=tmpl.entity_key,
                                label=tmpl.label,
                                entity_type="template",
                                depth=1,
                                modules=other_module_membership.get(tmpl.entity_key, []),
                                change_status=change_status,
                            )
                        )

        # No edges between templates - they're grouped by module hulls
        return GraphResponse(nodes=nodes, edges=[], has_cycles=False)

    async def _get_module_neighborhood(
        self,
        entity_key: str,
        depth: int,
    ) -> GraphResponse:
        """Get neighborhood graph for a module.

        Reuses get_module_graph() to show all entities within the module.
        Modules are visualized as hulls around their contained entities.

        Args:
            entity_key: Module entity key
            depth: Max traversal depth (not used, included for interface consistency)

        Returns:
            GraphResponse with all module entities
        """
        # Reuse the module graph which shows all entities in the module
        # Modules are displayed as hulls, not as nodes themselves
        return await self.get_module_graph(entity_key)

    async def get_full_ontology_graph(self) -> GraphResponse:
        """Get the full ontology graph with all entities (GRP-05).

        Returns all categories, properties, subobjects, and templates with their
        relationships. Bundles are excluded. Modules are represented via hull
        membership on nodes.

        Returns:
            GraphResponse with all entities and relationships
        """
        nodes: list[GraphNode] = []
        edges: list[GraphEdge] = []

        # Get all categories
        categories_query = select(Category)
        result = await self.session.execute(categories_query)
        categories = result.scalars().all()

        category_keys = [c.entity_key for c in categories]

        # Get module membership for categories
        if category_keys:
            cat_module_membership = await self._get_module_membership(category_keys, "category")

            for cat in categories:
                effective = await self.draft_overlay.apply_overlay(cat, "category", cat.entity_key)
                change_status = effective.get("_change_status") if effective else None

                nodes.append(
                    GraphNode(
                        id=cat.entity_key,
                        label=cat.label,
                        entity_type="category",
                        depth=None,
                        modules=cat_module_membership.get(cat.entity_key, []),
                        change_status=change_status,
                    )
                )

            # Get parent edges between categories
            parent_edges = await self._get_edges_for_categories(category_keys)
            edges.extend(parent_edges)

        # Add draft-created categories
        draft_creates = await self.draft_overlay.get_draft_creates("category")
        for draft_cat in draft_creates:
            draft_key = draft_cat.get("entity_key")
            if draft_key and not any(n.id == draft_key for n in nodes):
                nodes.append(
                    GraphNode(
                        id=draft_key,
                        label=draft_cat.get("label", draft_key),
                        entity_type="category",
                        depth=None,
                        modules=[],
                        change_status="added",
                    )
                )
                # Add parent edges for draft categories
                parents = draft_cat.get("parents", [])
                for parent_key in parents:
                    edges.append(
                        GraphEdge(source=draft_key, target=parent_key, edge_type="parent")
                    )

        # Get all properties
        properties_query = select(Property)
        result = await self.session.execute(properties_query)
        properties = result.scalars().all()

        property_keys = [p.entity_key for p in properties]

        if property_keys:
            prop_module_membership = await self._get_module_membership(property_keys, "property")

            for prop in properties:
                effective = await self.draft_overlay.apply_overlay(prop, "property", prop.entity_key)
                change_status = effective.get("_change_status") if effective else None

                nodes.append(
                    GraphNode(
                        id=prop.entity_key,
                        label=prop.label,
                        entity_type="property",
                        depth=None,
                        modules=prop_module_membership.get(prop.entity_key, []),
                        change_status=change_status,
                    )
                )

            # Get property edges (category -> property)
            property_edge_query = text("""
                SELECT c.entity_key as category_key, p.entity_key as property_key
                FROM category_property cp
                JOIN categories c ON c.id = cp.category_id
                JOIN properties p ON p.id = cp.property_id
            """)
            result = await self.session.execute(property_edge_query)
            for row in result.fetchall():
                edges.append(
                    GraphEdge(source=row.category_key, target=row.property_key, edge_type="property")
                )

        # Get all subobjects
        subobjects_query = select(Subobject)
        result = await self.session.execute(subobjects_query)
        subobjects = result.scalars().all()

        subobject_keys = [s.entity_key for s in subobjects]

        if subobject_keys:
            subobj_module_membership = await self._get_module_membership(subobject_keys, "subobject")

            for subobj in subobjects:
                effective = await self.draft_overlay.apply_overlay(subobj, "subobject", subobj.entity_key)
                change_status = effective.get("_change_status") if effective else None

                nodes.append(
                    GraphNode(
                        id=subobj.entity_key,
                        label=subobj.label,
                        entity_type="subobject",
                        depth=None,
                        modules=subobj_module_membership.get(subobj.entity_key, []),
                        change_status=change_status,
                    )
                )

        # Get subobject edges from category canonical_json
        for cat in categories:
            canonical = cat.canonical_json or {}
            optional = canonical.get("optional_subobjects", [])
            required = canonical.get("required_subobjects", [])
            all_subobjs = (optional if isinstance(optional, list) else []) + \
                         (required if isinstance(required, list) else [])
            for subobj_key in all_subobjs:
                if subobj_key in subobject_keys:
                    edges.append(
                        GraphEdge(source=cat.entity_key, target=subobj_key, edge_type="subobject")
                    )

        # Get subobject -> property edges
        subobject_property_edge_query = text("""
            SELECT s.entity_key as subobject_key, p.entity_key as property_key
            FROM subobject_property sp
            JOIN subobjects s ON s.id = sp.subobject_id
            JOIN properties p ON p.id = sp.property_id
        """)
        result = await self.session.execute(subobject_property_edge_query)
        for row in result.fetchall():
            edges.append(
                GraphEdge(source=row.subobject_key, target=row.property_key, edge_type="subobject_property")
            )

        # Get all templates
        templates_query = select(Template)
        result = await self.session.execute(templates_query)
        templates = result.scalars().all()

        template_keys = [t.entity_key for t in templates]

        if template_keys:
            template_module_membership = await self._get_module_membership(template_keys, "template")

            for template in templates:
                effective = await self.draft_overlay.apply_overlay(template, "template", template.entity_key)
                change_status = effective.get("_change_status") if effective else None

                nodes.append(
                    GraphNode(
                        id=template.entity_key,
                        label=template.label,
                        entity_type="template",
                        depth=None,
                        modules=template_module_membership.get(template.entity_key, []),
                        change_status=change_status,
                    )
                )

        # Check for cycles in category hierarchy
        has_cycles = await self._check_cycles_in_subgraph(category_keys) if category_keys else False

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
        # entity_type is stored as string value (e.g., "category")
        membership_query = select(ModuleEntity.entity_key).where(
            ModuleEntity.module_id == module.id,
            ModuleEntity.entity_type == "category",
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

        # Add property nodes belonging to this module
        property_nodes, property_edges = await self._get_module_property_nodes(
            module.id, module_key
        )
        nodes.extend(property_nodes)
        edges.extend(property_edges)

        # Add subobject nodes belonging to this module
        subobject_nodes, subobject_edges = await self._get_module_subobject_nodes(
            module.id, module_key
        )
        nodes.extend(subobject_nodes)
        edges.extend(subobject_edges)

        # Add template nodes belonging to this module
        # Templates don't have direct relationships to categories - they're standalone
        template_nodes = await self._get_module_template_nodes(module.id, module_key)
        nodes.extend(template_nodes)

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

        # Query module membership with module details
        # entity_type is stored as string value (e.g., "category" not "CATEGORY")
        query = (
            select(ModuleEntity.entity_key, Module.entity_key.label("module_key"))
            .join(Module, Module.id == ModuleEntity.module_id)
            .where(
                ModuleEntity.entity_key.in_(entity_keys),
                ModuleEntity.entity_type == entity_type,
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

        # Use raw SQL for clarity with self-join on categories
        edge_query = text("""
            SELECT c.entity_key as child_key, p.entity_key as parent_key
            FROM categories c
            JOIN category_parent cp ON cp.category_id = c.id
            JOIN categories p ON p.id = cp.parent_id
            WHERE c.entity_key = ANY(:entity_keys)
              AND p.entity_key = ANY(:entity_keys)
        """)

        result = await self.session.execute(
            edge_query, {"entity_keys": entity_keys}
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

    async def _get_property_nodes_and_edges(
        self,
        category_keys: list[str],
    ) -> tuple[list[GraphNode], list[GraphEdge]]:
        """Get property nodes and edges for categories in the graph.

        Queries the category_property relationship table to find all properties
        directly assigned to the specified categories, then creates nodes and
        edges for visualization.

        Args:
            category_keys: List of category entity keys to get properties for

        Returns:
            Tuple of (property nodes, property edges)
        """
        if not category_keys:
            return [], []

        # Get properties for categories via category_property relationship
        property_query = text("""
            SELECT DISTINCT p.entity_key, p.label, c.entity_key as category_key
            FROM properties p
            JOIN category_property cp ON cp.property_id = p.id
            JOIN categories c ON c.id = cp.category_id
            WHERE c.entity_key = ANY(:category_keys)
        """)

        result = await self.session.execute(
            property_query, {"category_keys": category_keys}
        )
        rows = result.fetchall()

        if not rows:
            return [], []

        # Collect unique property keys for module membership lookup
        property_keys = list({row.entity_key for row in rows})

        # Batch load module membership for properties
        property_module_membership = await self._get_module_membership(
            property_keys, "property"
        )

        # Build property nodes with draft overlay
        nodes: list[GraphNode] = []
        seen_properties: set[str] = set()

        for row in rows:
            if row.entity_key in seen_properties:
                continue
            seen_properties.add(row.entity_key)

            # Get canonical property for overlay
            prop_query = select(Property).where(Property.entity_key == row.entity_key)
            prop_result = await self.session.execute(prop_query)
            prop = prop_result.scalar_one_or_none()

            # Apply draft overlay to get effective data with change_status
            effective = await self.draft_overlay.apply_overlay(
                prop, "property", row.entity_key
            )

            change_status = None
            if effective:
                change_status = effective.get("_change_status")

            nodes.append(
                GraphNode(
                    id=row.entity_key,
                    label=row.label,
                    entity_type="property",
                    depth=None,  # Properties don't have depth in neighborhood
                    modules=property_module_membership.get(row.entity_key, []),
                    change_status=change_status,
                )
            )

        # Build edges: category -> property with edge_type="property"
        edges: list[GraphEdge] = []
        for row in rows:
            edges.append(
                GraphEdge(
                    source=row.category_key,
                    target=row.entity_key,
                    edge_type="property",
                )
            )

        return nodes, edges

    async def _get_module_property_nodes(
        self,
        module_id: uuid.UUID,
        module_key: str,
    ) -> tuple[list[GraphNode], list[GraphEdge]]:
        """Get property nodes belonging to a module.

        Properties in module graphs don't have edges to categories - they're
        included as standalone module members for visualization.

        Args:
            module_id: Module database ID
            module_key: Module entity key

        Returns:
            Tuple of (property nodes, empty edges list)
        """
        # Get property entity_keys in this module
        membership_query = select(ModuleEntity.entity_key).where(
            ModuleEntity.module_id == module_id,
            ModuleEntity.entity_type == "property",
        )
        result = await self.session.execute(membership_query)
        property_keys = [row[0] for row in result.fetchall()]

        if not property_keys:
            return [], []

        # Get property data
        properties_query = select(Property).where(Property.entity_key.in_(property_keys))
        result = await self.session.execute(properties_query)
        properties = result.scalars().all()

        # Batch load module membership for properties
        property_module_membership = await self._get_module_membership(
            property_keys, "property"
        )

        # Build property nodes with draft overlay
        nodes: list[GraphNode] = []
        for prop in properties:
            # Apply draft overlay to get effective data with change_status
            effective = await self.draft_overlay.apply_overlay(
                prop, "property", prop.entity_key
            )

            change_status = None
            if effective:
                change_status = effective.get("_change_status")

            nodes.append(
                GraphNode(
                    id=prop.entity_key,
                    label=prop.label,
                    entity_type="property",
                    depth=None,
                    modules=property_module_membership.get(prop.entity_key, [module_key]),
                    change_status=change_status,
                )
            )

        # Properties in module graph don't have edges to categories
        # They're standalone module members
        return nodes, []

    async def _get_subobject_nodes_and_edges(
        self,
        category_keys: list[str],
    ) -> tuple[list[GraphNode], list[GraphEdge]]:
        """Get subobject nodes and edges for categories in the graph.

        Categories reference subobjects via their canonical_json fields:
        - optional_subobjects: list of subobject entity_keys
        - required_subobjects: list of subobject entity_keys

        Args:
            category_keys: List of category entity keys to get subobjects for

        Returns:
            Tuple of (subobject nodes, subobject edges)
        """
        if not category_keys:
            return [], []

        # Get categories with their canonical_json to extract subobject references
        categories_query = select(Category).where(
            Category.entity_key.in_(category_keys)
        )
        result = await self.session.execute(categories_query)
        categories = result.scalars().all()

        # Extract subobject references from canonical_json
        subobject_refs: dict[str, list[str]] = {}  # category_key -> [subobject_keys]
        all_subobject_keys: set[str] = set()

        for category in categories:
            canonical = category.canonical_json or {}
            subobj_keys = []

            # Check optional_subobjects
            optional = canonical.get("optional_subobjects", [])
            if isinstance(optional, list):
                subobj_keys.extend(optional)

            # Check required_subobjects
            required = canonical.get("required_subobjects", [])
            if isinstance(required, list):
                subobj_keys.extend(required)

            if subobj_keys:
                subobject_refs[category.entity_key] = subobj_keys
                all_subobject_keys.update(subobj_keys)

        if not all_subobject_keys:
            return [], []

        # Get subobject data
        subobjects_query = select(Subobject).where(
            Subobject.entity_key.in_(list(all_subobject_keys))
        )
        result = await self.session.execute(subobjects_query)
        subobjects = result.scalars().all()

        # Batch load module membership for subobjects
        subobject_module_membership = await self._get_module_membership(
            list(all_subobject_keys), "subobject"
        )

        # Build subobject nodes with draft overlay
        nodes: list[GraphNode] = []
        seen_subobjects: set[str] = set()

        for subobj in subobjects:
            if subobj.entity_key in seen_subobjects:
                continue
            seen_subobjects.add(subobj.entity_key)

            # Apply draft overlay to get effective data with change_status
            effective = await self.draft_overlay.apply_overlay(
                subobj, "subobject", subobj.entity_key
            )

            change_status = None
            if effective:
                change_status = effective.get("_change_status")

            nodes.append(
                GraphNode(
                    id=subobj.entity_key,
                    label=subobj.label,
                    entity_type="subobject",
                    depth=None,  # Subobjects don't have depth in neighborhood
                    modules=subobject_module_membership.get(subobj.entity_key, []),
                    change_status=change_status,
                )
            )

        # Build edges: category -> subobject with edge_type="subobject"
        edges: list[GraphEdge] = []
        for category_key, subobj_keys in subobject_refs.items():
            for subobj_key in subobj_keys:
                if subobj_key in seen_subobjects:  # Only add edge if subobject exists
                    edges.append(
                        GraphEdge(
                            source=category_key,
                            target=subobj_key,
                            edge_type="subobject",
                        )
                    )

        # Get subobject -> property edges and property nodes
        subobject_property_query = text("""
            SELECT s.entity_key as subobject_key, p.entity_key as property_key
            FROM subobject_property sp
            JOIN subobjects s ON s.id = sp.subobject_id
            JOIN properties p ON p.id = sp.property_id
            WHERE s.entity_key = ANY(:subobject_keys)
        """)
        result = await self.session.execute(
            subobject_property_query, {"subobject_keys": list(seen_subobjects)}
        )
        subobject_property_rows = result.fetchall()

        # Collect property keys and create edges
        property_keys_for_subobjects: set[str] = set()
        for row in subobject_property_rows:
            property_keys_for_subobjects.add(row.property_key)
            edges.append(
                GraphEdge(
                    source=row.subobject_key,
                    target=row.property_key,
                    edge_type="subobject_property",
                )
            )

        # Add property nodes if we have subobject properties
        if property_keys_for_subobjects:
            properties_query = select(Property).where(
                Property.entity_key.in_(list(property_keys_for_subobjects))
            )
            result = await self.session.execute(properties_query)
            properties = result.scalars().all()

            # Get module membership for these properties
            property_module_membership = await self._get_module_membership(
                list(property_keys_for_subobjects), "property"
            )

            for prop in properties:
                effective = await self.draft_overlay.apply_overlay(
                    prop, "property", prop.entity_key
                )
                change_status = None
                if effective:
                    change_status = effective.get("_change_status")

                nodes.append(
                    GraphNode(
                        id=prop.entity_key,
                        label=prop.label,
                        entity_type="property",
                        depth=None,
                        modules=property_module_membership.get(prop.entity_key, []),
                        change_status=change_status,
                    )
                )

        return nodes, edges

    async def _get_module_subobject_nodes(
        self,
        module_id: uuid.UUID,
        module_key: str,
    ) -> tuple[list[GraphNode], list[GraphEdge]]:
        """Get subobject nodes belonging to a module.

        Subobjects in module graphs don't have edges to categories - they're
        included as standalone module members for visualization.

        Args:
            module_id: Module database ID
            module_key: Module entity key

        Returns:
            Tuple of (subobject nodes, empty edges list)
        """
        # Get subobject entity_keys in this module
        membership_query = select(ModuleEntity.entity_key).where(
            ModuleEntity.module_id == module_id,
            ModuleEntity.entity_type == "subobject",
        )
        result = await self.session.execute(membership_query)
        subobject_keys = [row[0] for row in result.fetchall()]

        if not subobject_keys:
            return [], []

        # Get subobject data
        subobjects_query = select(Subobject).where(
            Subobject.entity_key.in_(subobject_keys)
        )
        result = await self.session.execute(subobjects_query)
        subobjects = result.scalars().all()

        # Batch load module membership for subobjects
        subobject_module_membership = await self._get_module_membership(
            subobject_keys, "subobject"
        )

        # Build subobject nodes with draft overlay
        nodes: list[GraphNode] = []
        for subobj in subobjects:
            # Apply draft overlay to get effective data with change_status
            effective = await self.draft_overlay.apply_overlay(
                subobj, "subobject", subobj.entity_key
            )

            change_status = None
            if effective:
                change_status = effective.get("_change_status")

            nodes.append(
                GraphNode(
                    id=subobj.entity_key,
                    label=subobj.label,
                    entity_type="subobject",
                    depth=None,
                    modules=subobject_module_membership.get(subobj.entity_key, [module_key]),
                    change_status=change_status,
                )
            )

        # Get subobject -> property edges
        edges: list[GraphEdge] = []
        subobject_property_query = text("""
            SELECT s.entity_key as subobject_key, p.entity_key as property_key
            FROM subobject_property sp
            JOIN subobjects s ON s.id = sp.subobject_id
            JOIN properties p ON p.id = sp.property_id
            WHERE s.entity_key = ANY(:subobject_keys)
        """)
        result = await self.session.execute(
            subobject_property_query, {"subobject_keys": subobject_keys}
        )
        subobject_property_rows = result.fetchall()

        # Collect property keys and create edges
        property_keys_for_subobjects: set[str] = set()
        for row in subobject_property_rows:
            property_keys_for_subobjects.add(row.property_key)
            edges.append(
                GraphEdge(
                    source=row.subobject_key,
                    target=row.property_key,
                    edge_type="subobject_property",
                )
            )

        # Add property nodes if we have subobject properties
        if property_keys_for_subobjects:
            properties_query = select(Property).where(
                Property.entity_key.in_(list(property_keys_for_subobjects))
            )
            result = await self.session.execute(properties_query)
            properties = result.scalars().all()

            # Get module membership for these properties
            property_module_membership = await self._get_module_membership(
                list(property_keys_for_subobjects), "property"
            )

            for prop in properties:
                effective = await self.draft_overlay.apply_overlay(
                    prop, "property", prop.entity_key
                )
                change_status = None
                if effective:
                    change_status = effective.get("_change_status")

                nodes.append(
                    GraphNode(
                        id=prop.entity_key,
                        label=prop.label,
                        entity_type="property",
                        depth=None,
                        modules=property_module_membership.get(prop.entity_key, [module_key]),
                        change_status=change_status,
                    )
                )

        return nodes, edges

    async def _get_module_template_nodes(
        self,
        module_id: uuid.UUID,
        module_key: str,
    ) -> list[GraphNode]:
        """Get template nodes belonging to a module.

        Templates don't have direct relationships to categories - they're
        standalone module members. Only included in module graphs.

        Args:
            module_id: Module database ID
            module_key: Module entity key

        Returns:
            List of template nodes (no edges)
        """
        # Get template entity_keys in this module
        membership_query = select(ModuleEntity.entity_key).where(
            ModuleEntity.module_id == module_id,
            ModuleEntity.entity_type == "template",
        )
        result = await self.session.execute(membership_query)
        template_keys = [row[0] for row in result.fetchall()]

        if not template_keys:
            return []

        # Get template data
        templates_query = select(Template).where(
            Template.entity_key.in_(template_keys)
        )
        result = await self.session.execute(templates_query)
        templates = result.scalars().all()

        # Batch load module membership for templates
        template_module_membership = await self._get_module_membership(
            template_keys, "template"
        )

        # Build template nodes with draft overlay
        nodes: list[GraphNode] = []
        for template in templates:
            # Apply draft overlay to get effective data with change_status
            effective = await self.draft_overlay.apply_overlay(
                template, "template", template.entity_key
            )

            change_status = None
            if effective:
                change_status = effective.get("_change_status")

            nodes.append(
                GraphNode(
                    id=template.entity_key,
                    label=template.label,
                    entity_type="template",
                    depth=None,
                    modules=template_module_membership.get(template.entity_key, [module_key]),
                    change_status=change_status,
                )
            )

        return nodes
