import { useQuery } from '@tanstack/react-query'
import { apiFetch } from './client'
import type {
  EntityListResponseV2,
  EntityWithStatus,
  CategoryDetailV2,
  OntologyVersionInfo,
} from './types'

// Fetch functions

async function fetchOntologyVersion(): Promise<OntologyVersionInfo> {
  return apiFetch('/ontology-version', { v2: true })
}

async function fetchEntitiesV2(
  entityType: string,
  cursor?: string,
  limit?: number,
  draftId?: string
): Promise<EntityListResponseV2> {
  const params = new URLSearchParams()
  if (cursor) params.set('cursor', cursor)
  if (limit) params.set('limit', String(limit))
  if (draftId) params.set('draft_id', draftId)

  const queryString = params.toString()
  const endpoint = `/${entityType}${queryString ? `?${queryString}` : ''}`
  return apiFetch(endpoint, { v2: true })
}

async function fetchEntityV2(
  entityType: string,
  entityKey: string,
  draftId?: string
): Promise<EntityWithStatus | CategoryDetailV2> {
  const params = new URLSearchParams()
  if (draftId) params.set('draft_id', draftId)

  const queryString = params.toString()
  const endpoint = `/${entityType}/${entityKey}${queryString ? `?${queryString}` : ''}`
  return apiFetch(endpoint, { v2: true })
}

async function fetchPropertyUsedBy(
  entityKey: string,
  draftId?: string
): Promise<EntityWithStatus[]> {
  const params = new URLSearchParams()
  if (draftId) params.set('draft_id', draftId)

  const queryString = params.toString()
  const endpoint = `/properties/${entityKey}/used-by${queryString ? `?${queryString}` : ''}`
  return apiFetch(endpoint, { v2: true })
}

// Query hooks

export function useOntologyVersion() {
  return useQuery({
    queryKey: ['ontology-version'],
    queryFn: fetchOntologyVersion,
  })
}

export function useCategories(cursor?: string, limit?: number, draftId?: string) {
  return useQuery({
    queryKey: ['v2', 'categories', { cursor, limit, draftId }],
    queryFn: () => fetchEntitiesV2('categories', cursor, limit, draftId),
  })
}

export function useCategory(entityKey: string, draftId?: string) {
  return useQuery({
    queryKey: ['v2', 'category', entityKey, { draftId }],
    queryFn: () => fetchEntityV2('categories', entityKey, draftId),
    enabled: !!entityKey,
  })
}

export function useProperties(cursor?: string, limit?: number, draftId?: string) {
  return useQuery({
    queryKey: ['v2', 'properties', { cursor, limit, draftId }],
    queryFn: () => fetchEntitiesV2('properties', cursor, limit, draftId),
  })
}

export function useProperty(entityKey: string, draftId?: string) {
  return useQuery({
    queryKey: ['v2', 'property', entityKey, { draftId }],
    queryFn: () => fetchEntityV2('properties', entityKey, draftId),
    enabled: !!entityKey,
  })
}

export function useSubobjects(cursor?: string, limit?: number, draftId?: string) {
  return useQuery({
    queryKey: ['v2', 'subobjects', { cursor, limit, draftId }],
    queryFn: () => fetchEntitiesV2('subobjects', cursor, limit, draftId),
  })
}

export function useSubobject(entityKey: string, draftId?: string) {
  return useQuery({
    queryKey: ['v2', 'subobject', entityKey, { draftId }],
    queryFn: () => fetchEntityV2('subobjects', entityKey, draftId),
    enabled: !!entityKey,
  })
}

export function useModules(cursor?: string, limit?: number, draftId?: string) {
  return useQuery({
    queryKey: ['v2', 'modules', { cursor, limit, draftId }],
    queryFn: () => fetchEntitiesV2('modules', cursor, limit, draftId),
  })
}

export function useModule(entityKey: string, draftId?: string) {
  return useQuery({
    queryKey: ['v2', 'module', entityKey, { draftId }],
    queryFn: () => fetchEntityV2('modules', entityKey, draftId),
    enabled: !!entityKey,
  })
}

export function useBundles(cursor?: string, limit?: number, draftId?: string) {
  return useQuery({
    queryKey: ['v2', 'bundles', { cursor, limit, draftId }],
    queryFn: () => fetchEntitiesV2('bundles', cursor, limit, draftId),
  })
}

export function useBundle(entityKey: string, draftId?: string) {
  return useQuery({
    queryKey: ['v2', 'bundle', entityKey, { draftId }],
    queryFn: () => fetchEntityV2('bundles', entityKey, draftId),
    enabled: !!entityKey,
  })
}

export function useTemplates(cursor?: string, limit?: number, draftId?: string) {
  return useQuery({
    queryKey: ['v2', 'templates', { cursor, limit, draftId }],
    queryFn: () => fetchEntitiesV2('templates', cursor, limit, draftId),
  })
}

export function useTemplate(entityKey: string, draftId?: string) {
  return useQuery({
    queryKey: ['v2', 'template', entityKey, { draftId }],
    queryFn: () => fetchEntityV2('templates', entityKey, draftId),
    enabled: !!entityKey,
  })
}

export function usePropertyUsedBy(entityKey: string, draftId?: string) {
  return useQuery({
    queryKey: ['v2', 'property-used-by', entityKey, { draftId }],
    queryFn: () => fetchPropertyUsedBy(entityKey, draftId),
    enabled: !!entityKey,
  })
}

// Dashboard and Resource hooks

export function useDashboards(cursor?: string, limit?: number, draftId?: string) {
  return useQuery({
    queryKey: ['v2', 'dashboards', { cursor, limit, draftId }],
    queryFn: () => fetchEntitiesV2('dashboards', cursor, limit, draftId),
  })
}

export function useDashboard(entityKey: string, draftId?: string) {
  return useQuery({
    queryKey: ['v2', 'dashboard', entityKey, { draftId }],
    queryFn: () => fetchEntityV2('dashboards', entityKey, draftId),
    enabled: !!entityKey,
  })
}

export function useResources(cursor?: string, limit?: number, draftId?: string) {
  return useQuery({
    queryKey: ['v2', 'resources', { cursor, limit, draftId }],
    queryFn: () => fetchEntitiesV2('resources', cursor, limit, draftId),
  })
}

export function useResource(entityKey: string, draftId?: string) {
  return useQuery({
    queryKey: ['v2', 'resource', entityKey, { draftId }],
    queryFn: () => fetchEntityV2('resources', entityKey, draftId),
    enabled: !!entityKey,
  })
}
