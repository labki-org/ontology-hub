import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ReactFlowProvider } from '@xyflow/react'
import { X } from 'lucide-react'
import { GraphCanvas } from '@/components/graph/GraphCanvas'
import { EntityDetailPanel } from '@/components/entity/EntityDetailPanel'
import { DraftBannerV2 } from '@/components/draft/DraftBannerV2'
import { FloatingActionBar } from '@/components/draft/FloatingActionBar'
import { PRWizard } from '@/components/draft/PRWizard'
import { useGraphStore } from '@/stores/graphStore'
import { useDraftStoreV2 } from '@/stores/draftStoreV2'
import { useDraftV2, useDraftChanges, useValidateDraft } from '@/api/draftApiV2'
import { Button } from '@/components/ui/button'

/**
 * Main browse/draft page with full-screen graph and slide-in detail panel.
 *
 * Features:
 * - Full-screen graph visualization
 * - Slide-in detail panel overlay on the right
 * - Graph centers content away from detail panel when open
 * - Same UI serves both canonical browse and draft mode
 *
 * URL structure:
 * - /browse - canonical browse, no entity selected
 * - /browse?entity=Person - canonical browse with Person selected
 * - /browse?draft_id=abc123 - draft mode
 * - /browse?draft_id=abc123&entity=Person - draft mode with entity selected
 */
export function BrowsePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedEntityKey = useGraphStore((s) => s.selectedEntityKey)
  const selectedEntityType = useGraphStore((s) => s.selectedEntityType)
  const setSelectedEntity = useGraphStore((s) => s.setSelectedEntity)

  // V2 draft store
  const {
    validationReport,
    isValidating,
    setValidationReport,
    setIsValidating,
    prWizardOpen,
    setPrWizardOpen,
  } = useDraftStoreV2()

  // Track if we've done initial sync from URL
  const initialSyncDone = useRef(false)

  // Extract URL parameters
  const draftToken = searchParams.get('draft_token') || undefined
  const entityFromUrl = searchParams.get('entity')

  // V2 draft data and validation
  const draftV2 = useDraftV2(draftToken)
  const draftChanges = useDraftChanges(draftToken)
  const validateDraftMutation = useValidateDraft(draftToken)

  // Derive draftId from fetched draft (v2 workflow) or fall back to URL param (v1 workflow)
  const draftId = draftV2.data?.id?.toString() || searchParams.get('draft_id') || undefined

  // Detail panel is open when an entity is selected
  const isDetailOpen = !!selectedEntityKey

  // Sync URL entity param to graphStore ONLY on initial mount
  useEffect(() => {
    if (!initialSyncDone.current && entityFromUrl) {
      setSelectedEntity(entityFromUrl, 'category')
      initialSyncDone.current = true
    }
  }, [entityFromUrl, setSelectedEntity])

  // Sync graphStore selection to URL when it changes (one-way: store → URL)
  useEffect(() => {
    if (!initialSyncDone.current && entityFromUrl) {
      initialSyncDone.current = true
      return
    }

    const currentEntity = searchParams.get('entity')
    if (selectedEntityKey !== currentEntity) {
      setSearchParams(
        (prev) => {
          if (selectedEntityKey) {
            prev.set('entity', selectedEntityKey)
          } else {
            prev.delete('entity')
          }
          return prev
        },
        { replace: true }
      )
    }
  }, [selectedEntityKey, searchParams, setSearchParams, entityFromUrl])

  // Close detail panel
  const handleCloseDetail = () => {
    setSelectedEntity(null, 'category')
  }

  // V2 Draft workflow handlers
  const handleValidate = async () => {
    if (!draftToken) return

    try {
      setIsValidating(true)
      const report = await validateDraftMutation.mutateAsync()
      setValidationReport(report)
    } catch (error) {
      console.error('Validation failed:', error)
      setValidationReport(null)
    } finally {
      setIsValidating(false)
    }
  }

  // Auto-fetch validation report when draft is validated but report is missing
  // This handles the case where the page is refreshed and the local store is cleared
  useEffect(() => {
    if (
      draftV2.data?.status === 'validated' &&
      !validationReport &&
      !isValidating &&
      draftToken
    ) {
      handleValidate()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftV2.data?.status, validationReport, isValidating, draftToken])

  const handleSubmitPR = () => {
    setPrWizardOpen(true)
  }

  const handleExitDraft = () => {
    // Clear draft_token from URL to exit draft mode
    setSearchParams(
      (prev) => {
        prev.delete('draft_token')
        return prev
      },
      { replace: true }
    )
  }

  return (
    <ReactFlowProvider>
      <div className="h-full w-full relative flex flex-col">
        {/* V2 Draft Banner - only shown when draftV2 exists */}
        {draftV2.data && (
          <DraftBannerV2
            draft={draftV2.data}
            onValidate={handleValidate}
            onSubmitPR={handleSubmitPR}
            onExit={handleExitDraft}
            isValidating={isValidating}
            validationReport={validationReport}
          />
        )}

        {/* Full-screen graph - shifts left when detail panel is open */}
        <div className="flex-1 relative">
          <GraphCanvas
            entityKey={selectedEntityKey ?? undefined}
            draftId={draftId}
            detailPanelOpen={isDetailOpen}
          />

          {/* Slide-in detail panel overlay */}
          <div
            className={`
              absolute top-0 right-0 h-full w-[640px] max-w-[90vw]
              bg-background border-l shadow-xl
              transform transition-transform duration-300 ease-in-out
              ${isDetailOpen ? 'translate-x-0' : 'translate-x-full'}
            `}
          >
            {/* Close button */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 z-10"
              onClick={handleCloseDetail}
            >
              <X className="h-4 w-4" />
            </Button>

            {/* Detail content - components fetch their own data */}
            <EntityDetailPanel
              entityKey={selectedEntityKey}
              entityType={selectedEntityType}
              draftId={draftId}
              draftToken={draftToken}
            />
          </div>
        </div>

        {/* V2 Floating Action Bar - only shown when draftV2 exists */}
        {draftV2.data && (
          <FloatingActionBar
            draft={draftV2.data}
            onValidate={handleValidate}
            onSubmitPR={handleSubmitPR}
            isValidating={isValidating}
          />
        )}

        {/* V2 PR Wizard Modal */}
        {draftToken && draftV2.data && draftChanges.data && validationReport && (
          <PRWizard
            open={prWizardOpen}
            onOpenChange={setPrWizardOpen}
            draftToken={draftToken}
            changes={draftChanges.data.changes}
            validationReport={validationReport}
          />
        )}
      </div>
    </ReactFlowProvider>
  )
}
