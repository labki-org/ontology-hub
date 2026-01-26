import { useEffect, useState, useCallback, useRef } from 'react'
import { useProperty, usePropertyUsedBy, useTemplates } from '@/api/entitiesV2'
import { useAutoSave } from '@/hooks/useAutoSave'
import { useGraphStore } from '@/stores/graphStore'
import { EntityHeader } from '../sections/EntityHeader'
import { AccordionSection } from '../sections/AccordionSection'
import { MembershipSection } from '../sections/MembershipSection'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { VisualChangeMarker } from '../form/VisualChangeMarker'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Pencil, X, Plus, Link2 } from 'lucide-react'
import type { PropertyDetailV2, EntityWithStatus } from '@/api/types'

interface PropertyDetailProps {
  entityKey: string
  draftId?: string
  draftToken?: string
  isEditing: boolean
}

interface OriginalValues {
  label?: string
  description?: string
  datatype?: string
  cardinality?: string
  allowed_values?: string[]
  allowed_pattern?: string
  allowed_value_list?: string
  display_units?: string[]
  display_precision?: number | null
  unique_values?: boolean
  has_display_template?: string
}

/**
 * Property detail view with:
 * - Header (name, label, description)
 * - Datatype and cardinality fields
 * - Optional attributes (validation, display, constraints)
 * - Where-used list (categories using this property)
 * - Module membership display
 */
