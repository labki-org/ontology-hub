import { useEffect, useState, useCallback, useRef } from 'react'
import { useCategory, useCategories, useProperties, useSubobjects } from '@/api/entities'
import { useAutoSave } from '@/hooks/useAutoSave'
import { useGraphStore } from '@/stores/graphStore'
import { useDraftStore } from '@/stores/draftStore'
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
  const setSelectedEntity = useGraphStore((s) => s.setSelectedEntity)
  const openNestedCreateModal = useDraftStore((s) => s.openNestedCreateModal)
  const setOnNestedEntityCreated = useDraftStore((s) => s.setOnNestedEntityCreated)

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
  const directEdits = useDraftStore((s) => s.directlyEditedEntities)
  const transitiveAffects = useDraftStore((s) => s.transitivelyAffectedEntities)

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

  // Initialize state when category loads for a new entity (not on refetch)
  // This effect synchronizes local state with API data on entity change
  /* eslint-disable react-hooks/set-state-in-effect -- Valid sync with external data */
  useEffect(() => {
    if (category && initializedEntityRef.current !== entityKey) {
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
  }, [category, entityKey])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Change handlers with auto-save - use 'add' for robustness
  // (add works whether field exists or not in canonical_json)
  const handleLabelChange = useCallback(
    (value: string) => {
      setEditedLabel(value)
      if (draftToken) {
        saveChange([{ op: 'add', path: '/label', value }])
      }
    },
    [draftToken, saveChange]
  )

  const handleDescriptionChange = useCallback(
    (value: string) => {
      setEditedDescription(value)
      if (draftToken) {
        saveChange([{ op: 'add', path: '/description', value }])
      }
    },
    [draftToken, saveChange]
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
        { op: 'add', path: '/description', value: originalValues.description },
      ])
    }
  }, [originalValues.description, draftToken, saveChange])

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

  // Computed visibility for sub-sections (hide empty in read mode)
  const activeRequiredProps = editedRequiredProperties.filter((p) => !deletedRequiredProperties.has(p))
  const activeOptionalProps = editedOptionalProperties.filter((p) => !deletedOptionalProperties.has(p))
  const inheritedProps = (category.properties || []).filter((p) => p.is_inherited)
  const activeRequiredSubs = editedRequiredSubobjects.filter((s) => !deletedRequiredSubobjects.has(s))
  const activeOptionalSubs = editedOptionalSubobjects.filter((s) => !deletedOptionalSubobjects.has(s))
  const activeParents = editedParents.filter((p) => !deletedParents.has(p))

  return (
    <div className="px-4 py-3">
      {/* Saving indicator */}
      {isSaving && (
        <div className="fixed top-4 right-4 bg-primary text-primary-foreground px-3 py-1 rounded text-sm">
          Saving...
        </div>
      )}

      {/* Transitive effect indicator */}
      {isTransitivelyAffected && (
        <div className="mb-3 p-2 rounded bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800">
          <p className="text-xs text-blue-700 dark:text-blue-300">
            This category may be affected by changes to a parent category.
          </p>
        </div>
      )}

      {/* Header block — title + description, visually separated */}
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

      {/* Parents */}
      <AccordionSection
        id="parents"
        title="Parents"
        count={activeParents.length}
        colorHint="category"
      >
        <div className="space-y-1.5">
          <RelationshipChips
            values={activeParents}
            onRemove={handleDeleteParent}
            disabled={!isEditing}
            colorHint="category"
            getLabel={(key) => {
              const cat = availableCategories.find((c) => c.key === key)
              return cat?.label || key
            }}
          />

          {Array.from(deletedParents).map((parent) => (
            <DeletedItemBadge
              key={`deleted-${parent}`}
              label={availableCategories.find((c) => c.key === parent)?.label || parent}
              onUndo={() => handleUndoDeleteParent(parent)}
            />
          ))}

          {activeParents.length === 0 && deletedParents.size === 0 && !isEditing && (
            <p className="text-xs text-muted-foreground/60">None (root category)</p>
          )}

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
                setOnNestedEntityCreated((newKey: string) => {
                  handleAddNewParent(newKey)
                })
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

      {/* Inheritance Chain — only when parents exist */}
      {category.parents && category.parents.length > 0 && (
        <AccordionSection
          id="inheritance-chain"
          title="Inheritance Chain"
          defaultOpen={false}
          colorHint="category"
        >
          <div className="flex items-center flex-wrap gap-1">
            {category.parents.map((parentKey, index) => {
              const isParentEdited = directEdits.has(parentKey)
              const parentLabel = availableCategories.find((c) => c.key === parentKey)?.label || parentKey
              return (
                <span key={parentKey} className="inline-flex items-center gap-1">
                  {index > 0 && (
                    <span className="text-muted-foreground/40 mx-0.5">→</span>
                  )}
                  <button
                    onClick={() => setSelectedEntity(parentKey, 'category')}
                    className={cn(
                      'text-sm px-1.5 py-0.5 rounded hover:bg-accent transition-colors',
                      isParentEdited && 'bg-blue-100 dark:bg-blue-900/30 font-medium'
                    )}
                  >
                    {parentLabel}
                    {isParentEdited && (
                      <Badge variant="secondary" className="ml-1 text-[10px] px-1 py-0 h-4 bg-blue-200 dark:bg-blue-800">
                        edited
                      </Badge>
                    )}
                  </button>
                </span>
              )
            })}
          </div>
          {category.parents.some((p) => directEdits.has(p)) && (
            <p className="text-xs text-muted-foreground/60 mt-2">
              Edited ancestors may affect inherited properties.
            </p>
          )}
        </AccordionSection>
      )}

      {/* Properties */}
      <AccordionSection
        id="properties"
        title="Properties"
        count={activeRequiredProps.length + activeOptionalProps.length}
        defaultOpen
        colorHint="property"
      >
        <div className="space-y-4">
          {/* Required — hidden when empty in read mode */}
          {(activeRequiredProps.length > 0 || deletedRequiredProperties.size > 0 || isEditing) && (
            <div className="space-y-1.5">
              <h4 className="text-sm font-semibold text-foreground/70">Required</h4>
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
                          parentContext: { entityType: 'category', fieldName: 'Required Properties' },
                        })
                      }}
                      placeholder="Add required property..."
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Optional — hidden when empty in read mode */}
          {(activeOptionalProps.length > 0 || deletedOptionalProperties.size > 0 || isEditing) && (
            <div className="space-y-1.5">
              <h4 className="text-sm font-semibold text-foreground/70">Optional</h4>
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
                          parentContext: { entityType: 'category', fieldName: 'Optional Properties' },
                        })
                      }}
                      placeholder="Add optional property..."
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Inherited — visually distinct: dashed outline chips, lower opacity */}
          {inheritedProps.length > 0 && (
            <div className="space-y-1.5 pt-3 border-t border-dashed">
              <h4 className="text-sm font-semibold text-foreground/50 italic">Inherited</h4>
              <div className="pl-2 flex flex-wrap gap-1.5">
                {inheritedProps.map((prop) => (
                  <Badge
                    key={prop.entity_key}
                    variant="outline"
                    className="cursor-pointer border-dashed text-foreground/60 hover:bg-accent hover:text-foreground transition-all"
                    onClick={() => setSelectedEntity(prop.entity_key, 'property')}
                  >
                    {prop.label}
                    <span className="text-[10px] text-muted-foreground/50 ml-1">{prop.source_category}</span>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Nothing at all in this section */}
          {activeRequiredProps.length === 0 &&
            activeOptionalProps.length === 0 &&
            inheritedProps.length === 0 &&
            !isEditing && (
              <p className="text-xs text-muted-foreground/60">No properties</p>
            )}
        </div>
      </AccordionSection>

      {/* Subobjects */}
      <AccordionSection
        id="subobjects"
        title="Subobjects"
        count={activeRequiredSubs.length + activeOptionalSubs.length}
        defaultOpen
        colorHint="subobject"
      >
        <div className="space-y-4">
          {/* Required — hidden when empty in read mode */}
          {(activeRequiredSubs.length > 0 || deletedRequiredSubobjects.size > 0 || isEditing) && (
            <div className="space-y-1.5">
              <h4 className="text-sm font-semibold text-foreground/70">Required</h4>
              <div className="pl-2">
                <RelationshipChips
                  values={activeRequiredSubs}
                  onRemove={handleDeleteRequiredSubobject}
                  disabled={!isEditing}
                  colorHint="subobject"
                  getLabel={(key) => {
                    const sub = availableSubobjects.find((s) => s.key === key)
                    return sub?.label || key
                  }}
                />
                {Array.from(deletedRequiredSubobjects).map((subKey) => (
                  <DeletedItemBadge
                    key={`deleted-req-sub-${subKey}`}
                    label={availableSubobjects.find((s) => s.key === subKey)?.label || subKey}
                    onUndo={() => handleUndoDeleteRequiredSubobject(subKey)}
                  />
                ))}
                {activeRequiredSubs.length === 0 && deletedRequiredSubobjects.size === 0 && isEditing && (
                  <p className="text-xs text-muted-foreground/60">None</p>
                )}
                {isEditing && (
                  <div className="mt-1.5">
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
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Optional — hidden when empty in read mode */}
          {(activeOptionalSubs.length > 0 || deletedOptionalSubobjects.size > 0 || isEditing) && (
            <div className="space-y-1.5">
              <h4 className="text-sm font-semibold text-foreground/70">Optional</h4>
              <div className="pl-2">
                <RelationshipChips
                  values={activeOptionalSubs}
                  onRemove={handleDeleteOptionalSubobject}
                  disabled={!isEditing}
                  colorHint="subobject"
                  getLabel={(key) => {
                    const sub = availableSubobjects.find((s) => s.key === key)
                    return sub?.label || key
                  }}
                />
                {Array.from(deletedOptionalSubobjects).map((subKey) => (
                  <DeletedItemBadge
                    key={`deleted-opt-sub-${subKey}`}
                    label={availableSubobjects.find((s) => s.key === subKey)?.label || subKey}
                    onUndo={() => handleUndoDeleteOptionalSubobject(subKey)}
                  />
                ))}
                {activeOptionalSubs.length === 0 && deletedOptionalSubobjects.size === 0 && isEditing && (
                  <p className="text-xs text-muted-foreground/60">None</p>
                )}
                {isEditing && (
                  <div className="mt-1.5">
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
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Nothing at all */}
          {activeRequiredSubs.length === 0 &&
            activeOptionalSubs.length === 0 &&
            !isEditing && (
              <p className="text-xs text-muted-foreground/60">No subobjects</p>
            )}
        </div>
      </AccordionSection>

      {/* Membership */}
      <MembershipSection modules={[]} bundles={[]} />
    </div>
  )
}
