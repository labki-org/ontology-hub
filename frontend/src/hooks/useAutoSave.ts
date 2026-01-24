import { useCallback, useRef, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { addDraftChange } from '@/api/drafts'
import type { DraftChangeCreate } from '@/api/types'

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
      // Invalidate entity queries to refresh with new draft overlay
      queryClient.invalidateQueries({ queryKey: ['v2', entityType, entityKey] })
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
          change_type: 'UPDATE',
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
