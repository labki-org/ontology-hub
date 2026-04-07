import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import { useDashboard } from '@/api/entities'
import { apiFetch } from '@/api/client'
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
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { VisualChangeMarker } from '../form/VisualChangeMarker'
import { SaveIndicator } from '../sections/SaveIndicator'
import type { DashboardDetailV2, DashboardPage, CategoryDetailV2 } from '@/api/types'

/** Merged property info from category queries */
interface MergedProperty {
  entity_key: string
  label: string
  is_required: boolean
}

/**
 * Extract properties from Category:Dashboard query result.
 */
function extractDashboardProperties(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- useQueries return type is complex
  queries: ReturnType<typeof useQueries<any>>
): MergedProperty[] {
  const props: MergedProperty[] = []

  for (const query of queries) {
    const catDetail = query.data as CategoryDetailV2 | undefined
    if (!catDetail?.properties) continue

    for (const prop of catDetail.properties) {
      props.push({
        entity_key: prop.entity_key,
        label: prop.label,
        is_required: prop.is_required,
      })
    }
  }

  return props.sort((a, b) => {
    if (a.is_required !== b.is_required) return a.is_required ? -1 : 1
    return a.label.localeCompare(b.label)
  })
}

/**
 * Format a dynamic field value for display.
 */
function formatValue(value: unknown): string | React.ReactNode {
  if (value === null || value === undefined) {
    return <span className="italic text-muted-foreground">Not set</span>
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value)
  }
  if (Array.isArray(value)) {
    return value.join(', ')
  }
  return String(value)
}

interface DashboardDetailProps {
  entityKey: string
  draftId?: string
  draftToken?: string
  isEditing: boolean
}

/**
 * Dashboard detail view with:
 * - Header (name, label, description)
 * - Properties from Category:Dashboard (Has_dashboard_scope, Has_parent_dashboard, etc.)
 * - Pages displayed in accordion (one page open at a time)
 */
