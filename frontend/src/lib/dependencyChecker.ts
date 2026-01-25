import type { GraphNode, GraphEdge } from '@/api/types'

export interface DependentEntity {
  entityKey: string
  entityType: string
  label: string
  relationshipType: string // e.g., "is parent of", "uses property"
}

/**
 * Find all entities that depend on the given entity.
 * An entity A depends on entity B if there's an edge from A to B
 * (A uses/inherits from/includes B).
 *
 * In the graph model:
 * - edge.source depends on edge.target (source inherits from/uses target)
 * - So finding dependents of X means finding edges where target === X
 *
 * @param entityKey The entity to check dependents for
 * @param nodes All graph nodes
 * @param edges All graph edges
 * @returns Array of dependent entities
 */
export function findDependents(
  entityKey: string,
  nodes: GraphNode[],
  edges: GraphEdge[]
): DependentEntity[] {
  const dependents: DependentEntity[] = []

  // Find edges where target is the entity being deleted
  // (source depends on target)
  for (const edge of edges) {
    if (edge.target === entityKey) {
      const sourceNode = nodes.find(n => n.id === edge.source)
      if (sourceNode) {
        dependents.push({
          entityKey: sourceNode.id,
          entityType: sourceNode.entity_type || 'unknown',
          label: sourceNode.label || sourceNode.id,
          relationshipType: formatEdgeType(edge.edge_type),
        })
      }
    }
  }

  return dependents
}

/**
 * Format edge type for user-friendly display.
 */
function formatEdgeType(edgeType: string): string {
  switch (edgeType) {
    case 'parent':
      return 'inherits from'
    case 'property':
      return 'uses property'
    case 'subobject':
      return 'uses subobject'
    case 'template':
      return 'uses template'
    case 'module':
      return 'includes'
    default:
      return 'depends on'
  }
}

/**
 * Check if an entity can be deleted (has no dependents).
 *
 * @param entityKey The entity to check
 * @param nodes All graph nodes
 * @param edges All graph edges
 * @returns Object with canDelete boolean and list of dependents if any
 */
export function canDelete(
  entityKey: string,
  nodes: GraphNode[],
  edges: GraphEdge[]
): { canDelete: boolean; dependents: DependentEntity[] } {
  const dependents = findDependents(entityKey, nodes, edges)
  return {
    canDelete: dependents.length === 0,
    dependents,
  }
}
