import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useResource, useCategories } from '@/api/entities'
import { useAutoSave } from '@/hooks/useAutoSave'
import { useGraphStore } from '@/stores/graphStore'
import { AccordionSection } from '../sections/AccordionSection'
import { EntityCombobox } from '../forms/EntityCombobox'
import { RelationshipChips } from '../forms/RelationshipChips'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { VisualChangeMarker } from '../form/VisualChangeMarker'
import type { ResourceDetailV2 } from '@/api/types'

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
  }>({})

  // Local editable state
  const [editedCategories, setEditedCategories] = useState<string[]>([])
  const [editedDynamicFields, setEditedDynamicFields] = useState<Record<string, unknown>>({})

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

        setOriginalValues({
          category_keys: resource.category_keys || [],
          dynamic_fields: resource.dynamic_fields || {},
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
      setEditedDynamicFields((prev) => ({
        ...prev,
        [fieldKey]: value,
      }))
      if (draftToken) {
        const updatedFields = { ...editedDynamicFields, [fieldKey]: value }
        saveChange([{ op: 'add', path: '/dynamic_fields', value: updatedFields }])
      }
    },
    [draftToken, saveChange, editedDynamicFields]
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
  const fieldEntries = Object.entries(editedDynamicFields)

  const isFieldModified = (fieldKey: string): boolean => {
    const original = originalValues.dynamic_fields?.[fieldKey]
    const current = editedDynamicFields[fieldKey]
    return JSON.stringify(original) !== JSON.stringify(current)
  }

  const areCategoriesModified =
    JSON.stringify(editedCategories) !== JSON.stringify(originalValues.category_keys)

  const statusBadge = resource.change_status && resource.change_status !== 'unchanged' && (
    <Badge
      variant={
        resource.change_status === 'added'
          ? 'default'
          : resource.change_status === 'modified'
          ? 'secondary'
          : 'destructive'
      }
      className={
        resource.change_status === 'added'
          ? 'bg-green-500 hover:bg-green-600'
          : resource.change_status === 'modified'
          ? 'bg-yellow-500 hover:bg-yellow-600'
          : ''
      }
    >
      {resource.change_status === 'added'
        ? '+ Added'
        : resource.change_status === 'modified'
        ? '~ Modified'
        : '- Deleted'}
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

      {/* Dynamic Fields Section */}
      <AccordionSection
        id="fields"
        title="Properties"
        count={fieldEntries.length}
        defaultOpen
      >
        {fieldEntries.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            No properties defined
          </p>
        ) : (
          <div className="space-y-4">
            {fieldEntries.map(([key, value]) => (
              <div key={key} className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">
                  {key}
                </label>
                {isEditing ? (
                  <VisualChangeMarker
                    status={isFieldModified(key) ? 'modified' : 'unchanged'}
                    originalValue={String(originalValues.dynamic_fields?.[key] ?? '')}
                  >
                    <Input
                      value={String(value ?? '')}
                      onChange={(e) => handleDynamicFieldChange(key, e.target.value)}
                      placeholder={`Enter ${key}...`}
                    />
                  </VisualChangeMarker>
                ) : (
                  <VisualChangeMarker
                    status={isFieldModified(key) ? 'modified' : 'unchanged'}
                    originalValue={String(originalValues.dynamic_fields?.[key] ?? '')}
                  >
                    <div className="text-sm py-2">
                      {formatValue(value)}
                    </div>
                  </VisualChangeMarker>
                )}
              </div>
            ))}
          </div>
        )}
      </AccordionSection>
    </div>
  )
}
