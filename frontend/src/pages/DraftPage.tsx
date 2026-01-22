import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { AlertCircle, Save, Undo2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { DraftHeader } from '@/components/draft/DraftHeader'
import { DraftDiffViewer } from '@/components/draft/DraftDiffViewer'
import { useDraft, useDraftDiff } from '@/api/drafts'
import { useDraftStore } from '@/stores/draftStore'

function DraftPageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <Skeleton className="h-5 w-64" />
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-5 w-40" />
            </div>
            <div className="flex flex-col items-end gap-2">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-5 w-32" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Diff viewer skeleton */}
      {[1, 2].map((i) => (
        <Card key={i}>
          <CardContent className="pt-6 space-y-3">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function DraftNotFound() {
  return (
    <Card className="border-destructive">
      <CardContent className="py-12 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">Draft Not Found</h2>
        <p className="text-muted-foreground">
          This draft may have expired or the URL is invalid.
          <br />
          Draft links expire after 7 days.
        </p>
      </CardContent>
    </Card>
  )
}

function UnsavedChangesIndicator() {
  const { hasUnsavedChanges, discardChanges } = useDraftStore()

  if (!hasUnsavedChanges) return null

  return (
    <div className="fixed bottom-6 right-6 bg-card border shadow-lg rounded-lg p-4 flex items-center gap-3 z-50">
      <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
        <AlertCircle className="h-5 w-5" />
        <span className="font-medium">Unsaved changes</span>
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={discardChanges}
          className="gap-1"
        >
          <Undo2 className="h-4 w-4" />
          Discard
        </Button>
        <Button
          size="sm"
          disabled
          className="gap-1"
          title="Save functionality coming in Plan 03"
        >
          <Save className="h-4 w-4" />
          Save
        </Button>
      </div>
    </div>
  )
}

export function DraftPage() {
  const { token } = useParams<{ token: string }>()
  const { setDraft, hasUnsavedChanges, reset } = useDraftStore()

  const {
    data: draft,
    isLoading: isDraftLoading,
    error: draftError,
  } = useDraft(token)

  const {
    data: diff,
    isLoading: isDiffLoading,
    error: diffError,
  } = useDraftDiff(token)

  // Initialize store when data loads
  useEffect(() => {
    if (draft && diff) {
      setDraft(draft, diff)
    }
  }, [draft, diff, setDraft])

  // Reset store on unmount
  useEffect(() => {
    return () => {
      reset()
    }
  }, [reset])

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault()
        e.returnValue = ''
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])

  // Loading state
  if (isDraftLoading || isDiffLoading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Draft Review</h1>
        <DraftPageSkeleton />
      </div>
    )
  }

  // Error state
  if (draftError || diffError || !draft || !diff) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Draft Review</h1>
        <DraftNotFound />
      </div>
    )
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Draft Review</h1>

      <div className="space-y-6">
        <DraftHeader draft={draft} />
        <DraftDiffViewer diff={diff} editable={draft.status === 'pending'} />
      </div>

      <UnsavedChangesIndicator />
    </div>
  )
}
