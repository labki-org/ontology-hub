import { useCallback, useRef, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { addDraftChange, type DraftChangeCreate } from '@/api/drafts'
import { useDraftStore } from '@/stores/draftStore'
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
  const pendingPatchesRef = useRef<Map<string, { op: string; path: string; value?: unknown }>>(new Map())
  const mutationRef = useRef<ReturnType<typeof useMutation<unknown, Error, DraftChangeCreate>>>()

  const mutation = useMutation({
    mutationFn: (change: DraftChangeCreate) => addDraftChange(draftToken, change),
    onSuccess: () => {
      // Invalidate draft query to refresh status (auto-reverts from validated to draft)
      queryClient.invalidateQueries({ queryKey: ['v2', 'draft', draftToken] })
      // Invalidate and refetch entity queries to refresh with new draft overlay
      queryClient.invalidateQueries({
        queryKey: ['v2', entityType, entityKey],
      })
      // Force immediate refetch of ALL v2 queries for this entity
      // This ensures computed fields (like module closure) are up to date
      void queryClient.refetchQueries({
        queryKey: ['v2', entityType],
        type: 'active',
      })
      // Also invalidate list queries for this entity type (sidebar refresh)
      // Handle irregular plural forms
      const pluralType = entityType === 'category' ? 'categories' :
                         entityType === 'property' ? 'properties' :
                         `${entityType}s`
      queryClient.invalidateQueries({ queryKey: ['v2', pluralType] })
      // Clear stale validation - draft has changed since last validation
      useDraftStore.getState().clearValidation()
      // Also invalidate draft changes list to show updated change count
      queryClient.invalidateQueries({ queryKey: ['v2', 'draft-changes'] })
      // Invalidate graph queries to refresh edge change_status indicators
      queryClient.invalidateQueries({ queryKey: ['graph'] })

      // Track this entity as edited for change propagation visualization
      // Uses current graph data if available (empty if graph not loaded)
      const { nodes, edges } = useGraphStore.getState()
      useDraftStore.getState().markEntityEdited(entityKey, nodes, edges)

      onSuccess?.()
    },
    onError: (error: Error) => {
      onError?.(error)
    },
  })

  // Keep mutation ref current so the timeout closure always uses the latest
  mutationRef.current = mutation

  const saveChange = useCallback(
    (patch: Array<{ op: string; path: string; value?: unknown }>) => {
      // Accumulate patches by path — later patches for the same path replace earlier ones
      for (const op of patch) {
        pendingPatchesRef.current.set(op.path, op)
      }

      // Cancel pending timeout (debounce)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      console.log('[useAutoSave] saveChange called, scheduling timeout. pendingPatches:', Array.from(pendingPatchesRef.current.keys()))
      timeoutRef.current = setTimeout(() => {
        // Flush all accumulated patches
        const allPatches = Array.from(pendingPatchesRef.current.values())
        pendingPatchesRef.current.clear()

        console.log('[useAutoSave] timeout fired, patches to send:', allPatches.length, allPatches.map(p => p.path))
        if (allPatches.length === 0) return

        console.log('[useAutoSave] calling mutate, mutationRef exists:', !!mutationRef.current)
        mutationRef.current?.mutate({
          change_type: 'update',
          entity_type: entityType,
          entity_key: entityKey,
          patch: allPatches,
        })
      }, debounceMs)
    },
    [entityType, entityKey, debounceMs]
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
