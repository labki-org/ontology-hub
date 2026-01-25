import { useEffect, useState, useCallback } from 'react'
import { useCategory, useCategories } from '@/api/entitiesV2'
import { useAutoSave } from '@/hooks/useAutoSave'
import { useDetailStore } from '@/stores/detailStore'
import { useDraftStoreV2 } from '@/stores/draftStoreV2'
import { EntityHeader } from '../sections/EntityHeader'
import { AccordionSection } from '../sections/AccordionSection'
import { PropertiesSection } from '../sections/PropertiesSection'
import { MembershipSection } from '../sections/MembershipSection'
import { DeletedItemBadge } from '../form/DeletedItemBadge'
import { EntityCombobox } from '../forms/EntityCombobox'
import { RelationshipChips } from '../forms/RelationshipChips'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface CategoryDetailProps {
  entityKey: string
  draftId?: string
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
  isEditing,
}: CategoryDetailProps) {
  const { data: rawCategory, isLoading, error } = useCategory(entityKey, draftId)
  const { data: categoriesData } = useCategories(undefined, undefined, draftId)
  const openDetail = useDetailStore((s) => s.openDetail)
  const pushBreadcrumb = useDetailStore((s) => s.pushBreadcrumb)
  const openCreateModal = useDraftStoreV2((s) => s.openCreateModal)

  // Build available categories for parent selection (excluding self)
  const availableCategories = (categoriesData?.items || [])
    .filter((c) => c.entity_key !== entityKey)
    .map((c) => ({
      key: c.entity_key,
      label: c.label,
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
  }>({})

  // Local editable state
  const [editedLabel, setEditedLabel] = useState('')
  const [editedDescription, setEditedDescription] = useState('')
  const [editedParents, setEditedParents] = useState<string[]>([])
  // Track soft-deleted parents (stay in position with "Deleted" badge until save)
  const [deletedParents, setDeletedParents] = useState<Set<string>>(new Set())

  // Auto-save hook
  const { saveChange, isSaving } = useAutoSave({
    draftToken: draftId || '',
    entityType: 'category',
    entityKey,
    debounceMs: 500,
  })

  // Initialize state when category loads
  useEffect(() => {
    if (category) {
      setEditedLabel(category.label)
      setEditedDescription(category.description || '')
      setEditedParents(category.parents || [])

      // Store originals for comparison
      setOriginalValues({
        label: category.label,
        description: category.description || '',
        parents: category.parents || [],
      })

      // Add to breadcrumbs
      pushBreadcrumb(entityKey, 'category', category.label)
    }
  }, [category, entityKey, pushBreadcrumb])

  // Change handlers with auto-save
  const handleLabelChange = useCallback(
    (value: string) => {
      setEditedLabel(value)
      if (draftId) {
        saveChange([{ op: 'replace', path: '/label', value }])
      }
    },
    [draftId, saveChange]
  )

  const handleDescriptionChange = useCallback(
    (value: string) => {
      setEditedDescription(value)
      if (draftId) {
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
      if (draftId) {
        saveChange([{ op: 'replace', path: '/parents', value: newParents }])
      }
    },
    [editedParents, draftId, saveChange]
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
      if (draftId) {
        saveChange([{ op: 'replace', path: '/parents', value: newParents }])
      }
    },
    [editedParents, draftId, saveChange]
  )

  // Handler for adding new parent
  const handleAddNewParent = useCallback(
    (parentKey: string) => {
      if (parentKey && !editedParents.includes(parentKey)) {
        const newParents = [...editedParents.filter((p) => !deletedParents.has(p)), parentKey]
        setEditedParents(newParents)
        if (draftId) {
          saveChange([{ op: 'replace', path: '/parents', value: newParents }])
        }
      }
    },
    [editedParents, deletedParents, draftId, saveChange]
  )

  const handleRevertDescription = useCallback(() => {
    setEditedDescription(originalValues.description || '')
    if (draftId) {
      saveChange([
        { op: 'replace', path: '/description', value: originalValues.description },
      ])
    }
  }, [originalValues.description, draftId, saveChange])

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
              onCreateNew={() => {
                // Open create modal for new category
                openCreateModal('category')
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

      {/* Properties section with inheritance */}
      <PropertiesSection
        properties={category.properties || []}
        isEditing={isEditing}
        onRemoveProperty={(propKey) => {
          // TODO: Implement property removal from category
          console.log('Remove property:', propKey)
        }}
      />

      {/* Module/Bundle membership - TODO: fetch from module_entity table */}
      <MembershipSection modules={[]} bundles={[]} />
    </div>
  )
}
