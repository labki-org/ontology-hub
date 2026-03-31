import { useEffect, useState, useCallback, useRef } from 'react'
import { useSubobject, useProperties } from '@/api/entities'
import { useAutoSave } from '@/hooks/useAutoSave'
import { useDraftStore } from '@/stores/draftStore'
import { EntityHeader } from '../sections/EntityHeader'
import { AccordionSection } from '../sections/AccordionSection'
import { SubsectionHeader } from '../sections/SubsectionHeader'
import { SaveIndicator } from '../sections/SaveIndicator'
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
  const { data: propertiesData } = useProperties(undefined, 500, draftId)
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

  const activeRequiredProps = editedRequiredProperties.filter((p) => !deletedRequiredProperties.has(p))
  const activeOptionalProps = editedOptionalProperties.filter((p) => !deletedOptionalProperties.has(p))

  return (
    <div className="px-4 py-3">
      <SaveIndicator isSaving={isSaving} />

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

      <AccordionSection
        id="properties"
        title="Properties"
        count={activeRequiredProps.length + activeOptionalProps.length}
        defaultOpen
        colorHint="property"
      >
        <div className="space-y-4">
          {(activeRequiredProps.length > 0 || deletedRequiredProperties.size > 0 || isEditing) && (
            <div className="space-y-1.5">
              <SubsectionHeader>Required</SubsectionHeader>
              <div className="pl-2">
                <RelationshipChips
                  values={activeRequiredProps}
                  onRemove={handleDeleteRequiredProperty}
                  disabled={!isEditing}
                  colorHint="property"
                  getLabel={(key) => {
                    const prop = availableProperties.find((p) => p.key === key)
                    return prop?.label || key
                  }}
                />
                {Array.from(deletedRequiredProperties).map((propKey) => (
                  <DeletedItemBadge
                    key={`deleted-req-prop-${propKey}`}
                    label={availableProperties.find((p) => p.key === propKey)?.label || propKey}
                    onUndo={() => handleUndoDeleteRequiredProperty(propKey)}
                  />
                ))}
                {activeRequiredProps.length === 0 && deletedRequiredProperties.size === 0 && isEditing && (
                  <p className="text-xs text-muted-foreground/60">None</p>
                )}
                {isEditing && (
                  <div className="mt-1.5">
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
                  </div>
                )}
              </div>
            </div>
          )}

          {(activeOptionalProps.length > 0 || deletedOptionalProperties.size > 0 || isEditing) && (
            <div className="space-y-1.5">
              <SubsectionHeader>Optional</SubsectionHeader>
              <div className="pl-2">
                <RelationshipChips
                  values={activeOptionalProps}
                  onRemove={handleDeleteOptionalProperty}
                  disabled={!isEditing}
                  colorHint="property"
                  getLabel={(key) => {
                    const prop = availableProperties.find((p) => p.key === key)
                    return prop?.label || key
                  }}
                />
                {Array.from(deletedOptionalProperties).map((propKey) => (
                  <DeletedItemBadge
                    key={`deleted-opt-prop-${propKey}`}
                    label={availableProperties.find((p) => p.key === propKey)?.label || propKey}
                    onUndo={() => handleUndoDeleteOptionalProperty(propKey)}
                  />
                ))}
                {activeOptionalProps.length === 0 && deletedOptionalProperties.size === 0 && isEditing && (
                  <p className="text-xs text-muted-foreground/60">None</p>
                )}
                {isEditing && (
                  <div className="mt-1.5">
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
                  </div>
                )}
              </div>
            </div>
          )}

          {activeRequiredProps.length === 0 && activeOptionalProps.length === 0 && !isEditing && (
            <p className="text-xs text-muted-foreground/60">No properties</p>
          )}
        </div>
      </AccordionSection>

      <AccordionSection id="used-by" title="Used By" defaultOpen>
        <p className="text-xs text-muted-foreground/60">
          Where-used tracking not yet available for subobjects
        </p>
      </AccordionSection>

      <MembershipSection modules={subobject.modules || []} bundles={subobject.bundles || []} />
    </div>
  )
}
