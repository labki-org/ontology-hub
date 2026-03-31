import { useEffect, useState, useCallback, useRef } from 'react'
import {
  useModule,
  useCategories,
  useProperties,
  useSubobjects,
  useTemplates,
  useDashboards,
  useResources,
} from '@/api/entities'
import type { ModuleDetailV2 } from '@/api/types'
import { useAutoSave } from '@/hooks/useAutoSave'
import { useGraphStore } from '@/stores/graphStore'
import { useDraftStore, type CreateModalEntityType } from '@/stores/draftStore'
import { AccordionSection } from '@/components/entity/sections/AccordionSection'
import { EntityHeader } from '../sections/EntityHeader'
import { EntityCombobox } from '../forms/EntityCombobox'
import { RelationshipChips } from '../forms/RelationshipChips'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Sparkles, Users } from 'lucide-react'
import { SaveIndicator } from '../sections/SaveIndicator'

interface ModuleDetailProps {
  entityKey: string
  draftId?: string
  draftToken?: string
  isEditing: boolean
}

/**
 * Module detail page showing:
 * - Label and description
 * - Direct categories (manually added, editable)
 * - Auto-included entities (derived from categories, read-only)
 *
 * Only categories are editable.
 * Properties, subobjects, and templates are auto-populated based on
 * what the categories require.
 */
