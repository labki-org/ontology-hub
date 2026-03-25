import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import { useResource, useCategories } from '@/api/entities'
import { apiFetch } from '@/api/client'
import { useAutoSave } from '@/hooks/useAutoSave'
import { useGraphStore } from '@/stores/graphStore'
import { AccordionSection } from '../sections/AccordionSection'
import { EntityCombobox } from '../forms/EntityCombobox'
import { RelationshipChips } from '../forms/RelationshipChips'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { VisualChangeMarker } from '../form/VisualChangeMarker'
import type { ResourceDetailV2, CategoryDetailV2 } from '@/api/types'

/** Merged property info from multiple categories */
interface MergedProperty {
  entity_key: string
  label: string
  is_required: boolean
  source_categories: string[]
}

/**
 * Merge properties from category detail queries into a deduplicated, sorted list.
 * If a property appears in multiple categories, it is required if any category requires it.
 */
function mergePropertiesFromCategories(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- useQueries return type is complex
  queries: ReturnType<typeof useQueries<any>>
): MergedProperty[] {
  const propMap = new Map<string, MergedProperty>()

  for (const query of queries) {
    const catDetail = query.data as CategoryDetailV2 | undefined
    if (!catDetail?.properties) continue

    for (const prop of catDetail.properties) {
      const existing = propMap.get(prop.entity_key)
      if (existing) {
        if (prop.is_required) existing.is_required = true
        existing.source_categories.push(catDetail.entity_key)
      } else {
        propMap.set(prop.entity_key, {
          entity_key: prop.entity_key,
          label: prop.label,
          is_required: prop.is_required,
          source_categories: [catDetail.entity_key],
        })
      }
    }
  }

  return Array.from(propMap.values()).sort((a, b) => {
    // Required first, then alphabetical
    if (a.is_required !== b.is_required) return a.is_required ? -1 : 1
    return a.label.localeCompare(b.label)
  })
}

interface ResourceDetailProps {
  entityKey: string
  draftId?: string
  draftToken?: string
  isEditing: boolean
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
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2)
  }
  return String(value)
}

