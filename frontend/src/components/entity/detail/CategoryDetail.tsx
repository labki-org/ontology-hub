import { useEffect, useState, useCallback } from 'react'
import { useCategory } from '@/api/entitiesV2'
import { useAutoSave } from '@/hooks/useAutoSave'
import { useDetailStore } from '@/stores/detailStore'
import { useDraftStoreV2 } from '@/stores/draftStoreV2'
import { EntityHeader } from '../sections/EntityHeader'
import { AccordionSection } from '../sections/AccordionSection'
import { PropertiesSection } from '../sections/PropertiesSection'
import { MembershipSection } from '../sections/MembershipSection'
import { EditableList } from '../form/EditableList'
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
  const openDetail = useDetailStore((s) => s.openDetail)
  const pushBreadcrumb = useDetailStore((s) => s.pushBreadcrumb)

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

  const handleAddParent = useCallback(
    (parent: string) => {
      const newParents = [...editedParents, parent]
      setEditedParents(newParents)
      if (draftId) {
        saveChange([{ op: 'replace', path: '/parents', value: newParents }])
      }
    },
    [editedParents, draftId, saveChange]
  )

  const handleRemoveParent = useCallback(
    (parent: string) => {
      const newParents = editedParents.filter((p) => p !== parent)
      setEditedParents(newParents)
      if (draftId) {
        saveChange([{ op: 'replace', path: '/parents', value: newParents }])
      }
    },
    [editedParents, draftId, saveChange]
  )

  const handleRevertLabel = useCallback(() => {
    setEditedLabel(originalValues.label || '')
    if (draftId) {
      saveChange([{ op: 'replace', path: '/label', value: originalValues.label }])
    }
  }, [originalValues.label, draftId, saveChange])

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
        onRevertLabel={handleRevertLabel}
        onRevertDescription={handleRevertDescription}
      />

      {/* Parents section */}
      <AccordionSection
        id="parents"
        title="Parent Categories"
        count={editedParents.length}
      >
        <EditableList
          items={editedParents}
          onAdd={handleAddParent}
          onRemove={handleRemoveParent}
          isEditing={isEditing}
          placeholder="Add parent category..."
          emptyMessage="No parent categories (root category)"
          renderItem={(parent) => (
            <Badge
              variant="secondary"
              className="cursor-pointer hover:bg-secondary/80"
              onClick={() => openDetail(parent, 'category')}
            >
              {parent}
            </Badge>
          )}
        />
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
