import { useCallback, useRef, useEffect, useState } from 'react'
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
  const pendingPatchesRef = useRef<Map<string, { op: string; path: string; value?: unknown }>>(new Map())
  const mutationRef = useRef<{ mutate: (change: DraftChangeCreate) => void }>()
  // Serialize mutations: queue patches while one is in-flight
  const [inFlight, setInFlight] = useState(false)
  const inFlightRef = useRef(false)
  const queuedPatchesRef = useRef<Map<string, { op: string; path: string; value?: unknown }>>(new Map())
  // Promise resolver for flush() callers waiting for save to complete
  const flushResolversRef = useRef<Array<() => void>>([])

  const doMutate = useCallback(
    (patches: Array<{ op: string; path: string; value?: unknown }>) => {
      if (patches.length === 0) return
      inFlightRef.current = true; setInFlight(true)
      mutationRef.current?.mutate({
        change_type: 'update',
        entity_type: entityType,
        entity_key: entityKey,
        patch: patches,
      })
    },
    [entityType, entityKey]
  )

  const handleSettled = useCallback(() => {
    inFlightRef.current = false; setInFlight(false)

    // Flush queued patches that accumulated while in-flight
    if (queuedPatchesRef.current.size > 0) {
      const queued = Array.from(queuedPatchesRef.current.values())
      queuedPatchesRef.current.clear()
      doMutate(queued)
    } else {
      // No more pending work — resolve any flush() waiters
      const resolvers = flushResolversRef.current.splice(0)
      for (const resolve of resolvers) resolve()
    }
  }, [doMutate])

  const mutation = useMutation({
    mutationFn: (change: DraftChangeCreate) => addDraftChange(draftToken, change),
    onSuccess: () => {
      // Invalidate draft query to refresh status
      queryClient.invalidateQueries({ queryKey: ['v2', 'draft', draftToken] })
      // Invalidate and refetch entity queries
      queryClient.invalidateQueries({ queryKey: ['v2', entityType, entityKey] })
      void queryClient.refetchQueries({ queryKey: ['v2', entityType], type: 'active' })
      // Invalidate list queries for sidebar refresh
      const pluralType = entityType === 'category' ? 'categories' :
                         entityType === 'property' ? 'properties' :
                         `${entityType}s`
      queryClient.invalidateQueries({ queryKey: ['v2', pluralType] })
      // Clear stale validation
      useDraftStore.getState().clearValidation()
      // Invalidate draft changes list
      queryClient.invalidateQueries({ queryKey: ['v2', 'draft-changes'] })
      // Invalidate graph queries
      queryClient.invalidateQueries({ queryKey: ['graph'] })

      // Track entity as edited for change propagation visualization
      const { nodes, edges } = useGraphStore.getState()
      useDraftStore.getState().markEntityEdited(entityKey, nodes, edges)

      onSuccess?.()
      handleSettled()
    },
    onError: (error: Error) => {
      onError?.(error)
      handleSettled()
    },
  })

  // Keep mutation ref current so closures always use the latest
  useEffect(() => { mutationRef.current = mutation })

  const saveChange = useCallback(
    (patch: Array<{ op: string; path: string; value?: unknown }>) => {
      // Accumulate patches by path — later patches for the same path replace earlier ones
      for (const op of patch) {
        pendingPatchesRef.current.set(op.path, op)
      }

      // Cancel pending debounce timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      timeoutRef.current = setTimeout(() => {
        const allPatches = Array.from(pendingPatchesRef.current.values())
        pendingPatchesRef.current.clear()

        if (allPatches.length === 0) return

        if (inFlightRef.current) {
          // A mutation is already in-flight — queue these for after it settles
          for (const op of allPatches) {
            queuedPatchesRef.current.set(op.path, op)
          }
        } else {
          doMutate(allPatches)
        }
      }, debounceMs)
    },
    [debounceMs, doMutate]
  )

  /**
   * Flush any pending/queued patches and wait for all in-flight mutations to settle.
   * Call this before create/delete operations to prevent race conditions.
   */
  const flush = useCallback((): Promise<void> => {
    // Fire any pending debounced patches immediately
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    const allPatches = Array.from(pendingPatchesRef.current.values())
    pendingPatchesRef.current.clear()

    if (allPatches.length > 0) {
      if (inFlightRef.current) {
        for (const op of allPatches) queuedPatchesRef.current.set(op.path, op)
      } else {
        doMutate(allPatches)
      }
    }

    // If nothing is in-flight and nothing queued, resolve immediately
    if (!inFlightRef.current && queuedPatchesRef.current.size === 0) {
      return Promise.resolve()
    }

    // Otherwise wait for the current chain of mutations to settle
    return new Promise<void>((resolve) => {
      flushResolversRef.current.push(resolve)
    })
  }, [doMutate])

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
    flush,
    isSaving: mutation.isPending || inFlight,
    error: mutation.error,
  }
}
