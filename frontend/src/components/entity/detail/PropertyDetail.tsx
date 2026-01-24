import { useEffect, useState, useCallback } from 'react'
import { useProperty, usePropertyUsedBy } from '@/api/entitiesV2'
import { useAutoSave } from '@/hooks/useAutoSave'
import { useDetailStore } from '@/stores/detailStore'
import { EntityHeader } from '../sections/EntityHeader'
import { AccordionSection } from '../sections/AccordionSection'
import { MembershipSection } from '../sections/MembershipSection'
import { Skeleton } from '@/components/ui/skeleton'
import { VisualChangeMarker } from '../form/VisualChangeMarker'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { PropertyDetailV2, EntityWithStatus } from '@/api/types'

interface PropertyDetailProps {
  entityKey: string
  draftId?: string
  isEditing: boolean
}

/**
 * Property detail view with:
 * - Header (name, label, description)
 * - Datatype and cardinality fields
 * - Where-used list (categories using this property)
 * - Module membership display
 */
export function PropertyDetail({
  entityKey,
  draftId,
  isEditing,
}: PropertyDetailProps) {
  const { data, isLoading, error } = useProperty(entityKey, draftId)
  const {
    data: usedByData,
    isLoading: usedByLoading,
  } = usePropertyUsedBy(entityKey, draftId)
  const pushBreadcrumb = useDetailStore((s) => s.pushBreadcrumb)

  // Cast to PropertyDetailV2
  const property = data as PropertyDetailV2 | undefined

  // Track original values
  const [originalValues, setOriginalValues] = useState<{
    label?: string
    description?: string
    datatype?: string
    cardinality?: string
  }>({})

  // Local editable state
  const [editedLabel, setEditedLabel] = useState('')
  const [editedDescription, setEditedDescription] = useState('')
  const [editedDatatype, setEditedDatatype] = useState('')
  const [editedCardinality, setEditedCardinality] = useState('')

  // Auto-save hook
  const { saveChange, isSaving } = useAutoSave({
    draftToken: draftId || '',
    entityType: 'property',
    entityKey,
    debounceMs: 500,
  })

  // Initialize state
  useEffect(() => {
    if (property) {
      setEditedLabel(property.label)
      setEditedDescription(property.description || '')
      setEditedDatatype(property.datatype)
      setEditedCardinality(property.cardinality)

      setOriginalValues({
        label: property.label,
        description: property.description || '',
        datatype: property.datatype,
        cardinality: property.cardinality,
      })

      pushBreadcrumb(entityKey, 'property', property.label)
    }
  }, [property, entityKey, pushBreadcrumb])

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

  const handleDatatypeChange = useCallback(
    (value: string) => {
      setEditedDatatype(value)
      if (draftId) saveChange([{ op: 'replace', path: '/datatype', value }])
    },
    [draftId, saveChange]
  )

  const handleCardinalityChange = useCallback(
    (value: string) => {
      setEditedCardinality(value)
      if (draftId) saveChange([{ op: 'replace', path: '/cardinality', value }])
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

  if (error || !property) {
    return (
      <div className="p-6 text-center text-destructive">
        <p className="font-medium">Failed to load property</p>
        <p className="text-sm text-muted-foreground mt-1">
          {error instanceof Error ? error.message : 'Property not found'}
        </p>
      </div>
    )
  }

  const isDatatypeModified = editedDatatype !== originalValues.datatype
  const isCardinalityModified = editedCardinality !== originalValues.cardinality

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
        entityType="property"
        changeStatus={property.change_status}
        isEditing={isEditing}
        originalLabel={originalValues.label}
        originalDescription={originalValues.description}
        onLabelChange={handleLabelChange}
        onDescriptionChange={handleDescriptionChange}
      />

      {/* Property Attributes */}
      <AccordionSection id="attributes" title="Attributes" defaultOpen>
        <div className="space-y-4">
          {/* Datatype */}
          <div>
            <label className="text-sm font-medium text-muted-foreground block mb-2">
              Datatype
            </label>
            {isEditing ? (
              <VisualChangeMarker
                status={isDatatypeModified ? 'modified' : 'unchanged'}
                originalValue={originalValues.datatype}
              >
                <Select value={editedDatatype} onValueChange={handleDatatypeChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select datatype" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                    <SelectItem value="boolean">Boolean</SelectItem>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="url">URL</SelectItem>
                    <SelectItem value="page">Page</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                  </SelectContent>
                </Select>
              </VisualChangeMarker>
            ) : (
              <VisualChangeMarker
                status={isDatatypeModified ? 'modified' : 'unchanged'}
                originalValue={originalValues.datatype}
              >
                <div className="py-1">
                  <span className="font-medium">{editedDatatype}</span>
                </div>
              </VisualChangeMarker>
            )}
          </div>

          {/* Cardinality */}
          <div>
            <label className="text-sm font-medium text-muted-foreground block mb-2">
              Cardinality
            </label>
            {isEditing ? (
              <VisualChangeMarker
                status={isCardinalityModified ? 'modified' : 'unchanged'}
                originalValue={originalValues.cardinality}
              >
                <Select value={editedCardinality} onValueChange={handleCardinalityChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select cardinality" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Single</SelectItem>
                    <SelectItem value="multiple">Multiple</SelectItem>
                  </SelectContent>
                </Select>
              </VisualChangeMarker>
            ) : (
              <VisualChangeMarker
                status={isCardinalityModified ? 'modified' : 'unchanged'}
                originalValue={originalValues.cardinality}
              >
                <div className="py-1">
                  <span className="font-medium">{editedCardinality}</span>
                </div>
              </VisualChangeMarker>
            )}
          </div>
        </div>
      </AccordionSection>

      {/* Where-used list */}
      <AccordionSection
        id="used-by"
        title="Used By"
        count={usedByData?.length}
        defaultOpen
      >
        {usedByLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : usedByData && usedByData.length > 0 ? (
          <div className="space-y-2">
            {usedByData.map((category: EntityWithStatus) => (
              <div
                key={category.entity_key}
                className="flex items-center justify-between p-2 rounded hover:bg-muted/50 cursor-pointer"
                onClick={() => {
                  const openDetail = useDetailStore.getState().openDetail
                  openDetail(category.entity_key, 'category')
                }}
              >
                <div className="flex-1">
                  <div className="font-medium">{category.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {category.entity_key}
                  </div>
                </div>
                {category.change_status && category.change_status !== 'unchanged' && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      category.change_status === 'added'
                        ? 'bg-green-100 text-green-800'
                        : category.change_status === 'modified'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {category.change_status}
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            No categories use this property
          </p>
        )}
      </AccordionSection>

      {/* Module membership - TODO: needs API */}
      <MembershipSection modules={[]} bundles={[]} />
    </div>
  )
}
