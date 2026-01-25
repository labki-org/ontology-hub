import { useCallback, useRef, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { addDraftChange } from '@/api/drafts'
import type { DraftChangeCreate } from '@/api/types'
import { useDraftStoreV2 } from '@/stores/draftStoreV2'
import { useGraphStore } from '@/stores/graphStore'

interface UseAutoSaveOptions {
  draftToken: string
  entityType: string
  entityKey: string
  debounceMs?: number
  onSuccess?: () => void
  onError?: (error: Error) => void
}

export function useAutoSave({
  draftToken,
  entityType,
  entityKey,
  debounceMs = 500,
  onSuccess,
  onError,
}: UseAutoSaveOptions) {
  const queryClient = useQueryClient()
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const requestIdRef = useRef(0)

  const mutation = useMutation({
    mutationFn: (change: DraftChangeCreate) => addDraftChange(draftToken, change),
    onSuccess: () => {
      // Invalidate draft query to refresh status (auto-reverts from validated to draft)
      queryClient.invalidateQueries({ queryKey: ['v2', 'draft', draftToken] })
      // Invalidate entity queries to refresh with new draft overlay
      // Use partial match to catch queries with draftId in key
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey
          return Array.isArray(key) &&
            key[0] === 'v2' &&
            key[1] === entityType &&
            key[2] === entityKey
        }
      })
      // Also invalidate list queries for this entity type (sidebar refresh)
      // Handle irregular plural forms
      const pluralType = entityType === 'category' ? 'categories' :
                         entityType === 'property' ? 'properties' :
                         `${entityType}s`
      queryClient.invalidateQueries({ queryKey: ['v2', pluralType] })
      // Clear stale validation - draft has changed since last validation
      useDraftStoreV2.getState().clearValidation()
      // Also invalidate draft changes list to show updated change count
      queryClient.invalidateQueries({ queryKey: ['v2', 'draft-changes'] })

      // Track this entity as edited for change propagation visualization
      // Uses current graph data if available (empty if graph not loaded)
      const { nodes, edges } = useGraphStore.getState()
      useDraftStoreV2.getState().markEntityEdited(entityKey, nodes, edges)

      onSuccess?.()
    },
    onError: (error: Error) => {
      onError?.(error)
    },
  })

  const saveChange = useCallback(
    (patch: Array<{ op: string; path: string; value?: unknown }>) => {
      // Cancel pending timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      // Increment request ID for race condition handling
      const currentRequestId = ++requestIdRef.current

      timeoutRef.current = setTimeout(() => {
        // Check if this is still the latest request
        if (currentRequestId !== requestIdRef.current) {
          return // Stale request, skip
        }

        mutation.mutate({
          change_type: 'update',
          entity_type: entityType,
          entity_key: entityKey,
          patch,
        })
      }, debounceMs)
    },
    [mutation, entityType, entityKey, debounceMs]
  )

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return {
    saveChange,
    isSaving: mutation.isPending,
    error: mutation.error,
  }
}