export function DashboardDetail({
  entityKey,
  draftId,
  draftToken,
  isEditing,
}: DashboardDetailProps) {
  const { data, isLoading, error } = useDashboard(entityKey, draftId)

  const dashboard = data as DashboardDetailV2 | undefined

  // Track original values for change detection
  const [originalValues, setOriginalValues] = useState<{
    label?: string
    description?: string
    dynamic_fields?: Record<string, unknown>
    pages?: DashboardPage[]
  }>({})

  // Local editable state
  const [editedLabel, setEditedLabel] = useState('')
  const [editedDescription, setEditedDescription] = useState('')
  const [editedDynamicFields, setEditedDynamicFields] = useState<Record<string, unknown>>({})
  const editedDynamicFieldsRef = useRef<Record<string, unknown>>({})
  useEffect(() => { editedDynamicFieldsRef.current = editedDynamicFields }, [editedDynamicFields])
  const [editedPages, setEditedPages] = useState<DashboardPage[]>([])
  const editedPagesRef = useRef<DashboardPage[]>([])
  useEffect(() => { editedPagesRef.current = editedPages }, [editedPages])

  const initializedEntityRef = useRef<string | null>(null)

  // Fetch Category:Dashboard properties
  const dashboardCategoryQueries = useQueries({
    queries: [{
      queryKey: ['v2', 'category', 'Dashboard', { draftId }],
      queryFn: () => apiFetch(`/categories/Dashboard${draftId ? `?draft_id=${draftId}` : ''}`, { v2: true }) as Promise<CategoryDetailV2>,
    }],
  })

  const mergedProperties = useMemo(
    () => extractDashboardProperties(dashboardCategoryQueries),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dashboardCategoryQueries.map((q) => q.data).join(',')]
  )

  // Auto-save hook
  const { saveChange, isSaving } = useAutoSave({
    draftToken: draftToken || '',
    entityType: 'dashboard',
    entityKey,
    debounceMs: 500,
  })

  // Initialize state when dashboard loads for a new entity
  useEffect(() => {
    if (dashboard) {
      const isNewEntity = initializedEntityRef.current !== entityKey

      if (isNewEntity) {
        setEditedLabel(dashboard.label)
        setEditedDescription(dashboard.description || '')
        setEditedDynamicFields(dashboard.dynamic_fields || {})
        setEditedPages(dashboard.pages || [])

        setOriginalValues({
          label: dashboard.label,
          description: dashboard.description || '',
          dynamic_fields: dashboard.dynamic_fields || {},
          pages: dashboard.pages || [],
        })

        initializedEntityRef.current = entityKey
      }
    }
  }, [dashboard, entityKey])

  // Change handlers
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

  const handleDynamicFieldChange = useCallback(
    (fieldKey: string, value: string) => {
      const updatedFields = { ...editedDynamicFieldsRef.current, [fieldKey]: value }
      setEditedDynamicFields(updatedFields)
      if (draftToken) {
        saveChange([{ op: 'add', path: '/dynamic_fields', value: updatedFields }])
      }
    },
    [draftToken, saveChange]
  )

  const handlePageWikitextChange = useCallback(
    (pageIndex: number, wikitext: string) => {
      const updatedPages = [...editedPagesRef.current]
      updatedPages[pageIndex] = { ...updatedPages[pageIndex], wikitext }
      setEditedPages(updatedPages)
      if (draftToken) {
        saveChange([{ op: 'add', path: '/pages', value: updatedPages }])
      }
    },
    [draftToken, saveChange]
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

  const isPagesModified = JSON.stringify(editedPages) !== JSON.stringify(originalValues.pages)

  const isPageModified = (pageIndex: number): boolean => {
    const original = originalValues.pages?.[pageIndex]?.wikitext
    const current = editedPages[pageIndex]?.wikitext
    return original !== current
  }

  const isFieldModified = (fieldKey: string): boolean => {
    const original = originalValues.dynamic_fields?.[fieldKey]
    const current = editedDynamicFields[fieldKey]
    return JSON.stringify(original) !== JSON.stringify(current)
  }

  const getPageDisplayName = (page: DashboardPage): string => {
    return page.name || '(Root Page)'
  }

  const filledFieldCount = mergedProperties.filter(
    (p) => editedDynamicFields[p.entity_key] !== undefined && editedDynamicFields[p.entity_key] !== ''
  ).length

  return (
    <div className="px-4 py-3">
      <SaveIndicator isSaving={isSaving} />

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

      {/* Properties Section — driven by Category:Dashboard schema */}
      {mergedProperties.length > 0 && (
        <AccordionSection
          id="properties"
          title="Properties"
          count={filledFieldCount}
          defaultOpen
          colorHint="property"
        >
          <div className="space-y-4">
            {mergedProperties.map((prop) => {
              const value = editedDynamicFields[prop.entity_key]
              return (
                <div key={prop.entity_key} className="space-y-1">
                  <label className="text-sm font-semibold text-foreground/70 flex items-center gap-1.5">
                    {prop.label}
                    {prop.is_required && (
                      <span className="text-red-500 text-xs">required</span>
                    )}
                  </label>
                  <VisualChangeMarker
                    status={isFieldModified(prop.entity_key) ? 'modified' : 'unchanged'}
                    originalValue={String(originalValues.dynamic_fields?.[prop.entity_key] ?? '')}
                  >
                    {isEditing ? (
                      <Input
                        value={String(value ?? '')}
                        onChange={(e) =>
                          handleDynamicFieldChange(prop.entity_key, e.target.value)
                        }
                        placeholder={`Enter ${prop.label}...`}
                      />
                    ) : (
                      <div className="text-sm py-2">
                        {formatValue(value)}
                      </div>
                    )}
                  </VisualChangeMarker>
                </div>
              )
            })}
          </div>
        </AccordionSection>
      )}

      {/* Pages Section */}
      <AccordionSection
        id="pages"
        title="Pages"
        count={editedPages.length}
        colorHint="dashboard"
      >
        {editedPages.length === 0 ? (
          <p className="text-xs text-muted-foreground/60">
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
                            <p className="text-xs text-muted-foreground/60">
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
