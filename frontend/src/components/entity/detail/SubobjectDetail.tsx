import { useEffect, useState, useCallback } from 'react'
import { useSubobject } from '@/api/entitiesV2'
import { useAutoSave } from '@/hooks/useAutoSave'
import { useDetailStore } from '@/stores/detailStore'
import { EntityHeader } from '../sections/EntityHeader'
import { AccordionSection } from '../sections/AccordionSection'
import { MembershipSection } from '../sections/MembershipSection'
import { Skeleton } from '@/components/ui/skeleton'
import type { SubobjectDetailV2 } from '@/api/types'

interface SubobjectDetailProps {
  entityKey: string
  draftId?: string
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
  isEditing,
}: SubobjectDetailProps) {
  const { data, isLoading, error } = useSubobject(entityKey, draftId)
  const pushBreadcrumb = useDetailStore((s) => s.pushBreadcrumb)

  // Cast to SubobjectDetailV2
  const subobject = data as SubobjectDetailV2 | undefined

  // Track original values
  const [originalValues, setOriginalValues] = useState<{
    label?: string
    description?: string
  }>({})

  // Local editable state
  const [editedLabel, setEditedLabel] = useState('')
  const [editedDescription, setEditedDescription] = useState('')

  // Auto-save hook
  const { saveChange, isSaving } = useAutoSave({
    draftToken: draftId || '',
    entityType: 'subobject',
    entityKey,
    debounceMs: 500,
  })

  // Initialize state
  useEffect(() => {
    if (subobject) {
      setEditedLabel(subobject.label)
      setEditedDescription(subobject.description || '')

      setOriginalValues({
        label: subobject.label,
        description: subobject.description || '',
      })

      pushBreadcrumb(entityKey, 'subobject', subobject.label)
    }
  }, [subobject, entityKey, pushBreadcrumb])

  // Change handlers
  const handleLabelChange = useCallback(
    (value: string) => {
      setEditedLabel(value)
      if (draftId) saveChange([{ op: 'replace', path: '/label', value }])
    },
    [draftId, saveChange]
  )

  const handleDescriptionChange = useCallback(
    (value: string) => {
      setEditedDescription(value)
      if (draftId) saveChange([{ op: 'replace', path: '/description', value }])
    },
    [draftId, saveChange]
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

  const properties = subobject.properties || []

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

      {/* Properties list */}
      <AccordionSection
        id="properties"
        title="Properties"
        count={properties.length}
        defaultOpen
      >
        {properties.length > 0 ? (
          <div className="space-y-2">
            {properties.map((propertyKey: string) => (
              <div
                key={propertyKey}
                className="flex items-center justify-between p-2 rounded hover:bg-muted/50 cursor-pointer"
                onClick={() => {
                  const selectEntity = useDetailStore.getState().selectEntity
                  selectEntity(propertyKey, 'property')
                }}
              >
                <div className="flex-1">
                  <div className="font-medium">{propertyKey}</div>
                  <div className="text-xs text-muted-foreground">Property</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            No properties defined
          </p>
        )}
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