export function PropertyDetail({
  entityKey,
  draftId,
  draftToken,
  isEditing,
}: PropertyDetailProps) {
  const { data, isLoading, error } = useProperty(entityKey, draftId)
  const {
    data: usedByData,
    isLoading: usedByLoading,
  } = usePropertyUsedBy(entityKey, draftId)
  const { data: templatesData } = useTemplates(undefined, undefined, draftId)
  const setSelectedEntity = useGraphStore((s) => s.setSelectedEntity)

  // Build available templates for selection
  const availableTemplates = (templatesData?.items || []).map((t) => ({
    key: t.entity_key,
    label: t.label,
  }))

  // Cast to PropertyDetailV2
  const property = data as PropertyDetailV2 | undefined

  // Track original values
  const [originalValues, setOriginalValues] = useState<OriginalValues>({})

  // Local editable state - required fields
  const [editedLabel, setEditedLabel] = useState('')
  const [editedDescription, setEditedDescription] = useState('')
  const [editedDatatype, setEditedDatatype] = useState('')
  const [editedCardinality, setEditedCardinality] = useState('')

  // Local editable state - optional fields
  const [editedAllowedValues, setEditedAllowedValues] = useState<string[]>([])
  const [editedAllowedPattern, setEditedAllowedPattern] = useState('')
  const [editedAllowedValueList, setEditedAllowedValueList] = useState('')
  const [editedDisplayUnits, setEditedDisplayUnits] = useState<string[]>([])
  const [editedDisplayPrecision, setEditedDisplayPrecision] = useState<number | null>(null)
  const [editedUniqueValues, setEditedUniqueValues] = useState(false)
  const [editedHasDisplayTemplate, setEditedHasDisplayTemplate] = useState('')

  // Hover-reveal edit mode state for select fields
  const [isEditingDatatype, setIsEditingDatatype] = useState(false)
  const [isEditingCardinality, setIsEditingCardinality] = useState(false)
  const [isEditingTemplate, setIsEditingTemplate] = useState(false)

  // Input state for adding new values to arrays
  const [newAllowedValue, setNewAllowedValue] = useState('')
  const [newDisplayUnit, setNewDisplayUnit] = useState('')

  // Track which entity we've initialized original values for (prevent reset on refetch)
  const initializedEntityRef = useRef<string | null>(null)

  // Auto-save hook
  const { saveChange, isSaving } = useAutoSave({
    draftToken: draftToken || '',
    entityType: 'property',
    entityKey,
    debounceMs: 500,
  })

  // Initialize state
  useEffect(() => {
    if (property) {
      const isNewEntity = initializedEntityRef.current !== entityKey

      if (isNewEntity) {
        setEditedLabel(property.label)
        setEditedDescription(property.description || '')
        setEditedDatatype(property.datatype)
        setEditedCardinality(property.cardinality)
        setEditedAllowedValues(property.allowed_values || [])
        setEditedAllowedPattern(property.allowed_pattern || '')
        setEditedAllowedValueList(property.allowed_value_list || '')
        setEditedDisplayUnits(property.display_units || [])
        setEditedDisplayPrecision(property.display_precision ?? null)
        setEditedUniqueValues(property.unique_values || false)
        setEditedHasDisplayTemplate(property.has_display_template || '')

        setOriginalValues({
          label: property.label,
          description: property.description || '',
          datatype: property.datatype,
          cardinality: property.cardinality,
          allowed_values: property.allowed_values || [],
          allowed_pattern: property.allowed_pattern || '',
          allowed_value_list: property.allowed_value_list || '',
          display_units: property.display_units || [],
          display_precision: property.display_precision ?? null,
          unique_values: property.unique_values || false,
          has_display_template: property.has_display_template || '',
        })

        initializedEntityRef.current = entityKey
      }
    }
  }, [property, entityKey])

  // Change handlers with auto-save
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

  const handleDatatypeChange = useCallback(
    (value: string) => {
      setEditedDatatype(value)
      setIsEditingDatatype(false)
      if (draftToken) saveChange([{ op: 'add', path: '/datatype', value }])
    },
    [draftToken, saveChange]
  )

  const handleCardinalityChange = useCallback(
    (value: string) => {
      setEditedCardinality(value)
      setIsEditingCardinality(false)
      if (draftToken) saveChange([{ op: 'add', path: '/cardinality', value }])
    },
    [draftToken, saveChange]
  )

  // Allowed values handlers
  const handleAddAllowedValue = useCallback(() => {
    if (newAllowedValue.trim() && !editedAllowedValues.includes(newAllowedValue.trim())) {
      const newValues = [...editedAllowedValues, newAllowedValue.trim()]
      setEditedAllowedValues(newValues)
      setNewAllowedValue('')
      if (draftToken) saveChange([{ op: 'add', path: '/allowed_values', value: newValues }])
    }
  }, [newAllowedValue, editedAllowedValues, draftToken, saveChange])

  const handleRemoveAllowedValue = useCallback(
    (valueToRemove: string) => {
      const newValues = editedAllowedValues.filter((v) => v !== valueToRemove)
      setEditedAllowedValues(newValues)
      if (draftToken) {
        if (newValues.length === 0) {
          saveChange([{ op: 'remove', path: '/allowed_values' }])
        } else {
          saveChange([{ op: 'add', path: '/allowed_values', value: newValues }])
        }
      }
    },
    [editedAllowedValues, draftToken, saveChange]
  )

  const handleAllowedPatternChange = useCallback(
    (value: string) => {
      setEditedAllowedPattern(value)
      if (draftToken) {
        if (value) {
          saveChange([{ op: 'add', path: '/allowed_pattern', value }])
        } else {
          saveChange([{ op: 'remove', path: '/allowed_pattern' }])
        }
      }
    },
    [draftToken, saveChange]
  )

  const handleAllowedValueListChange = useCallback(
    (value: string) => {
      setEditedAllowedValueList(value)
      if (draftToken) {
        if (value) {
          saveChange([{ op: 'add', path: '/allowed_value_list', value }])
        } else {
          saveChange([{ op: 'remove', path: '/allowed_value_list' }])
        }
      }
    },
    [draftToken, saveChange]
  )

  // Display units handlers
  const handleAddDisplayUnit = useCallback(() => {
    if (newDisplayUnit.trim() && !editedDisplayUnits.includes(newDisplayUnit.trim())) {
      const newUnits = [...editedDisplayUnits, newDisplayUnit.trim()]
      setEditedDisplayUnits(newUnits)
      setNewDisplayUnit('')
      if (draftToken) saveChange([{ op: 'add', path: '/display_units', value: newUnits }])
    }
  }, [newDisplayUnit, editedDisplayUnits, draftToken, saveChange])

  const handleRemoveDisplayUnit = useCallback(
    (unitToRemove: string) => {
      const newUnits = editedDisplayUnits.filter((u) => u !== unitToRemove)
      setEditedDisplayUnits(newUnits)
      if (draftToken) {
        if (newUnits.length === 0) {
          saveChange([{ op: 'remove', path: '/display_units' }])
        } else {
          saveChange([{ op: 'add', path: '/display_units', value: newUnits }])
        }
      }
    },
    [editedDisplayUnits, draftToken, saveChange]
  )

  const handleDisplayPrecisionChange = useCallback(
    (value: string) => {
      const numValue = value === '' ? null : parseInt(value, 10)
      setEditedDisplayPrecision(numValue)
      if (draftToken) {
        if (numValue !== null && !isNaN(numValue)) {
          saveChange([{ op: 'add', path: '/display_precision', value: numValue }])
        } else {
          saveChange([{ op: 'remove', path: '/display_precision' }])
        }
      }
    },
    [draftToken, saveChange]
  )

  const handleUniqueValuesChange = useCallback(
    (checked: boolean) => {
      setEditedUniqueValues(checked)
      if (draftToken) {
        if (checked) {
          saveChange([{ op: 'add', path: '/unique_values', value: true }])
        } else {
          saveChange([{ op: 'remove', path: '/unique_values' }])
        }
      }
    },
    [draftToken, saveChange]
  )

  const handleHasDisplayTemplateChange = useCallback(
    (value: string) => {
      setEditedHasDisplayTemplate(value)
      setIsEditingTemplate(false)
      if (draftToken) {
        if (value) {
          saveChange([{ op: 'add', path: '/has_display_template', value }])
        } else {
          saveChange([{ op: 'remove', path: '/has_display_template' }])
        }
      }
    },
    [draftToken, saveChange]
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

  // Check for modifications
  const isDatatypeModified = editedDatatype !== originalValues.datatype
  const isCardinalityModified = editedCardinality !== originalValues.cardinality
  const isAllowedValuesModified = JSON.stringify(editedAllowedValues) !== JSON.stringify(originalValues.allowed_values)
  const isAllowedPatternModified = editedAllowedPattern !== originalValues.allowed_pattern
  const isAllowedValueListModified = editedAllowedValueList !== originalValues.allowed_value_list
  const isDisplayUnitsModified = JSON.stringify(editedDisplayUnits) !== JSON.stringify(originalValues.display_units)
  const isDisplayPrecisionModified = editedDisplayPrecision !== originalValues.display_precision
  const isUniqueValuesModified = editedUniqueValues !== originalValues.unique_values
  const isTemplateModified = editedHasDisplayTemplate !== originalValues.has_display_template

  // Show validation section if has values or in edit mode
  const showValidationSection = isEditing || editedAllowedValues.length > 0 || editedAllowedPattern || editedAllowedValueList
  // Show display section if has values or in edit mode
  const showDisplaySection = isEditing || editedDisplayUnits.length > 0 || editedDisplayPrecision !== null
  // Show constraints section if has values or in edit mode
  const showConstraintsSection = isEditing || editedUniqueValues || editedHasDisplayTemplate

  return (
    <div className="p-6 space-y-6">
      {isSaving && (
        <div className="fixed top-4 right-4 bg-primary text-primary-foreground px-3 py-1 rounded text-sm z-50">
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
            <VisualChangeMarker
              status={isDatatypeModified ? 'modified' : 'unchanged'}
              originalValue={originalValues.datatype}
            >
              {isEditingDatatype ? (
                <div className="flex items-center gap-2">
                  <Select value={editedDatatype} onValueChange={handleDatatypeChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select datatype" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Text">Text</SelectItem>
                      <SelectItem value="Number">Number</SelectItem>
                      <SelectItem value="Boolean">Boolean</SelectItem>
                      <SelectItem value="Date">Date</SelectItem>
                      <SelectItem value="URL">URL</SelectItem>
                      <SelectItem value="Page">Page</SelectItem>
                      <SelectItem value="Email">Email</SelectItem>
                      <SelectItem value="Telephone">Telephone</SelectItem>
                      <SelectItem value="Geographic coordinate">Geographic coordinate</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setIsEditingDatatype(false)}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Cancel"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="group relative rounded-md px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <span className="font-medium">{editedDatatype}</span>
                  {isEditing && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setIsEditingDatatype(true)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                      aria-label="Edit datatype"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )}
            </VisualChangeMarker>
          </div>

          {/* Cardinality */}
          <div>
            <label className="text-sm font-medium text-muted-foreground block mb-2">
              Cardinality
            </label>
            <VisualChangeMarker
              status={isCardinalityModified ? 'modified' : 'unchanged'}
              originalValue={originalValues.cardinality}
            >
              {isEditingCardinality ? (
                <div className="flex items-center gap-2">
                  <Select value={editedCardinality} onValueChange={handleCardinalityChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select cardinality" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single">Single</SelectItem>
                      <SelectItem value="multiple">Multiple</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setIsEditingCardinality(false)}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Cancel"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="group relative rounded-md px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <span className="font-medium capitalize">{editedCardinality}</span>
                  {isEditing && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setIsEditingCardinality(true)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                      aria-label="Edit cardinality"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )}
            </VisualChangeMarker>
          </div>
        </div>
      </AccordionSection>

      {/* Validation Rules Section */}
      {showValidationSection && (
        <AccordionSection id="validation" title="Validation Rules" defaultOpen>
          <div className="space-y-4">
            {/* Allowed Values */}
            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-2">
                Allowed Values
              </label>
              <VisualChangeMarker
                status={isAllowedValuesModified ? 'modified' : 'unchanged'}
                originalValue={originalValues.allowed_values?.join(', ')}
              >
                <div className="space-y-2">
                  {editedAllowedValues.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {editedAllowedValues.map((value) => (
                        <Badge key={value} variant="secondary" className="gap-1">
                          {value}
                          {isEditing && (
                            <button
                              onClick={() => handleRemoveAllowedValue(value)}
                              className="ml-1 hover:text-destructive"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {isEditing && (
                    <div className="flex gap-2">
                      <Input
                        value={newAllowedValue}
                        onChange={(e) => setNewAllowedValue(e.target.value)}
                        placeholder="Add allowed value..."
                        className="flex-1"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleAddAllowedValue()
                          }
                        }}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleAddAllowedValue}
                        disabled={!newAllowedValue.trim()}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  {!isEditing && editedAllowedValues.length === 0 && (
                    <p className="text-sm text-muted-foreground italic">No allowed values specified</p>
                  )}
                </div>
              </VisualChangeMarker>
            </div>

            {/* Allowed Pattern */}
            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-2">
                Allowed Pattern (Regex)
              </label>
              <VisualChangeMarker
                status={isAllowedPatternModified ? 'modified' : 'unchanged'}
                originalValue={originalValues.allowed_pattern}
              >
                {isEditing ? (
                  <Input
                    value={editedAllowedPattern}
                    onChange={(e) => handleAllowedPatternChange(e.target.value)}
                    placeholder="e.g., ^[A-Z]{2,3}$"
                    className="font-mono text-sm"
                  />
                ) : editedAllowedPattern ? (
                  <code className="bg-muted px-2 py-1 rounded text-sm font-mono">
                    {editedAllowedPattern}
                  </code>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No pattern specified</p>
                )}
              </VisualChangeMarker>
            </div>

            {/* Allowed Value List */}
            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-2">
                Allowed Value List (Wiki Page)
              </label>
              <VisualChangeMarker
                status={isAllowedValueListModified ? 'modified' : 'unchanged'}
                originalValue={originalValues.allowed_value_list}
              >
                {isEditing ? (
                  <Input
                    value={editedAllowedValueList}
                    onChange={(e) => handleAllowedValueListChange(e.target.value)}
                    placeholder="Reference to wiki page with allowed values..."
                  />
                ) : editedAllowedValueList ? (
                  <span className="text-sm">{editedAllowedValueList}</span>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No value list specified</p>
                )}
              </VisualChangeMarker>
            </div>
          </div>
        </AccordionSection>
      )}

      {/* Display Settings Section */}
      {showDisplaySection && (
        <AccordionSection id="display" title="Display Settings" defaultOpen>
          <div className="space-y-4">
            {/* Display Units */}
            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-2">
                Display Units
              </label>
              <VisualChangeMarker
                status={isDisplayUnitsModified ? 'modified' : 'unchanged'}
                originalValue={originalValues.display_units?.join(', ')}
              >
                <div className="space-y-2">
                  {editedDisplayUnits.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {editedDisplayUnits.map((unit) => (
                        <Badge key={unit} variant="outline" className="gap-1">
                          {unit}
                          {isEditing && (
                            <button
                              onClick={() => handleRemoveDisplayUnit(unit)}
                              className="ml-1 hover:text-destructive"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {isEditing && (
                    <div className="flex gap-2">
                      <Input
                        value={newDisplayUnit}
                        onChange={(e) => setNewDisplayUnit(e.target.value)}
                        placeholder="Add display unit (e.g., kg, m, USD)..."
                        className="flex-1"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleAddDisplayUnit()
                          }
                        }}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleAddDisplayUnit}
                        disabled={!newDisplayUnit.trim()}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  {!isEditing && editedDisplayUnits.length === 0 && (
                    <p className="text-sm text-muted-foreground italic">No display units specified</p>
                  )}
                </div>
              </VisualChangeMarker>
            </div>

            {/* Display Precision */}
            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-2">
                Display Precision (decimal places)
              </label>
              <VisualChangeMarker
                status={isDisplayPrecisionModified ? 'modified' : 'unchanged'}
                originalValue={originalValues.display_precision?.toString()}
              >
                {isEditing ? (
                  <Input
                    type="number"
                    min="0"
                    value={editedDisplayPrecision ?? ''}
                    onChange={(e) => handleDisplayPrecisionChange(e.target.value)}
                    placeholder="Number of decimal places..."
                    className="w-32"
                  />
                ) : editedDisplayPrecision !== null ? (
                  <span className="text-sm">{editedDisplayPrecision} decimal places</span>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No precision specified</p>
                )}
              </VisualChangeMarker>
            </div>
          </div>
        </AccordionSection>
      )}

      {/* Constraints Section */}
      {showConstraintsSection && (
        <AccordionSection id="constraints" title="Constraints & Relationships" defaultOpen>
          <div className="space-y-4">
            {/* Unique Values */}
            <div>
              <VisualChangeMarker
                status={isUniqueValuesModified ? 'modified' : 'unchanged'}
                originalValue={originalValues.unique_values?.toString()}
              >
                <div className="flex items-center gap-3">
                  {isEditing ? (
                    <>
                      <Switch
                        id="unique-values"
                        checked={editedUniqueValues}
                        onCheckedChange={handleUniqueValuesChange}
                      />
                      <Label htmlFor="unique-values" className="text-sm">
                        Values must be unique across all pages
                      </Label>
                    </>
                  ) : editedUniqueValues ? (
                    <span className="text-sm">Values must be unique across all pages</span>
                  ) : (
                    <span className="text-sm text-muted-foreground italic">Values do not need to be unique</span>
                  )}
                </div>
              </VisualChangeMarker>
            </div>

            {/* Display Template */}
            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-2">
                Display Template
              </label>
              <VisualChangeMarker
                status={isTemplateModified ? 'modified' : 'unchanged'}
                originalValue={originalValues.has_display_template}
              >
                {isEditingTemplate ? (
                  <div className="flex items-center gap-2">
                    <Select
                      value={editedHasDisplayTemplate}
                      onValueChange={handleHasDisplayTemplateChange}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select template..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {availableTemplates.map((t) => (
                          <SelectItem key={t.key} value={t.key}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setIsEditingTemplate(false)}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="Cancel"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : editedHasDisplayTemplate ? (
                  <div className="group relative rounded-md px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <button
                      onClick={() => setSelectedEntity(editedHasDisplayTemplate, 'template')}
                      className="flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      <Link2 className="h-3 w-3" />
                      {editedHasDisplayTemplate}
                    </button>
                    {isEditing && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setIsEditingTemplate(true)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                        aria-label="Edit template"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ) : isEditing ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditingTemplate(true)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add template
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No display template</p>
                )}
              </VisualChangeMarker>
            </div>
          </div>
        </AccordionSection>
      )}

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
                onClick={() => setSelectedEntity(category.entity_key, 'category')}
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

      {/* Module membership */}
      <MembershipSection modules={[]} bundles={[]} />
    </div>
  )
}
