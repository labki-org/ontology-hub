import { useEffect, useState, useCallback, useRef } from 'react'
import { useResource } from '@/api/entities'
import { useAutoSave } from '@/hooks/useAutoSave'
import { useGraphStore } from '@/stores/graphStore'
import { AccordionSection } from '../sections/AccordionSection'
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
 * Handles strings, numbers, arrays, objects, and null/undefined.
 */
function formatValue(value: unknown): string | JSX.Element {
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

/**
 * Resource detail view with:
 * - Simple header (entity key + category link)
 * - Dynamic fields displayed in flat list
 * - Simple text input for field editing in draft mode
 *
 * Resources are data instances - they have an ID, category, and dynamic fields.
 * Unlike schema entities, they don't have label/description fields.
 */
export function ResourceDetail({
  entityKey,
  draftId,
  draftToken,
  isEditing,
}: ResourceDetailProps) {
  const { data, isLoading, error } = useResource(entityKey, draftId)
  const setSelectedEntity = useGraphStore((s) => s.setSelectedEntity)

  // Cast to ResourceDetailV2
  const resource = data as ResourceDetailV2 | undefined

  // Track original values for change detection
  const [originalValues, setOriginalValues] = useState<{
    dynamic_fields?: Record<string, unknown>
  }>({})

  // Local editable state - only dynamic fields (resources don't have label/description)
  const [editedDynamicFields, setEditedDynamicFields] = useState<Record<string, unknown>>({})

  // Track which entity we've initialized original values for (prevent reset on refetch)
  const initializedEntityRef = useRef<string | null>(null)

  // Auto-save hook
  const { saveChange, isSaving } = useAutoSave({
    draftToken: draftToken || '',
    entityType: 'resource',
    entityKey,
    debounceMs: 500,
  })

  // Initialize state when resource loads for a new entity (not on refetch)
  /* eslint-disable react-hooks/set-state-in-effect -- Valid sync with external data */
  useEffect(() => {
    if (resource) {
      const isNewEntity = initializedEntityRef.current !== entityKey

      // Only reset edited values and original values for a NEW entity
      // (not on refetch after auto-save)
      if (isNewEntity) {
        setEditedDynamicFields(resource.dynamic_fields || {})

        setOriginalValues({
          dynamic_fields: resource.dynamic_fields || {},
        })

        initializedEntityRef.current = entityKey
      }
    }
  }, [resource, entityKey])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Change handler for dynamic fields - use 'add' instead of 'replace' for robustness
  const handleDynamicFieldChange = useCallback(
    (fieldKey: string, value: string) => {
      setEditedDynamicFields((prev) => ({
        ...prev,
        [fieldKey]: value,
      }))
      if (draftToken) {
        // Update the dynamic_fields object with the new value
        const updatedFields = { ...editedDynamicFields, [fieldKey]: value }
        saveChange([{ op: 'add', path: '/dynamic_fields', value: updatedFields }])
      }
    },
    [draftToken, saveChange, editedDynamicFields]
  )

  // Navigate to category detail
  const handleCategoryClick = useCallback(() => {
    if (resource?.category_key) {
      setSelectedEntity(resource.category_key, 'category')
    }
  }, [resource?.category_key, setSelectedEntity])

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

  // Extract the resource ID from entity_key (format: "category/id")
  const resourceId = entityKey.includes('/') ? entityKey.split('/').pop() : entityKey

  // Get dynamic field entries
  const fieldEntries = Object.entries(editedDynamicFields)

  // Check if a specific field was modified
  const isFieldModified = (fieldKey: string): boolean => {
    const original = originalValues.dynamic_fields?.[fieldKey]
    const current = editedDynamicFields[fieldKey]
    return JSON.stringify(original) !== JSON.stringify(current)
  }

  // Change status badge
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

      {/* Simple Header - Resources don't have label/description */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="capitalize">
            resource
          </Badge>
          {statusBadge}
        </div>

        {/* Resource ID as title */}
        <h2 className="text-2xl font-bold">{resourceId}</h2>

        {/* Category Link - prominent placement */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Category:</span>
          <button
            onClick={handleCategoryClick}
            className="text-primary hover:underline font-medium"
          >
            {resource.category_key}
          </button>
        </div>
      </div>

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
