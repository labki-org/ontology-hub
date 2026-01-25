import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client'

// Types matching backend schemas/draft_v2.py and schemas/validation.py

export type DraftStatus = 'draft' | 'validated' | 'submitted' | 'merged' | 'rejected'
export type DraftSource = 'hub_ui' | 'mediawiki_push'
export type ChangeType = 'create' | 'update' | 'delete'

export interface DraftV2 {
  id: string
  status: DraftStatus
  source: DraftSource
  title: string | null
  description: string | null
  user_comment: string | null
  base_commit_sha: string
  rebase_status: string | null
  rebase_commit_sha: string | null
  created_at: string
  modified_at: string
  expires_at: string
  change_count: number
}

export interface DraftChangeV2 {
  id: string
  change_type: ChangeType
  entity_type: string
  entity_key: string
  patch?: Array<{ op: string; path: string; value?: unknown }>
  replacement_json?: Record<string, unknown>
  created_at: string
}

export interface DraftChangesListResponse {
  changes: DraftChangeV2[]
  total: number
}

export interface ValidationResultV2 {
  entity_type: string
  entity_key: string  // Changed from entity_id to match v2 model
  field: string | null
  code: string
  message: string
  severity: 'error' | 'warning' | 'info'
  suggested_semver: 'major' | 'minor' | 'patch' | null
  old_value: string | null
  new_value: string | null
}

export interface ValidationReportV2 {
  is_valid: boolean
  errors: ValidationResultV2[]
  warnings: ValidationResultV2[]
  info: ValidationResultV2[]
  suggested_semver: 'major' | 'minor' | 'patch'
  semver_reasons: string[]
}

export interface SubmitRequest {
  github_token: string
  pr_title?: string
  user_comment?: string
}

export interface SubmitResponse {
  pr_url: string
  draft_status: string
}

export interface DraftCreateResponse {
  capability_url: string
  draft: DraftV2
  expires_at: string
}

// Fetch functions

async function createDraft(params: { title?: string }): Promise<DraftCreateResponse> {
  return apiFetch('/drafts', {
    v2: true,
    method: 'POST',
    body: JSON.stringify({ source: 'hub_ui', title: params.title }),
  })
}

async function fetchDraftV2(token: string): Promise<DraftV2> {
  return apiFetch(`/drafts/${token}`, { v2: true })
}

async function fetchDraftChanges(token: string): Promise<DraftChangesListResponse> {
  return apiFetch(`/drafts/${token}/changes`, { v2: true })
}

async function validateDraft(token: string): Promise<ValidationReportV2> {
  return apiFetch(`/drafts/${token}/validate`, {
    v2: true,
    method: 'POST',
  })
}

async function submitDraft(
  token: string,
  params: SubmitRequest
): Promise<SubmitResponse> {
  return apiFetch(`/drafts/${token}/submit`, {
    v2: true,
    method: 'POST',
    body: JSON.stringify(params),
  })
}

// Query hooks

export function useDraftV2(token: string | undefined) {
  return useQuery({
    queryKey: ['v2', 'draft', token],
    queryFn: () => fetchDraftV2(token!),
    enabled: !!token,
  })
}

export function useDraftChanges(token: string | undefined) {
  return useQuery({
    queryKey: ['v2', 'draft-changes', token],
    queryFn: () => fetchDraftChanges(token!),
    enabled: !!token,
  })
}

// Mutation hooks

export function useValidateDraft(token: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => validateDraft(token!),
    onSuccess: () => {
      // Invalidate draft query to refresh status
      queryClient.invalidateQueries({ queryKey: ['v2', 'draft', token] })
    },
  })
}

export function useSubmitDraft(token: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: SubmitRequest) => submitDraft(token!, params),
    onSuccess: () => {
      // Invalidate draft query to refresh status
      queryClient.invalidateQueries({ queryKey: ['v2', 'draft', token] })
    },
  })
}

export function useCreateDraft() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: { title?: string }) => createDraft(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['v2', 'draft'] })
    },
  })
}

// Entity creation types and hooks

export interface CreateEntityParams {
  entityType: 'category' | 'property' | 'subobject' | 'template' | 'module' | 'bundle'
  entityKey: string
  data: Record<string, unknown>
}

