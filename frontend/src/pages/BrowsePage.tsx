import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ReactFlowProvider } from '@xyflow/react'
import { X } from 'lucide-react'
import { GraphCanvas } from '@/components/graph/GraphCanvas'
import { EntityDetailPanel } from '@/components/entity/EntityDetailPanel'
import { EntityDetailModal } from '@/components/entity/EntityDetailModal'
import { useGraphStore } from '@/stores/graphStore'
import { useCategory, useProperty, useSubobject, useModule, useBundle, useTemplate } from '@/api/entitiesV2'
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

  // Track if we've done initial sync from URL
  const initialSyncDone = useRef(false)

  // Extract URL parameters
  const draftId = searchParams.get('draft_id') || undefined
  const entityFromUrl = searchParams.get('entity')

  // Detail panel is open when an entity is selected
  const isDetailOpen = !!selectedEntityKey

  // Fetch entity data based on type
  const entityKey = selectedEntityKey || ''
  const categoryQuery = useCategory(selectedEntityType === 'category' ? entityKey : '', draftId)
  const propertyQuery = useProperty(selectedEntityType === 'property' ? entityKey : '', draftId)
  const subobjectQuery = useSubobject(selectedEntityType === 'subobject' ? entityKey : '', draftId)
  const moduleQuery = useModule(selectedEntityType === 'module' ? entityKey : '', draftId)
  const bundleQuery = useBundle(selectedEntityType === 'bundle' ? entityKey : '', draftId)
  const templateQuery = useTemplate(selectedEntityType === 'template' ? entityKey : '', draftId)

  // Select the right query based on entity type
  const entityQuery = (() => {
    switch (selectedEntityType) {
      case 'category': return categoryQuery
      case 'property': return propertyQuery
      case 'subobject': return subobjectQuery
      case 'module': return moduleQuery
      case 'bundle': return bundleQuery
      case 'template': return templateQuery
      default: return categoryQuery
    }
  })()

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

  return (
    <ReactFlowProvider>
      <div className="h-full w-full relative">
        {/* Full-screen graph - shifts left when detail panel is open */}
        <GraphCanvas
          entityKey={selectedEntityKey ?? undefined}
          draftId={draftId}
          detailPanelOpen={isDetailOpen}
        />

        {/* Slide-in detail panel overlay */}
        <div
          className={`
            absolute top-0 right-0 h-full w-[520px] max-w-[90vw]
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

          {/* Detail content */}
          <EntityDetailPanel
            entityKey={selectedEntityKey}
            entityType={selectedEntityType}
            draftId={draftId}
            data={entityQuery.data}
            isLoading={entityQuery.isLoading}
            error={entityQuery.error}
          />
        </div>

        {/* Entity detail modal - renders when opened via double-click or button */}
        <EntityDetailModal draftId={draftId} />
      </div>
    </ReactFlowProvider>
  )
}
