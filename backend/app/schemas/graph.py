"""Graph response schemas for visualization.

Provides response models for graph endpoints that support
neighborhood and module-scoped queries with module membership
for hull rendering.
"""

from typing import Literal

from pydantic import BaseModel, Field


class GraphNode(BaseModel):
    """Node in entity graph for visualization.

    Includes module membership for hull rendering where nodes
    are grouped by module visually.
    """

    id: str = Field(description="Entity key for React Flow node ID")
    label: str = Field(description="Display label for the node")
    entity_type: str = Field(description="Entity type: category, property, etc.")
    depth: int | None = Field(
        default=None, description="Distance from starting node in neighborhood query"
    )
    modules: list[str] = Field(
        default_factory=list,
        description="Module entity keys this node belongs to (for hull rendering)",
    )
    change_status: Literal["added", "modified", "deleted", "unchanged"] | None = Field(
        default=None, description="Draft change status in draft context"
    )


class GraphEdge(BaseModel):
    """Edge in entity graph for visualization.

    Represents relationships between entities (e.g., parent-child).
    """

    source: str = Field(description="Source entity key (child)")
    target: str = Field(description="Target entity key (parent)")
    edge_type: str = Field(default="parent", description="Edge type: parent, property, etc.")


class GraphResponse(BaseModel):
    """Graph query response for visualization.

    Contains all nodes and edges for rendering the graph
    with optional cycle detection flag.
    """

    nodes: list[GraphNode] = Field(default_factory=list, description="Graph nodes")
    edges: list[GraphEdge] = Field(default_factory=list, description="Graph edges")
    has_cycles: bool = Field(
        default=False, description="True if graph contains cycles (circular inheritance)"
    )
