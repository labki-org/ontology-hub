import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client'
import type {
  DraftPublic,
  DraftPayload,
  DraftCreateResponse,
  DraftPatchPayload,
  VersionDiffResponse,
  DraftChangeCreate,
  DraftChangeResponse,
} from './types'

// Fetch functions

async function fetchDraft(token: string): Promise<DraftPublic> {
  return apiFetch(`/drafts/${token}`)
}

async function fetchDraftDiff(token: string): Promise<VersionDiffResponse> {
  return apiFetch(`/drafts/${token}/diff`)
}

async function createDraft(payload: DraftPayload): Promise<DraftCreateResponse> {
  return apiFetch('/drafts/', {
    method: 'POST',
    body: JSON.stringify({ payload }),
  })
}

async function updateDraft(
  token: string,
  payload: DraftPatchPayload
): Promise<DraftPublic> {
  return apiFetch(`/drafts/${token}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function addDraftChange(
  token: string,
  change: DraftChangeCreate
): Promise<DraftChangeResponse> {
  return apiFetch(`/drafts/${token}/changes`, {
    method: 'POST',
    body: JSON.stringify(change),
    v2: true,
  })
}

// Query hooks

export function useDraft(token: string | undefined) {
  return useQuery({
    queryKey: ['draft', token],
    queryFn: () => fetchDraft(token!),
    enabled: !!token,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

export function useDraftDiff(token: string | undefined) {
  return useQuery({
    queryKey: ['draft-diff', token],
    queryFn: () => fetchDraftDiff(token!),
    enabled: !!token,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

// Mutation hooks

export function useCreateDraft() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createDraft,
    onSuccess: () => {
      // Invalidate any draft queries to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ['draft'] })
    },
  })
}

export function useUpdateDraft(token: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: DraftPatchPayload) => updateDraft(token, payload),
    onSuccess: () => {
      // Invalidate the specific draft query
      queryClient.invalidateQueries({ queryKey: ['draft', token] })
      queryClient.invalidateQueries({ queryKey: ['draft-diff', token] })
    },
  })
}
