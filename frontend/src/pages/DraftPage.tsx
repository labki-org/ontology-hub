import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { AlertCircle, Save, Undo2, Loader2, ExternalLink, CheckCircle2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { DraftHeader } from '@/components/draft/DraftHeader'
import { DraftDiffViewer } from '@/components/draft/DraftDiffViewer'
import { BulkModuleAssignment } from '@/components/draft/BulkModuleAssignment'
import { ProfileEditor } from '@/components/draft/ProfileEditor'
import { ValidationSummary } from '@/components/draft/ValidationSummary'
import { OpenPRButton } from '@/components/draft/OpenPRButton'
import { useDraft, useDraftDiff, useUpdateDraft } from '@/api/drafts'
import { useDraftStore } from '@/stores/draftStore'
import type { EntityUpdate, DraftPatchPayload } from '@/api/types'

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

function UnsavedChangesIndicator({
  token,
  onSaveSuccess,
}: {
  token: string
  onSaveSuccess: () => void
}) {
  const {
    hasUnsavedChanges,
    discardChanges,
    editedEntities,
    moduleAssignments,
    profileEdits,
    newModules,
    newProfiles,
  } = useDraftStore()

  const updateDraft = useUpdateDraft(token)
  const [saveError, setSaveError] = useState<string | null>(null)

  if (!hasUnsavedChanges) return null

  const handleSave = async () => {
    setSaveError(null)

    try {
      // Build update payload from store
      const entities: {
        categories: EntityUpdate[]
        properties: EntityUpdate[]
        subobjects: EntityUpdate[]
      } = {
        categories: [],
        properties: [],
        subobjects: [],
      }

      // Collect edited entities
      for (const [key, edits] of editedEntities) {
        const [entityType, entityId] = key.split(':')
        const entityData: EntityUpdate = {
          entity_id: entityId,
          label: edits.label as string | undefined,
          description: edits.description as string | undefined,
          schema_definition: edits.schema_definition as Record<string, unknown> | undefined,
        }

        if (entityType === 'categories') {
          entities.categories.push(entityData)
        } else if (entityType === 'properties') {
          entities.properties.push(entityData)
        } else if (entityType === 'subobjects') {
          entities.subobjects.push(entityData)
        }
      }

      // Build modules update from assignments
      const modules = Array.from(moduleAssignments.entries()).map(
        ([entityId, assignments]) => ({
          entity_id: entityId,
          module_ids: [...assignments.explicit, ...assignments.autoIncluded],
        })
      )

      // Build profiles update
      const profiles = Array.from(profileEdits.entries()).map(
        ([profileId, moduleIds]) => ({
          profile_id: profileId,
          module_ids: moduleIds,
        })
      )

      // Combine with new modules and profiles
      const payload: DraftPatchPayload = {
        entities,
        modules: [...modules, ...newModules],
        profiles: [...profiles, ...newProfiles],
      }

      await updateDraft.mutateAsync(payload)
      onSaveSuccess()
      discardChanges()
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : 'Failed to save changes'
      )
    }
  }

  return (
    <div className="fixed bottom-6 right-6 bg-card border shadow-lg rounded-lg p-4 flex flex-col gap-3 z-50">
      <div className="flex items-center gap-3">
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
            disabled={updateDraft.isPending}
          >
            <Undo2 className="h-4 w-4" />
            Discard
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={updateDraft.isPending}
            className="gap-1"
          >
            {updateDraft.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save
          </Button>
        </div>
      </div>
      {saveError && (
        <div className="text-sm text-red-600 dark:text-red-400">
          {saveError}
        </div>
      )}
    </div>
  )
}

export function DraftPage() {
  const { token } = useParams<{ token: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const { setDraft, hasUnsavedChanges, reset } = useDraftStore()
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null)
  const [prUrl, setPrUrl] = useState<string | null>(null)
  const [prError, setPrError] = useState<string | null>(null)

  const {
    data: draft,
    isLoading: isDraftLoading,
    error: draftError,
    refetch: refetchDraft,
  } = useDraft(token)

  const {
    data: diff,
    isLoading: isDiffLoading,
    error: diffError,
    refetch: refetchDiff,
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

  // Parse PR result from URL params
  useEffect(() => {
    const prUrlParam = searchParams.get('pr_url')
    const prErrorParam = searchParams.get('pr_error')

    if (prUrlParam) {
      setPrUrl(decodeURIComponent(prUrlParam))
      // Clear URL param
      searchParams.delete('pr_url')
      setSearchParams(searchParams, { replace: true })
    }

    if (prErrorParam) {
      setPrError(decodeURIComponent(prErrorParam))
      // Clear URL param
      searchParams.delete('pr_error')
      setSearchParams(searchParams, { replace: true })
    }
  }, [searchParams, setSearchParams])

  // Clear save success message after timeout
  useEffect(() => {
    if (saveSuccessMessage) {
      const timer = setTimeout(() => setSaveSuccessMessage(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [saveSuccessMessage])

  const handleSaveSuccess = () => {
    setSaveSuccessMessage('Changes saved successfully')
    // Refetch data to show updated diff
    refetchDraft()
    refetchDiff()
  }

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

  const isEditable = draft.status === 'pending'
  const hasNewCategories = diff.categories.added.length > 0

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Draft Review</h1>

      {/* Save success toast */}
      {saveSuccessMessage && (
        <div className="fixed top-6 right-6 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 rounded-lg p-4 shadow-lg z-50">
          {saveSuccessMessage}
        </div>
      )}

      {/* PR success banner */}
      {prUrl && (
        <Card className="border-green-500 bg-green-50 dark:bg-green-950">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-green-900 dark:text-green-100 mb-1">
                  Pull Request Created Successfully
                </h3>
                <p className="text-sm text-green-800 dark:text-green-200 mb-3">
                  Your changes have been submitted as a pull request to the repository.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="gap-2 border-green-600 text-green-700 hover:bg-green-100 dark:border-green-400 dark:text-green-300 dark:hover:bg-green-900"
                >
                  <a href={prUrl} target="_blank" rel="noopener noreferrer">
                    View Pull Request
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* PR error banner */}
      {prError && (
        <Card className="border-red-500 bg-red-50 dark:bg-red-950">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-red-900 dark:text-red-100 mb-1">
                  Failed to Create Pull Request
                </h3>
                <p className="text-sm text-red-800 dark:text-red-200">
                  {prError}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPrError(null)}
                className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
              >
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-6">
        <DraftHeader draft={draft} />

        {/* Open PR Button - show after header if draft is pending and valid */}
        {isEditable && token && (
          <div className="flex justify-center">
            <OpenPRButton
              draftToken={token}
              isValid={draft.validation_results?.is_valid ?? false}
              hasUnsavedChanges={hasUnsavedChanges}
            />
          </div>
        )}

        {/* Validation summary - show when draft has validation results */}
        {draft.validation_results && (
          <ValidationSummary report={draft.validation_results} />
        )}

        {/* Bulk module assignment for new categories */}
        {isEditable && hasNewCategories && (
          <BulkModuleAssignment diff={diff} />
        )}

        {/* Entity diff viewer */}
        <DraftDiffViewer
          diff={diff}
          editable={isEditable}
          validationResults={draft.validation_results}
        />

        {/* Profile editor */}
        {isEditable && (
          <ProfileEditor profileChanges={diff.profiles.added} />
        )}
      </div>

      {token && (
        <UnsavedChangesIndicator token={token} onSaveSuccess={handleSaveSuccess} />
      )}
    </div>
  )
}
