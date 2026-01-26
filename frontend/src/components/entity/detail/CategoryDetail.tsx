import { useEffect, useState, useCallback, useRef } from 'react'
import { useCategory, useCategories, useProperties, useSubobjects } from '@/api/entitiesV2'
import { useAutoSave } from '@/hooks/useAutoSave'
import { useDetailStore } from '@/stores/detailStore'
import { useDraftStoreV2 } from '@/stores/draftStoreV2'
import { EntityHeader } from '../sections/EntityHeader'
import { AccordionSection } from '../sections/AccordionSection'
import { MembershipSection } from '../sections/MembershipSection'
import { DeletedItemBadge } from '../form/DeletedItemBadge'
import { EntityCombobox } from '../forms/EntityCombobox'
import { RelationshipChips } from '../forms/RelationshipChips'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface CategoryDetailProps {
  entityKey: string
  /** Draft UUID for query params (fetching effective views) */
  draftId?: string
  /** Draft capability token for mutations */
  draftToken?: string
  isEditing: boolean
}

/**
 * Category detail view with:
 * - Header (name, label, description)
 * - Parents list with add/remove in edit mode
 * - Direct properties
 * - Inherited properties grouped by parent with provenance
 * - Module/bundle membership
 */
export function CategoryDetail({
  entityKey,
  draftId,
  draftToken,
  isEditing,
}: CategoryDetailProps) {
  const { data: rawCategory, isLoading, error } = useCategory(entityKey, draftId)
  const { data: categoriesData } = useCategories(undefined, undefined, draftId)
  const openDetail = useDetailStore((s) => s.openDetail)
  const pushBreadcrumb = useDetailStore((s) => s.pushBreadcrumb)
  const openNestedCreateModal = useDraftStoreV2((s) => s.openNestedCreateModal)
  const setOnNestedEntityCreated = useDraftStoreV2((s) => s.setOnNestedEntityCreated)

  // Build available categories for parent selection (excluding self)
  const availableCategories = (categoriesData?.items || [])
    .filter((c) => c.entity_key !== entityKey)
    .map((c) => ({
      key: c.entity_key,
      label: c.label,
    }))

  // Fetch available properties for property fields
  const { data: propertiesData } = useProperties(undefined, undefined, draftId)
  const availableProperties = (propertiesData?.items || []).map((p) => ({
    key: p.entity_key,
    label: p.label,
  }))

  // Fetch available subobjects for subobject fields
  const { data: subobjectsData } = useSubobjects(undefined, undefined, draftId)
  const availableSubobjects = (subobjectsData?.items || []).map((s) => ({
    key: s.entity_key,
    label: s.label,
  }))

  // Change tracking state for inheritance chain highlighting
  const directEdits = useDraftStoreV2((s) => s.directlyEditedEntities)
  const transitiveAffects = useDraftStoreV2((s) => s.transitivelyAffectedEntities)

  // Check if current entity is transitively affected by parent edits
  const isTransitivelyAffected = transitiveAffects.has(entityKey)

  // Type guard: ensure we have CategoryDetailV2
  const category = rawCategory && 'parents' in rawCategory ? rawCategory : null

  // Track original values for change detection
  const [originalValues, setOriginalValues] = useState<{
    label?: string
    description?: string
    parents?: string[]
    requiredProperties?: string[]
    optionalProperties?: string[]
    requiredSubobjects?: string[]
    optionalSubobjects?: string[]
  }>({})

  // Local editable state
  const [editedLabel, setEditedLabel] = useState('')
  const [editedDescription, setEditedDescription] = useState('')
  const [editedParents, setEditedParents] = useState<string[]>([])
  // Track soft-deleted parents (stay in position with "Deleted" badge until save)
  const [deletedParents, setDeletedParents] = useState<Set<string>>(new Set())

  // Property and subobject editable state
  const [editedRequiredProperties, setEditedRequiredProperties] = useState<string[]>([])
  const [editedOptionalProperties, setEditedOptionalProperties] = useState<string[]>([])
  const [editedRequiredSubobjects, setEditedRequiredSubobjects] = useState<string[]>([])
  const [editedOptionalSubobjects, setEditedOptionalSubobjects] = useState<string[]>([])

  // Track soft-deleted items
  const [deletedRequiredProperties, setDeletedRequiredProperties] = useState<Set<string>>(new Set())
  const [deletedOptionalProperties, setDeletedOptionalProperties] = useState<Set<string>>(new Set())
  const [deletedRequiredSubobjects, setDeletedRequiredSubobjects] = useState<Set<string>>(new Set())
  const [deletedOptionalSubobjects, setDeletedOptionalSubobjects] = useState<Set<string>>(new Set())

  // Track which entity we've initialized original values for (prevent reset on refetch)
  const initializedEntityRef = useRef<string | null>(null)

  // Auto-save hook - uses draftToken for mutations
  const { saveChange, isSaving } = useAutoSave({
    draftToken: draftToken || '',
    entityType: 'category',
    entityKey,
    debounceMs: 500,
  })

  // Initialize state when category loads
  useEffect(() => {
    if (category) {
      const isNewEntity = initializedEntityRef.current !== entityKey

      // Only reset edited values and original values for a NEW entity
      // (not on refetch after auto-save)
      if (isNewEntity) {
        setEditedLabel(category.label)
        setEditedDescription(category.description || '')
        setEditedParents(category.parents || [])

        // Extract direct required/optional properties from category.properties
        const reqProps = (category.properties || [])
          .filter((p) => p.is_required && p.is_direct)
          .map((p) => p.entity_key)
        const optProps = (category.properties || [])
          .filter((p) => !p.is_required && p.is_direct)
          .map((p) => p.entity_key)
        setEditedRequiredProperties(reqProps)
        setEditedOptionalProperties(optProps)

        // Extract required/optional subobjects
        const reqSubobjs = (category.subobjects || [])
          .filter((s) => s.is_required)
          .map((s) => s.entity_key)
        const optSubobjs = (category.subobjects || [])
          .filter((s) => !s.is_required)
          .map((s) => s.entity_key)
        setEditedRequiredSubobjects(reqSubobjs)
        setEditedOptionalSubobjects(optSubobjs)

        // Store originals for comparison (only on initial load)
        setOriginalValues({
          label: category.label,
          description: category.description || '',
          parents: category.parents || [],
          requiredProperties: reqProps,
          optionalProperties: optProps,
          requiredSubobjects: reqSubobjs,
          optionalSubobjects: optSubobjs,
        })

        // Clear deleted sets for new entity
        setDeletedParents(new Set())
        setDeletedRequiredProperties(new Set())
        setDeletedOptionalProperties(new Set())
        setDeletedRequiredSubobjects(new Set())
        setDeletedOptionalSubobjects(new Set())

        initializedEntityRef.current = entityKey
      }

      // Always update breadcrumbs
      pushBreadcrumb(entityKey, 'category', category.label)
    }
  }, [category, entityKey, pushBreadcrumb])

  // Change handlers with auto-save
  const handleLabelChange = useCallback(
    (value: string) => {
      setEditedLabel(value)
      if (draftToken) {
        saveChange([{ op: 'replace', path: '/label', value }])
      }
    },
    [draftId, saveChange]
  )

  const handleDescriptionChange = useCallback(
    (value: string) => {
      setEditedDescription(value)
      if (draftToken) {
        saveChange([{ op: 'replace', path: '/description', value }])
      }
    },
    [draftId, saveChange]
  )

  // Soft delete: mark parent as deleted (shows DeletedItemBadge with undo)
  const handleDeleteParent = useCallback(
    (parent: string) => {
      setDeletedParents((prev) => new Set([...prev, parent]))
      // Save the change with parent removed from list
      const newParents = editedParents.filter((p) => p !== parent)
      if (draftToken) {
        // Use 'add' not 'replace' because canonical_json doesn't have parents field
        saveChange([{ op: 'add', path: '/parents', value: newParents }])
      }
    },
    [editedParents, draftToken, saveChange]
  )

  // Undo soft delete: restore parent to list
  const handleUndoDeleteParent = useCallback(
    (parent: string) => {
      setDeletedParents((prev) => {
        const next = new Set(prev)
        next.delete(parent)
        return next
      })
      // Re-add parent to the list
      const newParents = [...editedParents, parent]
      setEditedParents(newParents)
      if (draftToken) {
        // Use 'add' not 'replace' because canonical_json doesn't have parents field
        saveChange([{ op: 'add', path: '/parents', value: newParents }])
      }
    },
    [editedParents, draftToken, saveChange]
  )

  // Handler for adding new parent
  const handleAddNewParent = useCallback(
    (parentKey: string) => {
      if (parentKey && !editedParents.includes(parentKey)) {
        const newParents = [...editedParents.filter((p) => !deletedParents.has(p)), parentKey]
        setEditedParents(newParents)
        if (draftToken) {
          // Use 'add' not 'replace' because canonical_json doesn't have parents field
          saveChange([{ op: 'add', path: '/parents', value: newParents }])
        }
      }
    },
    [editedParents, deletedParents, draftToken, saveChange]
  )

  const handleRevertDescription = useCallback(() => {
    setEditedDescription(originalValues.description || '')
    if (draftToken) {
      saveChange([
        { op: 'replace', path: '/description', value: originalValues.description },
      ])
    }
  }, [originalValues.description, draftId, saveChange])

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

  // Subobject handlers
  const handleAddRequiredSubobject = useCallback(
    (subKey: string) => {
      if (subKey && !editedRequiredSubobjects.includes(subKey)) {
        const newSubs = [...editedRequiredSubobjects.filter((s) => !deletedRequiredSubobjects.has(s)), subKey]
        setEditedRequiredSubobjects(newSubs)
        if (draftToken) {
          saveChange([{ op: 'add', path: '/required_subobjects', value: newSubs }])
        }
      }
    },
    [editedRequiredSubobjects, deletedRequiredSubobjects, draftToken, saveChange]
  )

  const handleDeleteRequiredSubobject = useCallback(
    (subKey: string) => {
      setDeletedRequiredSubobjects((prev) => new Set([...prev, subKey]))
      const newSubs = editedRequiredSubobjects.filter((s) => s !== subKey)
      if (draftToken) {
        saveChange([{ op: 'add', path: '/required_subobjects', value: newSubs }])
      }
    },
    [editedRequiredSubobjects, draftToken, saveChange]
  )

  const handleUndoDeleteRequiredSubobject = useCallback(
    (subKey: string) => {
      setDeletedRequiredSubobjects((prev) => {
        const next = new Set(prev)
        next.delete(subKey)
        return next
      })
      const newSubs = [...editedRequiredSubobjects, subKey]
      setEditedRequiredSubobjects(newSubs)
      if (draftToken) {
        saveChange([{ op: 'add', path: '/required_subobjects', value: newSubs }])
      }
    },
    [editedRequiredSubobjects, draftToken, saveChange]
  )

  const handleAddOptionalSubobject = useCallback(
    (subKey: string) => {
      if (subKey && !editedOptionalSubobjects.includes(subKey)) {
        const newSubs = [...editedOptionalSubobjects.filter((s) => !deletedOptionalSubobjects.has(s)), subKey]
        setEditedOptionalSubobjects(newSubs)
        if (draftToken) {
          saveChange([{ op: 'add', path: '/optional_subobjects', value: newSubs }])
        }
      }
    },
    [editedOptionalSubobjects, deletedOptionalSubobjects, draftToken, saveChange]
  )

  const handleDeleteOptionalSubobject = useCallback(
    (subKey: string) => {
      setDeletedOptionalSubobjects((prev) => new Set([...prev, subKey]))
      const newSubs = editedOptionalSubobjects.filter((s) => s !== subKey)
      if (draftToken) {
        saveChange([{ op: 'add', path: '/optional_subobjects', value: newSubs }])
      }
    },
    [editedOptionalSubobjects, draftToken, saveChange]
  )

  const handleUndoDeleteOptionalSubobject = useCallback(
    (subKey: string) => {
      setDeletedOptionalSubobjects((prev) => {
        const next = new Set(prev)
        next.delete(subKey)
        return next
      })
      const newSubs = [...editedOptionalSubobjects, subKey]
      setEditedOptionalSubobjects(newSubs)
      if (draftToken) {
        saveChange([{ op: 'add', path: '/optional_subobjects', value: newSubs }])
      }
    },
    [editedOptionalSubobjects, draftToken, saveChange]
  )

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (error || !category) {
    return (
      <div className="p-6 text-center text-destructive">
        <p className="font-medium">Failed to load category</p>
        <p className="text-sm text-muted-foreground mt-1">
          {error instanceof Error ? error.message : 'Category not found'}
        </p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Saving indicator */}
      {isSaving && (
        <div className="fixed top-4 right-4 bg-primary text-primary-foreground px-3 py-1 rounded text-sm">
          Saving...
        </div>
      )}

      {/* Transitive effect indicator */}
      {isTransitivelyAffected && (
        <div className="mb-4 p-2 rounded bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            This category may be affected by changes to a parent category.
          </p>
        </div>
      )}

      {/* Header */}
      <EntityHeader
        entityKey={entityKey}
        label={editedLabel}
        description={editedDescription}
        entityType="category"
        changeStatus={category.change_status}
        isEditing={isEditing}
        originalLabel={originalValues.label}
        originalDescription={originalValues.description}
        onLabelChange={handleLabelChange}
        onDescriptionChange={handleDescriptionChange}
        onRevertDescription={handleRevertDescription}
      />

      {/* Parents section with EntityCombobox for adding and RelationshipChips for display */}
      <AccordionSection
        id="parents"
        title="Parent Categories"
        count={editedParents.filter((p) => !deletedParents.has(p)).length}
      >
        <div className="space-y-3">
          {/* Current parents as chips */}
          <RelationshipChips
            values={editedParents.filter((p) => !deletedParents.has(p))}
            onRemove={handleDeleteParent}
            disabled={!isEditing}
            getLabel={(key) => {
              const cat = availableCategories.find((c) => c.key === key)
              return cat?.label || key
            }}
          />

          {/* Soft-deleted parents with undo option */}
          {Array.from(deletedParents).map((parent) => (
            <DeletedItemBadge
              key={`deleted-${parent}`}
              label={availableCategories.find((c) => c.key === parent)?.label || parent}
              onUndo={() => handleUndoDeleteParent(parent)}
            />
          ))}

          {/* Empty state */}
          {editedParents.filter((p) => !deletedParents.has(p)).length === 0 &&
            deletedParents.size === 0 &&
            !isEditing && (
              <p className="text-sm text-muted-foreground italic">
                No parent categories (root category)
              </p>
            )}

          {/* Add parent via combobox in edit mode */}
          {isEditing && (
            <EntityCombobox
              entityType="category"
              availableEntities={availableCategories.filter(
                (c) => !editedParents.includes(c.key) || deletedParents.has(c.key)
              )}
              selectedKeys={[]}
              onChange={(keys) => {
                if (keys.length > 0) {
                  handleAddNewParent(keys[0])
                }
              }}
              onCreateNew={(id) => {
                // Set callback to add created entity to parents
                setOnNestedEntityCreated((newKey: string) => {
                  handleAddNewParent(newKey)
                })
                // Open nested modal with prefilled ID
                openNestedCreateModal({
                  entityType: 'category',
                  prefilledId: id,
                  parentContext: { entityType: 'category', fieldName: 'Parent Categories' },
                })
              }}
              placeholder="Add parent category..."
            />
          )}
        </div>
      </AccordionSection>

      {/* Inheritance Chain section - shows parents with edit status */}
      {category.parents && category.parents.length > 0 && (
        <AccordionSection
          id="inheritance-chain"
          title="Inheritance Chain"
          count={category.parents.length}
          defaultOpen={false}
        >
          <div className="space-y-1">
            {category.parents.map((parentKey) => {
              const isParentEdited = directEdits.has(parentKey)
              return (
                <button
                  key={parentKey}
                  onClick={() => openDetail(parentKey, 'category')}
                  className={cn(
                    'w-full text-left px-2 py-1.5 text-sm rounded flex items-center gap-2',
                    'hover:bg-sidebar-accent transition-colors',
                    isParentEdited && 'bg-blue-100 dark:bg-blue-900/30 font-medium'
                  )}
                >
                  <span className="flex-1 truncate">{parentKey}</span>
                  {isParentEdited && (
                    <Badge variant="secondary" className="text-xs bg-blue-200 dark:bg-blue-800">
                      edited
                    </Badge>
                  )}
                </button>
              )
            })}
          </div>
          {category.parents.some((p) => directEdits.has(p)) && (
            <p className="text-xs text-muted-foreground mt-2 px-2">
              Edited ancestors may affect this category's inherited properties.
            </p>
          )}
        </AccordionSection>
      )}

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
                    parentContext: { entityType: 'category', fieldName: 'Required Properties' },
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
                    parentContext: { entityType: 'category', fieldName: 'Optional Properties' },
                  })
                }}
                placeholder="Add optional property..."
              />
            )}
          </div>

          {/* Inherited Properties (read-only) */}
          {category.properties &&
            category.properties.filter((p) => p.is_inherited).length > 0 && (
              <div className="space-y-2 pt-2 border-t">
                <h4 className="text-sm font-medium text-muted-foreground">
                  Inherited Properties
                </h4>
                {category.properties
                  .filter((p) => p.is_inherited)
                  .map((prop) => (
                    <button
                      key={prop.entity_key}
                      onClick={() => openDetail(prop.entity_key, 'property')}
                      className="w-full text-left px-2 py-1.5 text-sm rounded flex items-center gap-2 hover:bg-sidebar-accent transition-colors"
                    >
                      <span className="flex-1 truncate">{prop.label}</span>
                      <Badge variant="secondary" className="text-xs">
                        from {prop.source_category}
                      </Badge>
                    </button>
                  ))}
              </div>
            )}
        </div>
      </AccordionSection>

      {/* Subobjects Section - Editable */}
      <AccordionSection
        id="subobjects"
        title="Subobjects"
        count={
          editedRequiredSubobjects.filter((s) => !deletedRequiredSubobjects.has(s)).length +
          editedOptionalSubobjects.filter((s) => !deletedOptionalSubobjects.has(s)).length
        }
        defaultOpen
      >
        <div className="space-y-4">
          {/* Required Subobjects */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Required Subobjects</h4>
            <RelationshipChips
              values={editedRequiredSubobjects.filter((s) => !deletedRequiredSubobjects.has(s))}
              onRemove={handleDeleteRequiredSubobject}
              disabled={!isEditing}
              getLabel={(key) => {
                const sub = availableSubobjects.find((s) => s.key === key)
                return sub?.label || key
              }}
            />
            {/* Soft-deleted required subobjects */}
            {Array.from(deletedRequiredSubobjects).map((subKey) => (
              <DeletedItemBadge
                key={`deleted-req-sub-${subKey}`}
                label={availableSubobjects.find((s) => s.key === subKey)?.label || subKey}
                onUndo={() => handleUndoDeleteRequiredSubobject(subKey)}
              />
            ))}
            {/* Empty state */}
            {editedRequiredSubobjects.filter((s) => !deletedRequiredSubobjects.has(s)).length === 0 &&
              deletedRequiredSubobjects.size === 0 &&
              !isEditing && (
                <p className="text-sm text-muted-foreground italic">No required subobjects</p>
              )}
            {/* Add required subobject in edit mode */}
            {isEditing && (
              <EntityCombobox
                entityType="subobject"
                availableEntities={availableSubobjects.filter(
                  (s) =>
                    !editedRequiredSubobjects.includes(s.key) &&
                    !editedOptionalSubobjects.includes(s.key)
                )}
                selectedKeys={[]}
                onChange={(keys) => {
                  if (keys.length > 0) {
                    handleAddRequiredSubobject(keys[0])
                  }
                }}
                onCreateNew={(id) => {
                  setOnNestedEntityCreated((newKey: string) => {
                    handleAddRequiredSubobject(newKey)
                  })
                  openNestedCreateModal({
                    entityType: 'subobject',
                    prefilledId: id,
                    parentContext: { entityType: 'category', fieldName: 'Required Subobjects' },
                  })
                }}
                placeholder="Add required subobject..."
              />
            )}
          </div>

          {/* Optional Subobjects */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Optional Subobjects</h4>
            <RelationshipChips
              values={editedOptionalSubobjects.filter((s) => !deletedOptionalSubobjects.has(s))}
              onRemove={handleDeleteOptionalSubobject}
              disabled={!isEditing}
              getLabel={(key) => {
                const sub = availableSubobjects.find((s) => s.key === key)
                return sub?.label || key
              }}
            />
            {/* Soft-deleted optional subobjects */}
            {Array.from(deletedOptionalSubobjects).map((subKey) => (
              <DeletedItemBadge
                key={`deleted-opt-sub-${subKey}`}
                label={availableSubobjects.find((s) => s.key === subKey)?.label || subKey}
                onUndo={() => handleUndoDeleteOptionalSubobject(subKey)}
              />
            ))}
            {/* Empty state */}
            {editedOptionalSubobjects.filter((s) => !deletedOptionalSubobjects.has(s)).length === 0 &&
              deletedOptionalSubobjects.size === 0 &&
              !isEditing && (
                <p className="text-sm text-muted-foreground italic">No optional subobjects</p>
              )}
            {/* Add optional subobject in edit mode */}
            {isEditing && (
              <EntityCombobox
                entityType="subobject"
                availableEntities={availableSubobjects.filter(
                  (s) =>
                    !editedRequiredSubobjects.includes(s.key) &&
                    !editedOptionalSubobjects.includes(s.key)
                )}
                selectedKeys={[]}
                onChange={(keys) => {
                  if (keys.length > 0) {
                    handleAddOptionalSubobject(keys[0])
                  }
                }}
                onCreateNew={(id) => {
                  setOnNestedEntityCreated((newKey: string) => {
                    handleAddOptionalSubobject(newKey)
                  })
                  openNestedCreateModal({
                    entityType: 'subobject',
                    prefilledId: id,
                    parentContext: { entityType: 'category', fieldName: 'Optional Subobjects' },
                  })
                }}
                placeholder="Add optional subobject..."
              />
            )}
          </div>
        </div>
      </AccordionSection>

      {/* Module/Bundle membership - TODO: fetch from module_entity table */}
      <MembershipSection modules={[]} bundles={[]} />
    </div>
  )
}
