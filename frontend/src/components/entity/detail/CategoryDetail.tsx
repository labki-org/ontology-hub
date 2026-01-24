import { useEffect, useState, useCallback } from 'react'
import { useCategory } from '@/api/entitiesV2'
import { useAutoSave } from '@/hooks/useAutoSave'
import { useDetailStore } from '@/stores/detailStore'
import { EntityHeader } from '../sections/EntityHeader'
import { AccordionSection } from '../sections/AccordionSection'
import { PropertiesSection } from '../sections/PropertiesSection'
import { MembershipSection } from '../sections/MembershipSection'
import { EditableList } from '../form/EditableList'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

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
