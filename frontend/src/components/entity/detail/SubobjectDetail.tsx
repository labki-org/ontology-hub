import { useEffect, useState, useCallback, useRef } from 'react'
import { useSubobject, useProperties } from '@/api/entities'
import { useAutoSave } from '@/hooks/useAutoSave'
import { useDraftStore } from '@/stores/draftStore'
import { EntityHeader } from '../sections/EntityHeader'
import { AccordionSection } from '../sections/AccordionSection'
import { MembershipSection } from '../sections/MembershipSection'
import { DeletedItemBadge } from '../form/DeletedItemBadge'
import { EntityCombobox } from '../forms/EntityCombobox'
import { RelationshipChips } from '../forms/RelationshipChips'
import { Skeleton } from '@/components/ui/skeleton'
import type { SubobjectDetailV2 } from '@/api/types'

interface SubobjectDetailProps {
  entityKey: string
  draftId?: string
  draftToken?: string
  isEditing: boolean
}

/**
 * Subobject detail view with:
 * - Header (name, label, description)
 * - Properties list (if available from canonical_json)
 * - Module membership display
 *
 * Note: Currently uses basic entity endpoint since there's no
 * dedicated subobject detail endpoint with where-used list yet.
 */
export function SubobjectDetail({
  entityKey,
  draftId,
  draftToken,
  isEditing,
}: SubobjectDetailProps) {
  const { data, isLoading, error } = useSubobject(entityKey, draftId)
  const openNestedCreateModal = useDraftStore((s) => s.openNestedCreateModal)
  const setOnNestedEntityCreated = useDraftStore((s) => s.setOnNestedEntityCreated)

  // Fetch available properties
  const { data: propertiesData } = useProperties(undefined, undefined, draftId)
  const availableProperties = (propertiesData?.items || []).map((p) => ({
    key: p.entity_key,
    label: p.label,
  }))

  // Cast to SubobjectDetailV2
  const subobject = data as SubobjectDetailV2 | undefined

  // Track original values
  const [originalValues, setOriginalValues] = useState<{
    label?: string
    description?: string
    requiredProperties?: string[]
    optionalProperties?: string[]
  }>({})

  // Local editable state
  const [editedLabel, setEditedLabel] = useState('')
  const [editedDescription, setEditedDescription] = useState('')

  // Property editable state
  const [editedRequiredProperties, setEditedRequiredProperties] = useState<string[]>([])
  const [editedOptionalProperties, setEditedOptionalProperties] = useState<string[]>([])
  const [deletedRequiredProperties, setDeletedRequiredProperties] = useState<Set<string>>(new Set())
  const [deletedOptionalProperties, setDeletedOptionalProperties] = useState<Set<string>>(new Set())

  // Track which entity we've initialized original values for (prevent reset on refetch)
  const initializedEntityRef = useRef<string | null>(null)

  // Auto-save hook
  const { saveChange, isSaving } = useAutoSave({
    draftToken: draftToken || '',
    entityType: 'subobject',
    entityKey,
    debounceMs: 500,
  })

  // Initialize state when subobject loads for a new entity (not on refetch)
  // This effect synchronizes local state with API data on entity change
  /* eslint-disable react-hooks/set-state-in-effect -- Valid sync with external data */
  useEffect(() => {
    if (subobject) {
      const isNewEntity = initializedEntityRef.current !== entityKey

      // Only reset edited values and original values for a NEW entity
      // (not on refetch after auto-save)
      if (isNewEntity) {
        setEditedLabel(subobject.label)
        setEditedDescription(subobject.description || '')

        // Extract property keys from subobject
        const reqProps = (subobject.required_properties || []).map((p) => p.entity_key)
        const optProps = (subobject.optional_properties || []).map((p) => p.entity_key)
        setEditedRequiredProperties(reqProps)
        setEditedOptionalProperties(optProps)

        setOriginalValues({
          label: subobject.label,
          description: subobject.description || '',
          requiredProperties: reqProps,
          optionalProperties: optProps,
        })

        // Clear deleted sets for new entity
        setDeletedRequiredProperties(new Set())
        setDeletedOptionalProperties(new Set())

        initializedEntityRef.current = entityKey
      }
    }
  }, [subobject, entityKey])
  /* eslint-enable react-hooks/set-state-in-effect */

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

  // Property handlers
  const handleAddRequiredProperty = useCallback(
    (propKey: string) => {
      if (propKey && !editedRequiredProperties.includes(propKey)) {
        const newProps = [...editedRequiredProperties.filter((p) => !deletedRequiredProperties.has(p)), propKey]
        setEditedRequiredProperties(newProps)
        if (draftToken) {
          saveChange([{ op: 'add', path: '/required_properties', value: newProps }])
        }
      }
    },
    [editedRequiredProperties, deletedRequiredProperties, draftToken, saveChange]
  )

  const handleDeleteRequiredProperty = useCallback(
    (propKey: string) => {
      setDeletedRequiredProperties((prev) => new Set([...prev, propKey]))
      const newProps = editedRequiredProperties.filter((p) => p !== propKey)
      if (draftToken) {
        saveChange([{ op: 'add', path: '/required_properties', value: newProps }])
      }
    },
    [editedRequiredProperties, draftToken, saveChange]
  )

  const handleUndoDeleteRequiredProperty = useCallback(
    (propKey: string) => {
      setDeletedRequiredProperties((prev) => {
        const next = new Set(prev)
        next.delete(propKey)
        return next
      })
      const newProps = [...editedRequiredProperties, propKey]
      setEditedRequiredProperties(newProps)
      if (draftToken) {
        saveChange([{ op: 'add', path: '/required_properties', value: newProps }])
      }
    },
    [editedRequiredProperties, draftToken, saveChange]
  )

  const handleAddOptionalProperty = useCallback(
    (propKey: string) => {
      if (propKey && !editedOptionalProperties.includes(propKey)) {
        const newProps = [...editedOptionalProperties.filter((p) => !deletedOptionalProperties.has(p)), propKey]
        setEditedOptionalProperties(newProps)
        if (draftToken) {
          saveChange([{ op: 'add', path: '/optional_properties', value: newProps }])
        }
      }
    },
    [editedOptionalProperties, deletedOptionalProperties, draftToken, saveChange]
  )

  const handleDeleteOptionalProperty = useCallback(
    (propKey: string) => {
      setDeletedOptionalProperties((prev) => new Set([...prev, propKey]))
      const newProps = editedOptionalProperties.filter((p) => p !== propKey)
      if (draftToken) {
        saveChange([{ op: 'add', path: '/optional_properties', value: newProps }])
      }
    },
    [editedOptionalProperties, draftToken, saveChange]
  )

  const handleUndoDeleteOptionalProperty = useCallback(
    (propKey: string) => {
      setDeletedOptionalProperties((prev) => {
        const next = new Set(prev)
        next.delete(propKey)
        return next
      })
      const newProps = [...editedOptionalProperties, propKey]
      setEditedOptionalProperties(newProps)
      if (draftToken) {
        saveChange([{ op: 'add', path: '/optional_properties', value: newProps }])
      }
    },
    [editedOptionalProperties, draftToken, saveChange]
  )

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (error || !subobject) {
    return (
      <div className="p-6 text-center text-destructive">
        <p className="font-medium">Failed to load subobject</p>
        <p className="text-sm text-muted-foreground mt-1">
          {error instanceof Error ? error.message : 'Subobject not found'}
        </p>
      </div>
    )
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
        entityType="subobject"
        changeStatus={subobject.change_status}
        isEditing={isEditing}
        originalLabel={originalValues.label}
        originalDescription={originalValues.description}
        onLabelChange={handleLabelChange}
        onDescriptionChange={handleDescriptionChange}
      />

      {/* Properties Section - Editable */}
      <AccordionSection
        id="properties"
        title="Properties"
        count={
          editedRequiredProperties.filter((p) => !deletedRequiredProperties.has(p)).length +
          editedOptionalProperties.filter((p) => !deletedOptionalProperties.has(p)).length
        }
        defaultOpen
      >
        <div className="space-y-4">
          {/* Required Properties */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Required Properties</h4>
            <RelationshipChips
              values={editedRequiredProperties.filter((p) => !deletedRequiredProperties.has(p))}
              onRemove={handleDeleteRequiredProperty}
              disabled={!isEditing}
              getLabel={(key) => {
                const prop = availableProperties.find((p) => p.key === key)
                return prop?.label || key
              }}
            />
            {/* Soft-deleted required properties */}
            {Array.from(deletedRequiredProperties).map((propKey) => (
              <DeletedItemBadge
                key={`deleted-req-prop-${propKey}`}
                label={availableProperties.find((p) => p.key === propKey)?.label || propKey}
                onUndo={() => handleUndoDeleteRequiredProperty(propKey)}
              />
            ))}
            {/* Empty state */}
            {editedRequiredProperties.filter((p) => !deletedRequiredProperties.has(p)).length === 0 &&
              deletedRequiredProperties.size === 0 &&
              !isEditing && (
                <p className="text-sm text-muted-foreground italic">No required properties</p>
              )}
            {/* Add required property in edit mode */}
            {isEditing && (
              <EntityCombobox
                entityType="property"
                availableEntities={availableProperties.filter(
                  (p) =>
                    !editedRequiredProperties.includes(p.key) &&
                    !editedOptionalProperties.includes(p.key)
                )}
                selectedKeys={[]}
                onChange={(keys) => {
                  if (keys.length > 0) {
                    handleAddRequiredProperty(keys[0])
                  }
                }}
                onCreateNew={(id) => {
                  setOnNestedEntityCreated((newKey: string) => {
                    handleAddRequiredProperty(newKey)
                  })
                  openNestedCreateModal({
                    entityType: 'property',
                    prefilledId: id,
                    parentContext: { entityType: 'subobject', fieldName: 'Required Properties' },
                  })
                }}
                placeholder="Add required property..."
              />
            )}
          </div>

          {/* Optional Properties */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Optional Properties</h4>
            <RelationshipChips
              values={editedOptionalProperties.filter((p) => !deletedOptionalProperties.has(p))}
              onRemove={handleDeleteOptionalProperty}
              disabled={!isEditing}
              getLabel={(key) => {
                const prop = availableProperties.find((p) => p.key === key)
                return prop?.label || key
              }}
            />
            {/* Soft-deleted optional properties */}
            {Array.from(deletedOptionalProperties).map((propKey) => (
              <DeletedItemBadge
                key={`deleted-opt-prop-${propKey}`}
                label={availableProperties.find((p) => p.key === propKey)?.label || propKey}
                onUndo={() => handleUndoDeleteOptionalProperty(propKey)}
              />
            ))}
            {/* Empty state */}
            {editedOptionalProperties.filter((p) => !deletedOptionalProperties.has(p)).length === 0 &&
              deletedOptionalProperties.size === 0 &&
              !isEditing && (
                <p className="text-sm text-muted-foreground italic">No optional properties</p>
              )}
            {/* Add optional property in edit mode */}
            {isEditing && (
              <EntityCombobox
                entityType="property"
                availableEntities={availableProperties.filter(
                  (p) =>
                    !editedRequiredProperties.includes(p.key) &&
                    !editedOptionalProperties.includes(p.key)
                )}
                selectedKeys={[]}
                onChange={(keys) => {
                  if (keys.length > 0) {
                    handleAddOptionalProperty(keys[0])
                  }
                }}
                onCreateNew={(id) => {
                  setOnNestedEntityCreated((newKey: string) => {
                    handleAddOptionalProperty(newKey)
                  })
                  openNestedCreateModal({
                    entityType: 'property',
                    prefilledId: id,
                    parentContext: { entityType: 'subobject', fieldName: 'Optional Properties' },
                  })
                }}
                placeholder="Add optional property..."
              />
            )}
          </div>
        </div>
      </AccordionSection>

      {/* Where-used section - placeholder for future API */}
      <AccordionSection id="used-by" title="Used By" defaultOpen>
        <p className="text-sm text-muted-foreground italic">
          Where-used tracking not yet available for subobjects
        </p>
      </AccordionSection>

      {/* Module membership - TODO: needs API */}
      <MembershipSection modules={[]} bundles={[]} />
    </div>
  )
}
