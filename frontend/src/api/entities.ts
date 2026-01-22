import { useQuery, useQueries } from '@tanstack/react-query'
import { apiFetch } from './client'
import type {
  EntityType,
  EntityPublic,
  EntityListResponse,
  EntityOverviewResponse,
} from './types'

// Fetch functions
async function fetchEntityOverview(): Promise<EntityOverviewResponse> {
  return apiFetch('/entities')
}

async function fetchEntities(
  type: EntityType,
  cursor?: string,
  limit?: number
): Promise<EntityListResponse> {
  const params = new URLSearchParams()
  if (cursor) params.set('cursor', cursor)
  if (limit) params.set('limit', String(limit))

  const queryString = params.toString()
  const endpoint = `/entities/${type}${queryString ? `?${queryString}` : ''}`
  return apiFetch(endpoint)
}

async function fetchEntity(
  type: EntityType,
  entityId: string
): Promise<EntityPublic> {
  return apiFetch(`/entities/${type}/${entityId}`)
}

// Query hooks
export function useEntityOverview() {
  return useQuery({
    queryKey: ['entities', 'overview'],
    queryFn: fetchEntityOverview,
  })
}

export function useEntities(
  type: EntityType,
  cursor?: string,
  limit?: number
) {
  return useQuery({
    queryKey: ['entities', type, { cursor, limit }],
    queryFn: () => fetchEntities(type, cursor, limit),
    enabled: !!type,
  })
}

export function useEntity(type: EntityType, entityId: string) {
  return useQuery({
    queryKey: ['entity', type, entityId],
    queryFn: () => fetchEntity(type, entityId),
    enabled: !!type && !!entityId,
  })
}

// Fetch all entities by type for sidebar navigation
export function useAllEntitiesByType() {
  const entityTypes: EntityType[] = ['category', 'property', 'subobject']

  const queries = useQueries({
    queries: entityTypes.map((type) => ({
      queryKey: ['entities', type, { limit: 100 }],
      queryFn: () => fetchEntities(type, undefined, 100),
    })),
  })

  const isLoading = queries.some((q) => q.isLoading)
  const error = queries.find((q) => q.error)?.error

  const data = isLoading
    ? undefined
    : {
        category: queries[0].data?.items || [],
        property: queries[1].data?.items || [],
        subobject: queries[2].data?.items || [],
      }

  return { data, isLoading, error }
}
