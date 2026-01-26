import { useEffect, useState, useCallback, useRef } from 'react'
import { useBundle, useModules } from '@/api/entities'
import type { BundleDetailV2 } from '@/api/types'
import { useAutoSave } from '@/hooks/useAutoSave'
import { useGraphStore } from '@/stores/graphStore'
import { useDraftStore } from '@/stores/draftStore'
import { AccordionSection } from '@/components/entity/sections/AccordionSection'
import { EntityHeader } from '../sections/EntityHeader'
import { EntityCombobox } from '../forms/EntityCombobox'
import { RelationshipChips } from '../forms/RelationshipChips'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

interface BundleDetailProps {
  entityKey: string
  draftId?: string
  draftToken?: string
  isEditing: boolean
}

/**
 * Bundle detail page showing:
 * - Label and version
 * - Direct modules list
 * - Computed closure (all modules including transitive dependencies)
 * - Edit mode for adding/removing modules
 */
export function BundleDetail({ entityKey, draftId, draftToken, isEditing }: BundleDetailProps) {
  const { data: bundle, isLoading, error } = useBundle(entityKey, draftId)
  const { data: modulesData } = useModules(undefined, undefined, draftId)

  const setSelectedEntity = useGraphStore((s) => s.setSelectedEntity)
  const openNestedCreateModal = useDraftStore((s) => s.openNestedCreateModal)
  const setOnNestedEntityCreated = useDraftStore((s) => s.setOnNestedEntityCreated)

  // Build available modules for selection
  const availableModules = (modulesData?.items || []).map((m) => ({
    key: m.entity_key,
    label: m.label,
  }))

  // Track original values for change detection
  const [originalValues, setOriginalValues] = useState<{ label?: string; description?: string }>({})

  // Local editable state
  const [editedLabel, setEditedLabel] = useState('')
  const [editedDescription, setEditedDescription] = useState('')
  const [editedModules, setEditedModules] = useState<string[]>([])

  // Track which entity we've initialized original values for (prevent reset on refetch)
  const initializedEntityRef = useRef<string | null>(null)

  // Auto-save hook
  const { saveChange, isSaving } = useAutoSave({
    draftToken: draftToken || '',
    entityType: 'bundle',
    entityKey,
    debounceMs: 500,
  })

  // Type assertion since useBundle returns EntityWithStatus | BundleDetailV2
  const bundleDetail = bundle as BundleDetailV2 | undefined

  // Initialize state when bundle loads
  useEffect(() => {
    if (bundleDetail) {
      const isNewEntity = initializedEntityRef.current !== entityKey

      // Only reset edited values and original values for a NEW entity
      // (not on refetch after auto-save)
      if (isNewEntity) {
        setEditedLabel(bundleDetail.label)
        setEditedDescription(bundleDetail.description || '')
        setEditedModules(bundleDetail.modules || [])
        setOriginalValues({
          label: bundleDetail.label,
          description: bundleDetail.description || '',
        })

        initializedEntityRef.current = entityKey
      }
    }
  }, [bundleDetail, entityKey])

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

  const handleAddModule = useCallback(
    (moduleKey: string) => {
      const newModules = [...editedModules, moduleKey]
      setEditedModules(newModules)
      if (draftToken) {
        saveChange([{ op: 'add', path: '/modules', value: newModules }])
      }
    },
    [editedModules, draftId, saveChange]
  )

  const handleRemoveModule = useCallback(
    (moduleKey: string) => {
      const newModules = editedModules.filter((m) => m !== moduleKey)
      setEditedModules(newModules)
      if (draftToken) {
        saveChange([{ op: 'add', path: '/modules', value: newModules }])
      }
    },
    [editedModules, draftId, saveChange]
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
        <p className="font-medium">Failed to load bundle</p>
        <p className="text-sm text-muted-foreground mt-1">
          {error instanceof Error ? error.message : 'Unknown error'}
        </p>
      </div>
    )
  }

  if (!bundleDetail) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <p>Bundle not found</p>
      </div>
    )
  }

  // Get change status
  const changeStatus = bundleDetail.change_status || 'unchanged'
  const isDeleted = bundleDetail.deleted || false

  // Calculate additional modules in closure (not in direct list)
  const directModules = new Set(editedModules)
  const additionalModules =
    bundleDetail.closure?.filter((mod) => !directModules.has(mod)) || []

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
          This bundle is marked for deletion
        </div>
      )}

      {/* Header */}
      <EntityHeader
        entityKey={entityKey}
        label={editedLabel}
        description={editedDescription}
        entityType="bundle"
        changeStatus={changeStatus}
        isEditing={isEditing}
        originalLabel={originalValues.label}
        originalDescription={originalValues.description}
        onLabelChange={handleLabelChange}
        onDescriptionChange={handleDescriptionChange}
      />

      {/* Version badge */}
      {bundleDetail.version && (
        <div className="text-sm">
          <span className="text-muted-foreground">Version: </span>
          <Badge variant="outline">{bundleDetail.version}</Badge>
        </div>
      )}

      {/* Direct modules */}
      <AccordionSection
        id="modules"
        title="Modules"
        count={editedModules.length}
        defaultOpen={true}
      >
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Modules directly included in this bundle
          </p>

          {/* Current modules as chips */}
          <RelationshipChips
            values={editedModules}
            onRemove={handleRemoveModule}
            disabled={!isEditing}
            getLabel={(key) => {
              const mod = availableModules.find((m) => m.key === key)
              return mod?.label || key
            }}
          />

          {/* Empty state */}
          {editedModules.length === 0 && !isEditing && (
            <p className="text-sm text-muted-foreground italic">No modules in bundle</p>
          )}

          {/* Add module via combobox in edit mode */}
          {isEditing && (
            <EntityCombobox
              entityType="module"
              availableEntities={availableModules.filter((m) => !editedModules.includes(m.key))}
              selectedKeys={[]}
              onChange={(keys) => {
                if (keys.length > 0) {
                  handleAddModule(keys[0])
                }
              }}
              onCreateNew={(id) => {
                setOnNestedEntityCreated((newKey: string) => {
                  handleAddModule(newKey)
                })
                openNestedCreateModal({
                  entityType: 'module',
                  prefilledId: id,
                  parentContext: { entityType: 'bundle', fieldName: 'Modules' },
                })
              }}
              placeholder="Add module..."
            />
          )}
        </div>
      </AccordionSection>

      {/* Computed closure (transitive dependencies) */}
      <AccordionSection
        id="closure"
        title="Computed Closure"
        count={bundleDetail.closure?.length || 0}
        defaultOpen={false}
      >
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            All modules including transitive dependencies (modules required by modules in this
            bundle)
          </p>
          {bundleDetail.closure && bundleDetail.closure.length > 0 ? (
            <div className="space-y-3">
              {/* Direct modules in closure */}
              {editedModules.length > 0 && (
                <div>
                  <h5 className="text-xs font-medium text-muted-foreground uppercase mb-1">
                    Direct ({editedModules.length})
                  </h5>
                  <ul className="space-y-1 pl-4">
                    {editedModules.map((moduleKey) => (
                      <li
                        key={moduleKey}
                        className="text-sm font-mono text-xs py-1 text-primary"
                      >
                        <Badge
                          variant="outline"
                          className="cursor-pointer hover:bg-secondary/80"
                          onClick={() => setSelectedEntity(moduleKey, 'module')}
                        >
                          {moduleKey}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Additional modules from dependencies */}
              {additionalModules.length > 0 && (
                <div>
                  <h5 className="text-xs font-medium text-muted-foreground uppercase mb-1">
                    Transitive Dependencies ({additionalModules.length})
                  </h5>
                  <ul className="space-y-1 pl-4">
                    {additionalModules.map((moduleKey) => (
                      <li key={moduleKey} className="text-sm font-mono text-xs py-1">
                        <Badge
                          variant="outline"
                          className="cursor-pointer hover:bg-secondary/80"
                          onClick={() => setSelectedEntity(moduleKey, 'module')}
                        >
                          {moduleKey}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground italic">
              No modules in closure
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
              <Badge variant="outline">{bundleDetail.version || 'unreleased'}</Badge>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">Suggested: </span>
              <Badge variant="secondary">
                {changeStatus === 'added'
                  ? 'New bundle'
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