async function createEntityChange(
  token: string,
  params: CreateEntityParams
): Promise<DraftChangeV2> {
  return apiFetch(`/drafts/${token}/changes`, {
    v2: true,
    method: 'POST',
    body: JSON.stringify({
      change_type: 'create',
      entity_type: params.entityType,
      entity_key: params.entityKey,
      replacement_json: params.data,
    }),
  })
}

/**
 * Mutation hook for creating new entities within a draft.
 * Creates a CREATE change that will be applied when the draft is submitted.
 *
 * @param token - Draft capability token
 * @returns React Query mutation with createEntityChange
 */
export function useCreateEntityChange(token: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: CreateEntityParams) => createEntityChange(token!, params),
    onSuccess: () => {
      // Invalidate draft changes and entity lists to refresh sidebar
      queryClient.invalidateQueries({ queryKey: ['v2', 'draft-changes', token] })
      queryClient.invalidateQueries({ queryKey: ['v2', 'categories'] })
      queryClient.invalidateQueries({ queryKey: ['v2', 'properties'] })
      queryClient.invalidateQueries({ queryKey: ['v2', 'subobjects'] })
      queryClient.invalidateQueries({ queryKey: ['v2', 'templates'] })
      queryClient.invalidateQueries({ queryKey: ['v2', 'modules'] })
      queryClient.invalidateQueries({ queryKey: ['v2', 'bundles'] })
    },
  })
}

// Entity deletion types and hooks

export interface DeleteEntityParams {
  entityType: 'category' | 'property' | 'subobject' | 'template' | 'module' | 'bundle'
  entityKey: string
}

async function deleteEntityChange(
  token: string,
  params: DeleteEntityParams
): Promise<DraftChangeV2> {
  return apiFetch(`/drafts/${token}/changes`, {
    v2: true,
    method: 'POST',
    body: JSON.stringify({
      change_type: 'delete',
      entity_type: params.entityType,
      entity_key: params.entityKey,
    }),
  })
}

/**
 * Mutation hook for deleting entities within a draft.
 * Creates a DELETE change that will be applied when the draft is submitted.
 *
 * @param token - Draft capability token
 * @returns React Query mutation with deleteEntityChange
 */
export function useDeleteEntityChange(token: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: DeleteEntityParams) => deleteEntityChange(token!, params),
    onSuccess: () => {
      // Invalidate draft changes and entity lists to refresh sidebar
      queryClient.invalidateQueries({ queryKey: ['v2', 'draft-changes', token] })
      queryClient.invalidateQueries({ queryKey: ['v2', 'categories'] })
      queryClient.invalidateQueries({ queryKey: ['v2', 'properties'] })
      queryClient.invalidateQueries({ queryKey: ['v2', 'subobjects'] })
      queryClient.invalidateQueries({ queryKey: ['v2', 'templates'] })
      queryClient.invalidateQueries({ queryKey: ['v2', 'modules'] })
      queryClient.invalidateQueries({ queryKey: ['v2', 'bundles'] })
    },
  })
}

async function removeChange(token: string, changeId: string): Promise<void> {
  return apiFetch(`/drafts/${token}/changes/${changeId}`, {
    v2: true,
    method: 'DELETE',
  })
}

/**
 * Mutation hook for undoing a delete operation (removing the DELETE change).
 * Removes a draft change record, effectively restoring the entity.
 *
 * @param token - Draft capability token
 * @returns React Query mutation with removeChange
 */
export function useUndoDeleteChange(token: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (changeId: string) => removeChange(token!, changeId),
    onSuccess: () => {
      // Invalidate draft changes and entity lists to refresh sidebar
      queryClient.invalidateQueries({ queryKey: ['v2', 'draft-changes', token] })
      queryClient.invalidateQueries({ queryKey: ['v2', 'categories'] })
      queryClient.invalidateQueries({ queryKey: ['v2', 'properties'] })
      queryClient.invalidateQueries({ queryKey: ['v2', 'subobjects'] })
      queryClient.invalidateQueries({ queryKey: ['v2', 'templates'] })
      queryClient.invalidateQueries({ queryKey: ['v2', 'modules'] })
      queryClient.invalidateQueries({ queryKey: ['v2', 'bundles'] })
    },
  })
}
