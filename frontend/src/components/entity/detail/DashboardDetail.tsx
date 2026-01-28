import { useEffect, useState, useCallback, useRef } from 'react'
import { useDashboard } from '@/api/entities'
import { useAutoSave } from '@/hooks/useAutoSave'
import { EntityHeader } from '../sections/EntityHeader'
import { AccordionSection } from '../sections/AccordionSection'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { VisualChangeMarker } from '../form/VisualChangeMarker'
import type { DashboardDetailV2, DashboardPage } from '@/api/types'

interface DashboardDetailProps {
  entityKey: string
  draftId?: string
  draftToken?: string
  isEditing: boolean
}

/**
 * Dashboard detail view with:
 * - Header (name, label, description)
 * - Pages displayed in accordion (one page open at a time)
 * - Raw wikitext display for each page
 * - Wikitext editor in draft mode
 *
 * Per CONTEXT.md: Accordion layout for pages, raw wikitext display.
 */
export function DashboardDetail({
  entityKey,
  draftId,
  draftToken,
  isEditing,
}: DashboardDetailProps) {
  const { data, isLoading, error } = useDashboard(entityKey, draftId)

  // Cast to DashboardDetailV2
  const dashboard = data as DashboardDetailV2 | undefined

  // Track original values for change detection
  const [originalValues, setOriginalValues] = useState<{
    label?: string
    description?: string
    pages?: DashboardPage[]
  }>({})

  // Local editable state
  const [editedLabel, setEditedLabel] = useState('')
  const [editedDescription, setEditedDescription] = useState('')
  const [editedPages, setEditedPages] = useState<DashboardPage[]>([])

  // Track which entity we've initialized original values for (prevent reset on refetch)
  const initializedEntityRef = useRef<string | null>(null)

  // Auto-save hook
  const { saveChange, isSaving } = useAutoSave({
    draftToken: draftToken || '',
    entityType: 'dashboard',
    entityKey,
    debounceMs: 500,
  })

  // Initialize state when dashboard loads for a new entity (not on refetch)
  /* eslint-disable react-hooks/set-state-in-effect -- Valid sync with external data */
  useEffect(() => {
    if (dashboard) {
      const isNewEntity = initializedEntityRef.current !== entityKey

      // Only reset edited values and original values for a NEW entity
      // (not on refetch after auto-save)
      if (isNewEntity) {
        setEditedLabel(dashboard.label)
        setEditedDescription(dashboard.description || '')
        setEditedPages(dashboard.pages || [])

        setOriginalValues({
          label: dashboard.label,
          description: dashboard.description || '',
          pages: dashboard.pages || [],
        })

        initializedEntityRef.current = entityKey
      }
    }
  }, [dashboard, entityKey])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Change handlers - use 'add' instead of 'replace' for robustness
  // (add works whether field exists or not in canonical_json)
  const handleLabelChange = useCallback(
    (value: string) => {
      setEditedLabel(value)
      if (draftToken) saveChange([{ op: 'add', path: '/label', value }])
    },
    [draftToken, saveChange]
  )

  const handleDescriptionChange = useCallback(
    (value: string) => {
      setEditedDescription(value)
      if (draftToken) saveChange([{ op: 'add', path: '/description', value }])
    },
    [draftToken, saveChange]
  )

  const handlePageWikitextChange = useCallback(
    (pageIndex: number, wikitext: string) => {
      setEditedPages((prev) => {
        const updated = [...prev]
        updated[pageIndex] = { ...updated[pageIndex], wikitext }
        return updated
      })
      if (draftToken) {
        // Update the entire pages array - use 'add' for robustness
        const updatedPages = [...editedPages]
        updatedPages[pageIndex] = { ...updatedPages[pageIndex], wikitext }
        saveChange([{ op: 'add', path: '/pages', value: updatedPages }])
      }
    },
    [draftToken, saveChange, editedPages]
  )

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (error || !dashboard) {
    return (
      <div className="p-6 text-center text-destructive">
        <p className="font-medium">Failed to load dashboard</p>
        <p className="text-sm text-muted-foreground mt-1">
          {error instanceof Error ? error.message : 'Dashboard not found'}
        </p>
      </div>
    )
  }

  // Check if pages have been modified
  const isPagesModified = JSON.stringify(editedPages) !== JSON.stringify(originalValues.pages)

  // Helper to check if a specific page's wikitext was modified
  const isPageModified = (pageIndex: number): boolean => {
    const original = originalValues.pages?.[pageIndex]?.wikitext
    const current = editedPages[pageIndex]?.wikitext
    return original !== current
  }

  // Get display name for page (root page has empty string name)
  const getPageDisplayName = (page: DashboardPage): string => {
    return page.name || '(Root Page)'
  }

  return (
    <div className="p-6 space-y-6">
      {isSaving && (
        <div className="fixed top-4 right-4 bg-primary text-primary-foreground px-3 py-1 rounded text-sm">
          Saving...
        </div>
      )}

      {/* Header */}
      <EntityHeader
        entityKey={entityKey}
        label={editedLabel}
        description={editedDescription}
        entityType="dashboard"
        changeStatus={dashboard.change_status}
        isEditing={isEditing}
        originalLabel={originalValues.label}
        originalDescription={originalValues.description}
        onLabelChange={handleLabelChange}
        onDescriptionChange={handleDescriptionChange}
      />

      {/* Pages Section */}
      <AccordionSection
        id="pages"
        title="Pages"
        count={editedPages.length}
      >
        {editedPages.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            No pages defined
          </p>
        ) : (
          <VisualChangeMarker
            status={isPagesModified ? 'modified' : 'unchanged'}
            originalValue={isPagesModified ? 'Pages have been modified' : undefined}
          >
            <Accordion type="single" collapsible className="w-full">
              {editedPages.map((page, index) => (
                <AccordionItem key={page.name || `page-${index}`} value={page.name || `page-${index}`}>
                  <AccordionTrigger className="text-sm font-medium">
                    {getPageDisplayName(page)}
                  </AccordionTrigger>
                  <AccordionContent>
                    {isEditing ? (
                      <VisualChangeMarker
                        status={isPageModified(index) ? 'modified' : 'unchanged'}
                        originalValue={originalValues.pages?.[index]?.wikitext}
                      >
                        <Textarea
                          value={page.wikitext}
                          onChange={(e) => handlePageWikitextChange(index, e.target.value)}
                          className="min-h-[200px] font-mono text-sm"
                          placeholder="Enter wikitext content..."
                        />
                      </VisualChangeMarker>
                    ) : (
                      <VisualChangeMarker
                        status={isPageModified(index) ? 'modified' : 'unchanged'}
                        originalValue={originalValues.pages?.[index]?.wikitext}
                      >
                        <div className="bg-muted/30 rounded-md p-4">
                          {page.wikitext ? (
                            <pre className="whitespace-pre-wrap font-mono text-sm overflow-x-auto">
                              {page.wikitext}
                            </pre>
                          ) : (
                            <p className="text-sm text-muted-foreground italic">
                              No wikitext content
                            </p>
                          )}
                        </div>
                      </VisualChangeMarker>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </VisualChangeMarker>
        )}
      </AccordionSection>
    </div>
  )
}