export function ResourceDetail({
  entityKey,
  draftId,
  draftToken,
  isEditing,
}: ResourceDetailProps) {
  const { data, isLoading, error } = useResource(entityKey, draftId)
  const setSelectedEntity = useGraphStore((s) => s.setSelectedEntity)

  const resource = data as ResourceDetailV2 | undefined

  // Fetch available categories for the combobox
  const { data: categoriesData } = useCategories(undefined, undefined, draftId)
  const availableCategories = (categoriesData?.items || []).map((c) => ({
    key: c.entity_key,
    label: c.label,
  }))

  // Track original values for change detection
  const [originalValues, setOriginalValues] = useState<{
    category_keys?: string[]
    dynamic_fields?: Record<string, unknown>
    wikitext?: string
  }>({})

  // Local editable state
  const [editedCategories, setEditedCategories] = useState<string[]>([])
  const [editedDynamicFields, setEditedDynamicFields] = useState<Record<string, unknown>>({})
  const editedDynamicFieldsRef = useRef<Record<string, unknown>>({})
  editedDynamicFieldsRef.current = editedDynamicFields
  const [editedWikitext, setEditedWikitext] = useState<string>('')

  // Use edited categories in edit mode, canonical keys in read mode.
  // Single useQueries call avoids redundant hook overhead and merge logic.
  const activeCategoryKeys = isEditing ? editedCategories : (resource?.category_keys || [])
  const activeCategoryQueries = useQueries({
    queries: activeCategoryKeys.map((catKey) => ({
      queryKey: ['v2', 'category', catKey, { draftId }],
      queryFn: () => apiFetch(`/categories/${catKey}${draftId ? `?draft_id=${draftId}` : ''}`, { v2: true }) as Promise<CategoryDetailV2>,
      enabled: !!catKey,
    })),
  })

  const mergedProperties = useMemo(
    () => mergePropertiesFromCategories(activeCategoryQueries),
    [activeCategoryQueries]
  )

  const initializedEntityRef = useRef<string | null>(null)

  const { saveChange, isSaving } = useAutoSave({
    draftToken: draftToken || '',
    entityType: 'resource',
    entityKey,
    debounceMs: 500,
  })

  // Initialize state when resource loads for a new entity
  /* eslint-disable react-hooks/set-state-in-effect -- Valid sync with external data */
  useEffect(() => {
    if (resource) {
      const isNewEntity = initializedEntityRef.current !== entityKey

      if (isNewEntity) {
        setEditedCategories(resource.category_keys || [])
        setEditedDynamicFields(resource.dynamic_fields || {})
        setEditedWikitext(resource.wikitext || '')

        setOriginalValues({
          category_keys: resource.category_keys || [],
          dynamic_fields: resource.dynamic_fields || {},
          wikitext: resource.wikitext || '',
        })

        initializedEntityRef.current = entityKey
      }
    }
  }, [resource, entityKey])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Category change handlers
  const handleAddCategory = useCallback(
    (categoryKey: string) => {
      const updated = [...editedCategories, categoryKey]
      setEditedCategories(updated)
      if (draftToken) {
        saveChange([{ op: 'add', path: '/categories', value: updated }])
      }
    },
    [draftToken, saveChange, editedCategories]
  )

  const handleRemoveCategory = useCallback(
    (categoryKey: string) => {
      const updated = editedCategories.filter((k) => k !== categoryKey)
      setEditedCategories(updated)
      if (draftToken) {
        saveChange([{ op: 'add', path: '/categories', value: updated }])
      }
    },
    [draftToken, saveChange, editedCategories]
  )

  // Dynamic field change handler
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

  // Wikitext change handler
  const handleWikitextChange = useCallback(
    (value: string) => {
      setEditedWikitext(value)
      if (draftToken) {
        saveChange([{ op: 'add', path: '/wikitext', value }])
      }
    },
    [draftToken, saveChange]
  )

  // Navigate to category detail
  const handleCategoryClick = useCallback(
    (categoryKey: string) => {
      setSelectedEntity(categoryKey, 'category')
    },
    [setSelectedEntity]
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

  if (error || !resource) {
    return (
      <div className="p-6 text-center text-destructive">
        <p className="font-medium">Failed to load resource</p>
        <p className="text-sm text-muted-foreground mt-1">
          {error instanceof Error ? error.message : 'Resource not found'}
        </p>
      </div>
    )
  }

  const resourceId = entityKey.includes('/') ? entityKey.split('/').pop() : entityKey

  const isFieldModified = (fieldKey: string): boolean => {
    const original = originalValues.dynamic_fields?.[fieldKey]
    const current = editedDynamicFields[fieldKey]
    return JSON.stringify(original) !== JSON.stringify(current)
  }

  const areCategoriesModified =
    JSON.stringify(editedCategories) !== JSON.stringify(originalValues.category_keys)

  const statusConfig: Record<string, { variant: 'default' | 'secondary' | 'destructive'; className: string; label: string }> = {
    added: { variant: 'default', className: 'bg-green-500 hover:bg-green-600', label: '+ Added' },
    modified: { variant: 'secondary', className: 'bg-yellow-500 hover:bg-yellow-600', label: '~ Modified' },
    deleted: { variant: 'destructive', className: '', label: '- Deleted' },
  }

  const status = resource.change_status && resource.change_status !== 'unchanged'
    ? statusConfig[resource.change_status]
    : null

  const statusBadge = status && (
    <Badge variant={status.variant} className={status.className}>
      {status.label}
    </Badge>
  )

  return (
    <div className="p-6 space-y-6">
      {isSaving && (
        <div className="fixed top-4 right-4 bg-primary text-primary-foreground px-3 py-1 rounded text-sm">
          Saving...
        </div>
      )}

      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="capitalize">
            resource
          </Badge>
          {statusBadge}
        </div>

        <h2 className="text-2xl font-bold">{resourceId}</h2>
      </div>

      {/* Categories Section */}
      <AccordionSection
        id="categories"
        title="Categories"
        count={editedCategories.length}
        defaultOpen
      >
        <VisualChangeMarker
          status={areCategoriesModified ? 'modified' : 'unchanged'}
          originalValue={originalValues.category_keys?.join(', ') ?? ''}
        >
          <div className="space-y-3">
            {/* Category chips — clickable to navigate, removable in edit mode */}
            <RelationshipChips
              values={editedCategories}
              onRemove={handleRemoveCategory}
              disabled={!isEditing}
              getLabel={(key) => {
                const cat = availableCategories.find((c) => c.key === key)
                return cat?.label || key
              }}
            />

            {/* Empty state */}
            {editedCategories.length === 0 && !isEditing && (
              <p className="text-sm text-muted-foreground italic">
                No categories assigned
              </p>
            )}

            {/* Add category combobox in edit mode */}
            {isEditing && (
              <EntityCombobox
                entityType="category"
                availableEntities={availableCategories.filter(
                  (c) => !editedCategories.includes(c.key)
                )}
                selectedKeys={[]}
                onChange={(keys) => {
                  if (keys.length > 0) {
                    handleAddCategory(keys[0])
                  }
                }}
                placeholder="Add category..."
              />
            )}

            {/* Clickable links (read-only mode) */}
            {!isEditing && editedCategories.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {editedCategories.map((catKey) => (
                  <button
                    key={catKey}
                    onClick={() => handleCategoryClick(catKey)}
                    className="text-xs text-primary hover:underline"
                  >
                    View {catKey}
                  </button>
                ))}
              </div>
            )}
          </div>
        </VisualChangeMarker>
      </AccordionSection>

      {/* Properties Section — driven by category schema */}
      <AccordionSection
        id="fields"
        title="Properties"
        count={mergedProperties.filter(
          (p) => editedDynamicFields[p.entity_key] !== undefined && editedDynamicFields[p.entity_key] !== ''
        ).length}
        defaultOpen
      >
        {mergedProperties.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            {editedCategories.length === 0
              ? 'No categories assigned — add a category to see available properties'
              : 'No properties defined for the selected categories'}
          </p>
        ) : (
          <div className="space-y-4">
            {mergedProperties.map((prop) => {
              const value = editedDynamicFields[prop.entity_key]
              return (
                <div key={prop.entity_key} className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                    {prop.label}
                    {prop.is_required && (
                      <span className="text-red-500 text-xs">required</span>
                    )}
                    {prop.source_categories.length > 1 && (
                      <span className="text-xs text-muted-foreground/60">
                        (from {prop.source_categories.join(', ')})
                      </span>
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
        )}
      </AccordionSection>

      {/* Wikitext Body Content */}
      <AccordionSection
        id="wikitext"
        title="Page Content"
        count={editedWikitext ? 1 : 0}
        defaultOpen={!!editedWikitext || isEditing}
      >
        <VisualChangeMarker
          status={editedWikitext !== (originalValues.wikitext || '') ? 'modified' : 'unchanged'}
          originalValue={originalValues.wikitext || ''}
        >
          {isEditing ? (
            <textarea
              value={editedWikitext}
              onChange={(e) => handleWikitextChange(e.target.value)}
              placeholder="Enter wikitext content for this resource page..."
              className="w-full min-h-[200px] p-3 text-sm font-mono border rounded-md bg-background resize-y focus:outline-none focus:ring-2 focus:ring-ring"
              spellCheck={false}
            />
          ) : editedWikitext ? (
            <pre className="text-sm p-3 bg-muted rounded-md whitespace-pre-wrap font-mono overflow-x-auto">
              {editedWikitext}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              No page content defined
            </p>
          )}
        </VisualChangeMarker>
      </AccordionSection>
    </div>
  )
}
