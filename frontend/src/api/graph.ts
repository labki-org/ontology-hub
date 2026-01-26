import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { apiFetch } from './client'
import type { GraphResponse } from './types'

/**
 * Fetch the full ontology graph with all entities.
 *
 * Returns all categories, properties, subobjects, and templates with their
 * relationships. Bundles are excluded. Modules are represented via hull
 * membership on nodes.
 *
 * @param draftId - Optional draft ID for draft context
 */
export function useFullOntologyGraph(draftId?: string) {
  return useQuery({
    queryKey: ['graph', 'full', draftId],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (draftId) {
        params.set('draft_id', draftId)
      }
      const queryString = params.toString()
      const url = `/graph/full${queryString ? `?${queryString}` : ''}`

      return apiFetch<GraphResponse>(url, { v2: true })
    },
    staleTime: 30000, // Consider fresh for 30 seconds
    placeholderData: keepPreviousData,
  })
}

/**
 * Fetch neighborhood graph for an entity with draft overlay support.
 *
 * @param entityKey - Entity key to center the graph on
 * @param entityType - Entity type (default: 'category')
 * @param depth - Traversal depth (1-3, default: 2)
 * @param draftId - Optional draft ID for draft context
 */
export function useNeighborhoodGraph(
  entityKey: string | null,
  entityType: string = 'category',
  depth: number = 2,
  draftId?: string
) {
  return useQuery({
    queryKey: ['graph', 'neighborhood', entityKey, entityType, depth, draftId],
    queryFn: async () => {
      const params = new URLSearchParams({
        entity_key: entityKey!,
        entity_type: entityType,
        depth: String(depth),
      })
      if (draftId) {
        params.set('draft_id', draftId)
      }

      return apiFetch<GraphResponse>(`/graph/neighborhood?${params}`, { v2: true })
    },
    enabled: !!entityKey,
    placeholderData: keepPreviousData, // Keep showing previous graph while loading new one
  })
}

/**
 * Fetch module-scoped graph with draft overlay support.
 *
 * @param moduleKey - Module key to scope the graph to
 * @param draftId - Optional draft ID for draft context
 */
export function useModuleGraph(moduleKey: string | null, draftId?: string) {
  return useQuery({
    queryKey: ['graph', 'module', moduleKey, draftId],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (draftId) {
        params.set('draft_id', draftId)
      }

      const queryString = params.toString()
      const url = `/graph/module/${moduleKey}${queryString ? `?${queryString}` : ''}`

      return apiFetch<GraphResponse>(url, { v2: true })
    },
    enabled: !!moduleKey,
  })
}
