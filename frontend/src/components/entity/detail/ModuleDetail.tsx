import { useEffect, useState, useCallback, useRef } from 'react'
import {
  useModule,
  useModules,
  useCategories,
  useProperties,
  useSubobjects,
  useTemplates,
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

interface ModuleDetailProps {
  entityKey: string
  draftId?: string
  draftToken?: string
  isEditing: boolean
}

/**
 * Module detail page showing:
 * - Label and version
 * - Direct categories (manually added, editable)
 * - Module dependencies (manually added, editable)
 * - Auto-included entities (derived from categories, read-only)
 * - Computed closure (transitive category dependencies)
 *
 * Only categories and module dependencies are editable.
 * Properties, subobjects, and templates are auto-populated based on
 * what the categories require.
 */
export function ModuleDetail({ entityKey, draftId, draftToken, isEditing }: ModuleDetailProps) {
  const { data: module, isLoading, error } = useModule(entityKey, draftId)
  const { data: modulesData } = useModules(undefined, undefined, draftId)
  const { data: categoriesData } = useCategories(undefined, undefined, draftId)
  const { data: propertiesData } = useProperties(undefined, undefined, draftId)
  const { data: subobjectsData } = useSubobjects(undefined, undefined, draftId)
  const { data: templatesData } = useTemplates(undefined, undefined, draftId)

  const setSelectedEntity = useGraphStore((s) => s.setSelectedEntity)
  const openNestedCreateModal = useDraftStore((s) => s.openNestedCreateModal)
  const setOnNestedEntityCreated = useDraftStore((s) => s.setOnNestedEntityCreated)

  // Build available entities for lookups
  const availableCategories = (categoriesData?.items || []).map((c) => ({
    key: c.entity_key,
    label: c.label,
  }))
  const availableModules = (modulesData?.items || [])
    .filter((m) => m.entity_key !== entityKey) // Exclude self
    .map((m) => ({
      key: m.entity_key,
      label: m.label,
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

  // Track original values for change detection
  const [originalValues, setOriginalValues] = useState<{
    label?: string
    description?: string
    categories?: string[]
    dependencies?: string[]
  }>({})

  // Local editable state - only categories and dependencies are editable
  const [editedLabel, setEditedLabel] = useState('')
  const [editedDescription, setEditedDescription] = useState('')
  const [editedCategories, setEditedCategories] = useState<string[]>([])
  const [editedDependencies, setEditedDependencies] = useState<string[]>([])

  // Track which entity we've initialized original values for (prevent reset on refetch)
  const initializedEntityRef = useRef<string | null>(null)

  // Auto-save hook
  const { saveChange, isSaving } = useAutoSave({
    draftToken: draftToken || '',
    entityType: 'module',
    entityKey,
    debounceMs: 500,
  })

  // Type assertion since useModule returns EntityWithStatus | ModuleDetailV2
  const moduleDetail = module as ModuleDetailV2 | undefined

  // Initialize state when module loads
  useEffect(() => {
    if (moduleDetail) {
      const isNewEntity = initializedEntityRef.current !== entityKey

      if (isNewEntity) {
        const categories = moduleDetail.entities?.category || []
        const dependencies = moduleDetail.dependencies || []

        setEditedLabel(moduleDetail.label)
        setEditedDescription(moduleDetail.description || '')
        setEditedCategories(categories)
        setEditedDependencies(dependencies)
        setOriginalValues({
          label: moduleDetail.label,
          description: moduleDetail.description || '',
          categories,
          dependencies,
        })

        initializedEntityRef.current = entityKey
      }
    }
  }, [moduleDetail, entityKey])

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

  // Dependency handlers
  const handleAddDependency = useCallback(
    (moduleKey: string) => {
      const newDependencies = [...editedDependencies, moduleKey]
      setEditedDependencies(newDependencies)
      if (draftToken) {
        saveChange([{ op: 'add', path: '/dependencies', value: newDependencies }])
      }
    },
    [editedDependencies, draftToken, saveChange]
  )

  const handleRemoveDependency = useCallback(
    (moduleKey: string) => {
      const newDependencies = editedDependencies.filter((k) => k !== moduleKey)
      setEditedDependencies(newDependencies)
      if (draftToken) {
        saveChange([{ op: 'add', path: '/dependencies', value: newDependencies }])
      }
    },
    [editedDependencies, draftToken, saveChange]
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
  const derivedProperties = moduleDetail.entities?.property || []
  const derivedSubobjects = moduleDetail.entities?.subobject || []
  const derivedTemplates = moduleDetail.entities?.template || []
  const totalDerived = derivedProperties.length + derivedSubobjects.length + derivedTemplates.length

  // Check for modifications
  const isCategoriesModified =
    JSON.stringify(editedCategories.sort()) !==
    JSON.stringify((originalValues.categories || []).sort())
  const isDependenciesModified =
    JSON.stringify(editedDependencies.sort()) !==
    JSON.stringify((originalValues.dependencies || []).sort())

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
    <div className="p-6 space-y-6">
      {/* Saving indicator */}
      {isSaving && (
        <div className="fixed top-4 right-4 bg-primary text-primary-foreground px-3 py-1 rounded text-sm z-50">
          Saving...
        </div>
      )}

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

      {/* Version badge */}
      {moduleDetail.version && (
        <div className="text-sm">
          <span className="text-muted-foreground">Version: </span>
          <Badge variant="outline">{moduleDetail.version}</Badge>
        </div>
      )}

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
          />

          {/* Empty state */}
          {editedCategories.length === 0 && !isEditing && (
            <p className="text-sm text-muted-foreground italic">No categories in module</p>
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

      {/* Module Dependencies (Manual - Editable) */}
      <AccordionSection
        id="dependencies"
        title={
          <span className="flex items-center gap-2">
            Module Dependencies
            {isDependenciesModified && (
              <Badge variant="secondary" className="text-xs bg-yellow-500/20 text-yellow-700">
                Modified
              </Badge>
            )}
          </span>
        }
        count={editedDependencies.length}
        defaultOpen={true}
      >
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Other modules that must be installed before this module
          </p>

          {/* Current dependencies as chips */}
          <RelationshipChips
            values={editedDependencies}
            onRemove={handleRemoveDependency}
            disabled={!isEditing}
            getLabel={(key) => getLabel(key, availableModules)}
          />

          {/* Empty state */}
          {editedDependencies.length === 0 && !isEditing && (
            <p className="text-sm text-muted-foreground italic">No module dependencies</p>
          )}

          {/* Add dependency via combobox in edit mode */}
          {isEditing && (
            <EntityCombobox
              entityType="module"
              availableEntities={availableModules.filter(
                (m) => !editedDependencies.includes(m.key)
              )}
              selectedKeys={[]}
              onChange={(keys) => {
                if (keys.length > 0) {
                  handleAddDependency(keys[0])
                }
              }}
              placeholder="Add module dependency..."
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

          {/* Properties */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
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
              <p className="text-sm text-muted-foreground italic pl-4">No properties</p>
            )}
          </div>

          {/* Subobjects */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
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
              <p className="text-sm text-muted-foreground italic pl-4">No subobjects</p>
            )}
          </div>

          {/* Templates */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
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
              <p className="text-sm text-muted-foreground italic pl-4">No templates</p>
            )}
          </div>
        </div>
      </AccordionSection>

      {/* Computed closure (transitive category dependencies) */}
      <AccordionSection
        id="closure"
        title="Category Closure"
        count={moduleDetail.closure?.length || 0}
        defaultOpen={false}
      >
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Transitive category dependencies - parent categories that are required by the
            categories in this module
          </p>
          {moduleDetail.closure && moduleDetail.closure.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {moduleDetail.closure.map((categoryKey) =>
                renderEntityChip(categoryKey, 'category', getLabel(categoryKey, availableCategories))
              )}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground italic">
              No transitive dependencies
            </div>
          )}
        </div>
      </AccordionSection>

      {/* Suggested version increment */}
      {draftId && (
        <AccordionSection id="version-info" title="Version Information" defaultOpen={false}>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Suggested version increment based on changes
            </p>
            <div className="text-sm">
              <span className="text-muted-foreground">Current: </span>
              <Badge variant="outline">{moduleDetail.version || 'unreleased'}</Badge>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">Suggested: </span>
              <Badge variant="secondary">
                {changeStatus === 'added'
                  ? 'New module'
                  : changeStatus === 'modified'
                    ? 'Patch'
                    : 'No change'}
              </Badge>
            </div>
          </div>
        </AccordionSection>
      )}
    </div>
  )
}
