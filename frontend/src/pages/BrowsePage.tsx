import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ReactFlowProvider } from '@xyflow/react'
import { SplitLayout } from '@/components/layout/SplitLayout'
import { GraphCanvas } from '@/components/graph/GraphCanvas'
import { EntityDetailPanel } from '@/components/entity/EntityDetailPanel'
import { useGraphStore } from '@/stores/graphStore'
import { useCategory, useProperty, useSubobject, useModule, useBundle, useTemplate } from '@/api/entitiesV2'

/**
 * Main browse/draft page with unified UI for both modes.
 *
 * Features:
 * - Split layout with graph (top) and detail (bottom) panels
 * - Same UI serves both canonical browse and draft mode
 * - URL draft_id parameter activates draft context
 * - Entity selection syncs between sidebar, graph, and detail panel
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

  // Fetch entity data based on type - moved here from EntityDetailPanel to work around rendering issue
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
      setSelectedEntity(entityFromUrl, 'category') // URL doesn't store type, default to category
      initialSyncDone.current = true
    }
  }, [entityFromUrl, setSelectedEntity])

  // Sync graphStore selection to URL when it changes (one-way: store → URL)
  useEffect(() => {
    // Skip during initial sync
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

  return (
    <ReactFlowProvider>
      <SplitLayout className="h-full">
        {/* Top panel: Graph visualization */}
        <GraphCanvas entityKey={selectedEntityKey ?? undefined} draftId={draftId} />

        {/* Bottom panel: Entity detail */}
        <EntityDetailPanel
          entityKey={selectedEntityKey}
          entityType={selectedEntityType}
          draftId={draftId}
          data={entityQuery.data}
          isLoading={entityQuery.isLoading}
          error={entityQuery.error}
        />
      </SplitLayout>
    </ReactFlowProvider>
  )
}
