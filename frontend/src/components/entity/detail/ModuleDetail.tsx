import { useEffect, useState, useCallback, useRef } from 'react'
import {
  useModule,
  useAvailableEntities,
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
import { Users, GitBranch } from 'lucide-react'
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
 * - Dashboards (manually added, editable)
 * - Parent categories (auto-resolved, read-only preview)
 *
 * Dependency resolution (properties, subobjects, templates, resources)
 * is handled by OntologySync at install time.
 */
export function ModuleDetail({ entityKey, draftId, draftToken, isEditing }: ModuleDetailProps) {
  const { data: module, isLoading, error, refetch: refetchModule } = useModule(entityKey, draftId)
  const availableCategories = useAvailableEntities('categories', draftId)
  const availableDashboards = useAvailableEntities('dashboards', draftId)

  const setSelectedEntity = useGraphStore((s) => s.setSelectedEntity)
  const openNestedCreateModal = useDraftStore((s) => s.openNestedCreateModal)
  const setOnNestedEntityCreated = useDraftStore((s) => s.setOnNestedEntityCreated)

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

  // Auto-save hook — refetch module detail after save to update parent categories
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
      const categories = moduleDetail.categories ?? []
      const dashboards = moduleDetail.dashboards ?? []

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

  // Parent categories (computed on-the-fly by the backend)
  const parentCategories = moduleDetail.parent_categories || []

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
            Categories directly included in this module.
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

          {/* Parent categories (auto-resolved, read-only) */}
          {parentCategories.length > 0 && (
            <div className="mt-4 space-y-2">
              <h4 className="text-sm font-semibold text-foreground/70 flex items-center gap-2">
                <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                Parent categories
                <Badge variant="secondary" className="text-xs">
                  {parentCategories.length}
                </Badge>
              </h4>
              <p className="text-xs text-muted-foreground">
                These parent categories will be auto-included when OntologySync imports this module.
              </p>
              <div className="flex flex-wrap gap-1">
                {parentCategories.map((key: string) =>
                  renderEntityChip(key, 'category', getLabel(key, availableCategories))
                )}
              </div>
            </div>
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

    </div>
  )
}
