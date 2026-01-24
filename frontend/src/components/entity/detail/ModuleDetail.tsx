import { useEffect, useState, useCallback } from 'react'
import { useModule } from '@/api/entitiesV2'
import type { ModuleDetailV2, EntityType } from '@/api/types'
import { useAutoSave } from '@/hooks/useAutoSave'
import { useDetailStore } from '@/stores/detailStore'
import { AccordionSection } from '@/components/entity/sections/AccordionSection'
import { EntityHeader } from '../sections/EntityHeader'
import { EditableList } from '../form/EditableList'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

interface ModuleDetailProps {
  entityKey: string
  draftId?: string
  isEditing: boolean
}

/**
 * Module detail page showing:
 * - Label and version
 * - Direct members grouped by entity type (categories, properties, subobjects, etc.)
 * - Computed closure (transitive category dependencies)
 * - Edit mode for adding/removing members
 */
export function ModuleDetail({ entityKey, draftId, isEditing }: ModuleDetailProps) {
  const { data: module, isLoading, error } = useModule(entityKey, draftId)
  const openDetail = useDetailStore((s) => s.openDetail)
  const pushBreadcrumb = useDetailStore((s) => s.pushBreadcrumb)

  // Track original values for change detection
  const [originalValues, setOriginalValues] = useState<{ label?: string }>({})

  // Local editable state
  const [editedLabel, setEditedLabel] = useState('')
  const [editedEntities, setEditedEntities] = useState<Record<string, string[]>>({})

  // Auto-save hook
  const { saveChange, isSaving } = useAutoSave({
    draftToken: draftId || '',
    entityType: 'module',
    entityKey,
    debounceMs: 500,
  })

  // Type assertion since useModule returns EntityWithStatus | ModuleDetailV2
  const moduleDetail = module as ModuleDetailV2 | undefined

  // Initialize state when module loads
  useEffect(() => {
    if (moduleDetail) {
      setEditedLabel(moduleDetail.label)
      setEditedEntities(moduleDetail.entities || {})
      setOriginalValues({ label: moduleDetail.label })
      pushBreadcrumb(entityKey, 'module', moduleDetail.label)
    }
  }, [moduleDetail, entityKey, pushBreadcrumb])

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

  const handleAddEntity = useCallback(
    (entityType: string, entKey: string) => {
      const newEntities = { ...editedEntities }
      if (!newEntities[entityType]) newEntities[entityType] = []
      newEntities[entityType] = [...newEntities[entityType], entKey]
      setEditedEntities(newEntities)
      if (draftId) {
        saveChange([{ op: 'replace', path: '/entities', value: newEntities }])
      }
    },
    [editedEntities, draftId, saveChange]
  )

  const handleRemoveEntity = useCallback(
    (entityType: string, entKey: string) => {
      const newEntities = { ...editedEntities }
      newEntities[entityType] = (newEntities[entityType] || []).filter((k) => k !== entKey)
      setEditedEntities(newEntities)
      if (draftId) {
        saveChange([{ op: 'replace', path: '/entities', value: newEntities }])
      }
    },
    [editedEntities, draftId, saveChange]
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

  // Calculate total members count
  const totalMembers = Object.values(editedEntities).reduce(
    (sum, members) => sum + members.length,
    0
  )

  // Entity types to iterate
  const entityTypes = ['category', 'property', 'subobject', 'template']

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
        description={null}
        entityType="module"
        changeStatus={changeStatus}
        isEditing={isEditing}
        originalLabel={originalValues.label}
        onLabelChange={handleLabelChange}
      />

      {/* Version badge */}
      {moduleDetail.version && (
        <div className="text-sm">
          <span className="text-muted-foreground">Version: </span>
          <Badge variant="outline">{moduleDetail.version}</Badge>
        </div>
      )}

      {/* Direct members grouped by entity type */}
      <AccordionSection
        id="members"
        title="Direct Members"
        count={totalMembers}
        defaultOpen={true}
      >
        <div className="space-y-4">
          {entityTypes.map((entityType) => (
            <div key={entityType} className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground capitalize">
                {entityType}s
                <Badge variant="secondary" className="ml-2 text-xs">
                  {editedEntities[entityType]?.length || 0}
                </Badge>
              </h4>
              <div className="pl-4">
                <EditableList
                  items={editedEntities[entityType] || []}
                  onAdd={(key) => handleAddEntity(entityType, key)}
                  onRemove={(key) => handleRemoveEntity(entityType, key)}
                  isEditing={isEditing}
                  placeholder={`Add ${entityType}...`}
                  emptyMessage={`No ${entityType}s in module`}
                  renderItem={(key) => (
                    <Badge
                      variant="secondary"
                      className="cursor-pointer hover:bg-secondary/80"
                      onClick={() => openDetail(key, entityType as EntityType)}
                    >
                      {key}
                    </Badge>
                  )}
                />
              </div>
            </div>
          ))}

          {Object.keys(editedEntities).length === 0 && (
            <div className="text-sm text-muted-foreground italic">
              No members in this module
            </div>
          )}
        </div>
      </AccordionSection>

      {/* Computed closure (transitive dependencies) */}
      <AccordionSection
        id="closure"
        title="Computed Closure"
        count={moduleDetail.closure?.length || 0}
        defaultOpen={false}
      >
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Transitive category dependencies (categories required by categories in this module)
          </p>
          {moduleDetail.closure && moduleDetail.closure.length > 0 ? (
            <ul className="space-y-1 pl-4">
              {moduleDetail.closure.map((categoryKey) => (
                <li key={categoryKey} className="text-sm font-mono text-xs py-1">
                  <Badge
                    variant="outline"
                    className="cursor-pointer hover:bg-secondary/80"
                    onClick={() => openDetail(categoryKey, 'category')}
                  >
                    {categoryKey}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-muted-foreground italic">
              No transitive dependencies
            </div>
          )}
        </div>
      </AccordionSection>

      {/* Suggested version increment */}
      {draftId && (
        <AccordionSection
          id="version-info"
          title="Version Information"
          defaultOpen={false}
        >
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
