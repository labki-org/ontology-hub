import type { GraphNode, GraphEdge } from '@/api/types'

/**
 * Compute all entities transitively affected by an edit.
 * Uses BFS to traverse reverse dependencies (entities that depend ON the edited entity).
 *
 * In the ontology graph, edge.source depends on edge.target (child -> parent inheritance).
 * So if a parent is edited, all children (source nodes pointing to it) are affected.
 *
 * @param editedEntityKey - The entity_key that was edited
 * @param allNodes - All nodes in the current graph view
 * @param allEdges - All edges in the current graph view
 * @returns Set of entity_keys that are transitively affected (not including the edited entity itself)
 */
export function computeAffectedEntities(
  editedEntityKey: string,
  _allNodes: GraphNode[],
  allEdges: GraphEdge[]
): Set<string> {
  const affected = new Set<string>()
  const visited = new Set<string>()
  const queue: string[] = [editedEntityKey]

  // Build adjacency list for reverse edges (who depends on this node?)
  // In our graph, edge.source depends on edge.target (source inherits from target)
  // So reverse dependency: if edge.target === currentNode, then edge.source is affected

  while (queue.length > 0) {
    const current = queue.shift()!
    if (visited.has(current)) continue
    visited.add(current)

    // Find all entities that depend on current (reverse edges)
    for (const edge of allEdges) {
      // source -> target means source depends on target
      // So if current is the target, source is affected
      if (edge.target === current && !visited.has(edge.source)) {
        affected.add(edge.source)
        queue.push(edge.source)
      }
    }
  }

  // Remove the originally edited entity from affected set (it's "direct", not "transitive")
  affected.delete(editedEntityKey)

  return affected
}

/**
 * Get count of total affected entities (direct + transitive, deduplicated).
 */
export function getAffectedEntityCount(
  directEdits: Set<string>,
  transitiveEffects: Set<string>
): number {
  const total = new Set([...directEdits, ...transitiveEffects])
  return total.size
}