export function ModuleDetail({ entityKey, draftId, draftToken, isEditing }: ModuleDetailProps) {
  const { data: module, isLoading, error, refetch: refetchModule } = useModule(entityKey, draftId)
  const { data: categoriesData } = useCategories(undefined, 500, draftId)
  const { data: propertiesData } = useProperties(undefined, 500, draftId)
  const { data: subobjectsData } = useSubobjects(undefined, 500, draftId)
  const { data: templatesData } = useTemplates(undefined, 500, draftId)
  const { data: dashboardsData } = useDashboards(undefined, 500, draftId)
  const { data: resourcesData } = useResources(undefined, 500, draftId)

  const setSelectedEntity = useGraphStore((s) => s.setSelectedEntity)
  const openNestedCreateModal = useDraftStore((s) => s.openNestedCreateModal)
  const setOnNestedEntityCreated = useDraftStore((s) => s.setOnNestedEntityCreated)

  // Build available entities for lookups
  const availableCategories = (categoriesData?.items || []).map((c) => ({
    key: c.entity_key,
    label: c.label,
  }))
  const availableProperties = (propertiesData?.items || []).map((p) => ({
    key: p.entity_key,
    label: p.label,
  }))
  const availableSubobjects = (subobjectsData?.items || []).map((s) => ({
    key: s.entity_key,
    label: s.label,
  }))
  const availableTemplates = (templatesData?.items || []).map((t) => ({
    key: t.entity_key,
    label: t.label,
  }))
  const availableDashboards = (dashboardsData?.items || []).map((d) => ({
    key: d.entity_key,
    label: d.label,
  }))
  const availableResources = (resourcesData?.items || []).map((r) => ({
    key: r.entity_key,
    label: r.label,
  }))

  // Track original values for change detection
  const [originalValues, setOriginalValues] = useState<{
    label?: string
    description?: string
    categories?: string[]
    dashboards?: string[]
  }>({})

  // Local editable state
  const [editedLabel, setEditedLabel] = useState('')
  const [editedDescription, setEditedDescription] = useState('')
  const [editedCategories, setEditedCategories] = useState<string[]>([])
  const [editedDashboards, setEditedDashboards] = useState<string[]>([])

  // Track which entity we've initialized original values for (prevent reset on refetch)
  const initializedEntityRef = useRef<string | null>(null)

  // Auto-save hook — refetch module detail after save to update closure and derived entities
  const { saveChange, isSaving } = useAutoSave({
    draftToken: draftToken || '',
    entityType: 'module',
    entityKey,
    debounceMs: 500,
    onSuccess: () => void refetchModule(),
  })

  // Type assertion since useModule returns EntityWithStatus | ModuleDetailV2
  const moduleDetail = module as ModuleDetailV2 | undefined

  // Initialize state when module loads for a new entity (not on refetch)
  // This effect synchronizes local state with API data on entity change
  /* eslint-disable react-hooks/set-state-in-effect -- Valid sync with external data */
  useEffect(() => {
    if (moduleDetail && initializedEntityRef.current !== entityKey) {
      // Use manual_categories if available (preserves user intent);
      // fall back to full category list for older modules without it
      const categories = moduleDetail.manual_categories
        ?? moduleDetail.entities?.category
        ?? []
      const dashboards = moduleDetail.entities?.dashboard || []

      setEditedLabel(moduleDetail.label)
      setEditedDescription(moduleDetail.description || '')
      setEditedCategories(categories)
      setEditedDashboards(dashboards)
      setOriginalValues({
        label: moduleDetail.label,
        description: moduleDetail.description || '',
        categories,
        dashboards,
      })

      initializedEntityRef.current = entityKey
    }
  }, [moduleDetail, entityKey])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Change handlers with auto-save
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

  // Category handlers
  const handleAddCategory = useCallback(
    (categoryKey: string) => {
      const newCategories = [...editedCategories, categoryKey]
      setEditedCategories(newCategories)
      if (draftToken) {
        saveChange([{ op: 'add', path: '/categories', value: newCategories }])
      }
    },
    [editedCategories, draftToken, saveChange]
  )

  const handleRemoveCategory = useCallback(
    (categoryKey: string) => {
      const newCategories = editedCategories.filter((k) => k !== categoryKey)
      setEditedCategories(newCategories)
      if (draftToken) {
        saveChange([{ op: 'add', path: '/categories', value: newCategories }])
      }
    },
    [editedCategories, draftToken, saveChange]
  )

  const handleAddDashboard = useCallback(
    (dashboardKey: string) => {
      const newDashboards = [...editedDashboards, dashboardKey]
      setEditedDashboards(newDashboards)
      if (draftToken) {
        saveChange([{ op: 'add', path: '/dashboards', value: newDashboards }])
      }
    },
    [editedDashboards, draftToken, saveChange]
  )

  const handleRemoveDashboard = useCallback(
    (dashboardKey: string) => {
      const newDashboards = editedDashboards.filter((k) => k !== dashboardKey)
      setEditedDashboards(newDashboards)
      if (draftToken) {
        saveChange([{ op: 'add', path: '/dashboards', value: newDashboards }])
      }
    },
    [editedDashboards, draftToken, saveChange]
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

  if (error) {
    return (
      <div className="p-6 text-center text-destructive">
        <p className="font-medium">Failed to load module</p>
        <p className="text-sm text-muted-foreground mt-1">
          {error instanceof Error ? error.message : 'Unknown error'}
        </p>
      </div>
    )
  }

  if (!moduleDetail) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <p>Module not found</p>
      </div>
    )
  }

  // Get change status
  const changeStatus = moduleDetail.change_status || 'unchanged'
  const isDeleted = moduleDetail.deleted || false

  // Get derived entities (read-only, auto-populated)
  const allCategories = moduleDetail.entities?.category || []
  const derivedCategories = allCategories.filter((c: string) => !editedCategories.includes(c))
  const derivedProperties = moduleDetail.entities?.property || []
  const derivedSubobjects = moduleDetail.entities?.subobject || []
  const derivedTemplates = moduleDetail.entities?.template || []
  const derivedResources = moduleDetail.entities?.resource || []
  const totalDerived = derivedCategories.length + derivedProperties.length + derivedSubobjects.length + derivedTemplates.length + derivedResources.length

  // Check for modifications
  const isCategoriesModified =
    JSON.stringify(editedCategories.sort()) !==
    JSON.stringify((originalValues.categories || []).sort())
  const isDashboardsModified =
    JSON.stringify(editedDashboards.sort()) !==
    JSON.stringify((originalValues.dashboards || []).sort())

  // Helper to render a clickable entity chip
  const renderEntityChip = (key: string, type: string, label?: string) => (
    <Badge
      key={key}
      variant="outline"
      className="cursor-pointer hover:bg-secondary/80 gap-1"
      onClick={() => setSelectedEntity(key, type)}
    >
      {label || key}
    </Badge>
  )

  // Helper to get label for an entity
  const getLabel = (key: string, available: Array<{ key: string; label: string }>) => {
    const entity = available.find((e) => e.key === key)
    return entity?.label || key
  }

  return (
    <div className="px-4 py-3">
      {/* Saving indicator */}
      <SaveIndicator isSaving={isSaving} />

      {/* Deleted marker */}
      {isDeleted && (
        <div className="bg-destructive/10 border border-destructive rounded p-3 text-sm">
          This module is marked for deletion
        </div>
      )}

      {/* Header */}
      <EntityHeader
        entityKey={entityKey}
        label={editedLabel}
        description={editedDescription}
        entityType="module"
        changeStatus={changeStatus}
        isEditing={isEditing}
        originalLabel={originalValues.label}
        originalDescription={originalValues.description}
        onLabelChange={handleLabelChange}
        onDescriptionChange={handleDescriptionChange}
      />

      {/* Categories (Manual - Editable) */}
      <AccordionSection
        id="categories"
        title={
          <span className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Categories
            {isCategoriesModified && (
              <Badge variant="secondary" className="text-xs bg-yellow-500/20 text-yellow-700">
                Modified
              </Badge>
            )}
          </span>
        }
        count={editedCategories.length}
        defaultOpen={true}
        colorHint="category"
      >
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Categories directly included in this module. Add categories here to include them and
            their dependencies.
          </p>

          {/* Current categories as chips */}
          <RelationshipChips
            values={editedCategories}
            onRemove={handleRemoveCategory}
            disabled={!isEditing}
            getLabel={(key) => getLabel(key, availableCategories)}
            colorHint="category"
          />

          {/* Empty state */}
          {editedCategories.length === 0 && !isEditing && (
            <p className="text-xs text-muted-foreground/60">No categories in module</p>
          )}

          {/* Add category via combobox in edit mode */}
          {isEditing && (
            <EntityCombobox
              entityType="category"
              availableEntities={availableCategories.filter(
                (c) => !editedCategories.includes(c.key)
              )}
              selectedKeys={[]}
              onChange={(keys) => {
                if (keys.length > 0) {
                  handleAddCategory(keys[0])
                }
              }}
              onCreateNew={(id) => {
                setOnNestedEntityCreated((newKey: string) => {
                  handleAddCategory(newKey)
                })
                openNestedCreateModal({
                  entityType: 'category' as CreateModalEntityType,
                  prefilledId: id,
                  parentContext: { entityType: 'module', fieldName: 'Categories' },
                })
              }}
              placeholder="Add category..."
            />
          )}
        </div>
      </AccordionSection>

      {/* Dashboards (manually added) */}
      <AccordionSection
        id="dashboards"
        title="Dashboards"
        count={editedDashboards.length}
        colorHint="dashboard"
      >
        <div className="space-y-3">
          {isDashboardsModified && (
            <Badge variant="secondary" className="text-xs bg-yellow-500/10 text-yellow-700 border-yellow-300">
              Modified
            </Badge>
          )}
          <p className="text-sm text-muted-foreground">
            Documentation and overview pages included in this module
          </p>

          <RelationshipChips
            values={editedDashboards}
            onRemove={handleRemoveDashboard}
            disabled={!isEditing}
            getLabel={(key) => getLabel(key, availableDashboards)}
            colorHint="dashboard"
          />

          {editedDashboards.length === 0 && !isEditing && (
            <p className="text-xs text-muted-foreground/60">No dashboards</p>
          )}

          {isEditing && (
            <EntityCombobox
              entityType="category"
              availableEntities={availableDashboards.filter(
                (d) => !editedDashboards.includes(d.key)
              )}
              selectedKeys={[]}
              onChange={(keys) => {
                if (keys.length > 0) {
                  handleAddDashboard(keys[0])
                }
              }}
              placeholder="Add dashboard..."
            />
          )}
        </div>
      </AccordionSection>

      {/* Auto-included Entities (Derived - Read Only) */}
      <AccordionSection
        id="derived"
        title={
          <span className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-500" />
            Auto-included Entities
            <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-700 border-purple-300">
              Auto
            </Badge>
          </span>
        }
        count={totalDerived}
        defaultOpen={true}
      >
        <div className="space-y-4">
          <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-md p-3">
            <p className="text-sm text-purple-700 dark:text-purple-300">
              These entities are automatically included based on the categories above. They cannot
              be edited directly - add or remove categories to change what's included.
            </p>
          </div>

          {/* Categories (auto-expanded parents) */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground/70 flex items-center gap-2">
              Categories
              <Badge variant="secondary" className="text-xs">
                {derivedCategories.length}
              </Badge>
            </h4>
            {derivedCategories.length > 0 ? (
              <div className="flex flex-wrap gap-1 pl-4">
                {derivedCategories.map((key: string) =>
                  renderEntityChip(key, 'category', getLabel(key, availableCategories))
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground/60 pl-4">No additional parent categories</p>
            )}
          </div>

          {/* Properties */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground/70 flex items-center gap-2">
              Properties
              <Badge variant="secondary" className="text-xs">
                {derivedProperties.length}
              </Badge>
            </h4>
            {derivedProperties.length > 0 ? (
              <div className="flex flex-wrap gap-1 pl-4">
                {derivedProperties.map((key) =>
                  renderEntityChip(key, 'property', getLabel(key, availableProperties))
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground/60 pl-4">No properties</p>
            )}
          </div>

          {/* Subobjects */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground/70 flex items-center gap-2">
              Subobjects
              <Badge variant="secondary" className="text-xs">
                {derivedSubobjects.length}
              </Badge>
            </h4>
            {derivedSubobjects.length > 0 ? (
              <div className="flex flex-wrap gap-1 pl-4">
                {derivedSubobjects.map((key) =>
                  renderEntityChip(key, 'subobject', getLabel(key, availableSubobjects))
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground/60 pl-4">No subobjects</p>
            )}
          </div>

          {/* Templates */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground/70 flex items-center gap-2">
              Templates
              <Badge variant="secondary" className="text-xs">
                {derivedTemplates.length}
              </Badge>
            </h4>
            {derivedTemplates.length > 0 ? (
              <div className="flex flex-wrap gap-1 pl-4">
                {derivedTemplates.map((key) =>
                  renderEntityChip(key, 'template', getLabel(key, availableTemplates))
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground/60 pl-4">No templates</p>
            )}
          </div>

          {/* Resources */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground/70 flex items-center gap-2">
              Resources
              <Badge variant="secondary" className="text-xs">
                {derivedResources.length}
              </Badge>
            </h4>
            {derivedResources.length > 0 ? (
              <div className="flex flex-wrap gap-1 pl-4">
                {derivedResources.map((key) =>
                  renderEntityChip(key, 'resource', getLabel(key, availableResources))
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground/60 pl-4">No resources</p>
            )}
          </div>
        </div>
      </AccordionSection>

    </div>
  )
}
