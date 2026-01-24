import { useQuery } from '@tanstack/react-query'
import { apiFetch } from './client'
import type { GraphResponse } from './types'

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

      return apiFetch<GraphResponse>(`/api/v2/graph/neighborhood?${params}`)
    },
    enabled: !!entityKey,
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
      const url = `/api/v2/graph/module/${moduleKey}${queryString ? `?${queryString}` : ''}`

      return apiFetch<GraphResponse>(url)
    },
    enabled: !!moduleKey,
  })
}
