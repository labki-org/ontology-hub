import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ReactFlowProvider } from '@xyflow/react'
import { SplitLayout } from '@/components/layout/SplitLayout'
import { GraphCanvas } from '@/components/graph/GraphCanvas'
import { EntityDetailPanel } from '@/components/entity/EntityDetailPanel'
import { useGraphStore } from '@/stores/graphStore'

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
  const setSelectedEntity = useGraphStore((s) => s.setSelectedEntity)

  // Extract URL parameters
  const draftId = searchParams.get('draft_id') || undefined
  const entityFromUrl = searchParams.get('entity')

  // Sync URL entity param to graphStore on mount
  useEffect(() => {
    if (entityFromUrl && entityFromUrl !== selectedEntityKey) {
      setSelectedEntity(entityFromUrl)
    }
  }, [entityFromUrl, selectedEntityKey, setSelectedEntity])

  // Sync graphStore selection to URL when it changes
  useEffect(() => {
    const currentEntity = searchParams.get('entity')
    if (selectedEntityKey && selectedEntityKey !== currentEntity) {
      // Update URL with new entity selection
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
    } else if (!selectedEntityKey && currentEntity) {
      // Remove entity from URL if selection cleared
      setSearchParams(
        (prev) => {
          prev.delete('entity')
          return prev
        },
        { replace: true }
      )
    }
  }, [selectedEntityKey, searchParams, setSearchParams])

  return (
    <ReactFlowProvider>
      <SplitLayout className="h-full">
        {/* Top panel: Graph visualization */}
        <GraphCanvas entityKey={selectedEntityKey} draftId={draftId} />

        {/* Bottom panel: Entity detail */}
        <EntityDetailPanel
          entityKey={selectedEntityKey}
          entityType="category"
          draftId={draftId}
        />
      </SplitLayout>
    </ReactFlowProvider>
  )
}
