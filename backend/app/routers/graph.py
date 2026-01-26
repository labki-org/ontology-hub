"""Graph API endpoints for visualization.

Provides graph query endpoints for neighborhood traversal (GRP-01) and
module-scoped queries (GRP-02) with module membership for hull rendering
(GRP-03) and change status badges in draft context (GRP-04).

Endpoints:
- GET /graph/neighborhood - Neighborhood graph for entity
- GET /graph/module/{module_key} - Module-scoped graph
"""

from fastapi import APIRouter, HTTPException, Query

from app.schemas.graph import GraphResponse
from app.services.draft_overlay import DraftContextDep
from app.services.graph_query import GraphQueryService

router = APIRouter(prefix="/graph", tags=["graph"])


@router.get("/full", response_model=GraphResponse)
async def get_full_ontology_graph(
    draft_ctx: DraftContextDep = None,
) -> GraphResponse:
    """Get the full ontology graph with all entities (GRP-05).

    Returns all categories, properties, subobjects, and templates with their
    relationships. Bundles are excluded. Modules are represented via hull
    membership on nodes.

    Args:
        draft_ctx: Draft context from query param (via DraftContextDep)

    Returns:
        GraphResponse with all entities and relationships
    """
    service = GraphQueryService(draft_ctx.session, draft_ctx)
    return await service.get_full_ontology_graph()


@router.get("/neighborhood", response_model=GraphResponse)
async def get_neighborhood_graph(
    entity_key: str = Query(..., description="Starting entity key (e.g., 'Person')"),
    entity_type: str = Query(
        "category", description="Entity type (currently only 'category' supported)"
    ),
    depth: int = Query(2, ge=1, le=5, description="Max traversal depth (1-5)"),
    draft_ctx: DraftContextDep = None,
) -> GraphResponse:
    """Get neighborhood graph for entity within specified depth (GRP-01).

    Returns nodes and edges for ancestors and descendants up to depth levels
    from the starting entity. Includes module membership for hull rendering
    and applies draft overlay for change_status when draft_id is provided.

    Args:
        entity_key: Starting entity key (e.g., "Person")
        entity_type: Type of entity (default "category")
        depth: Max traversal depth (1-5, default 2)
        draft_ctx: Draft context from query param (via DraftContextDep)

    Returns:
        GraphResponse with nodes, edges, and has_cycles flag

    Raises:
        HTTPException: 404 if starting entity not found
        HTTPException: 400 if entity_type not supported
    """
    service = GraphQueryService(draft_ctx.session, draft_ctx)

    try:
        return await service.get_neighborhood_graph(entity_key, entity_type, depth)
    except ValueError as e:
        error_msg = str(e)
        if "not found" in error_msg.lower():
            raise HTTPException(status_code=404, detail=error_msg) from e
        raise HTTPException(status_code=400, detail=error_msg) from e


@router.get("/module/{module_key}", response_model=GraphResponse)
async def get_module_graph(
    module_key: str,
    draft_ctx: DraftContextDep = None,
) -> GraphResponse:
    """Get graph of all entities in a module (GRP-02).

    Returns nodes and edges for all entities belonging to the specified module.
    Includes module membership for hull rendering (nodes may belong to multiple
    modules) and applies draft overlay for change_status when draft_id is provided.

    Args:
        module_key: Module entity key (e.g., "core")
        draft_ctx: Draft context from query param (via DraftContextDep)

    Returns:
        GraphResponse with module entities as nodes

    Raises:
        HTTPException: 404 if module not found
    """
    service = GraphQueryService(draft_ctx.session, draft_ctx)

    try:
        return await service.get_module_graph(module_key)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
