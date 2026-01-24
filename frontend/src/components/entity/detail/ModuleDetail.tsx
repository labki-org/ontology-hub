import { useModule } from '@/api/entitiesV2'
import type { ModuleDetailV2 } from '@/api/types'
import { AccordionSection } from '@/components/entity/sections/AccordionSection'
import { EditableField } from '@/components/entity/form/EditableField'
import { VisualChangeMarker } from '@/components/entity/form/VisualChangeMarker'
import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-destructive">
        Error loading module: {error instanceof Error ? error.message : 'Unknown error'}
      </div>
    )
  }

  if (!module) {
    return <div className="p-4 text-muted-foreground">Module not found</div>
  }

  // Type assertion since useModule returns EntityWithStatus | ModuleDetailV2
  const moduleDetail = module as ModuleDetailV2

  // Get change status
  const changeStatus = moduleDetail.change_status || 'unchanged'
  const isDeleted = moduleDetail.deleted || false

  // Calculate total members count
  const totalMembers = Object.values(moduleDetail.entities || {}).reduce(
    (sum, members) => sum + members.length,
    0
  )

  return (
    <div className="space-y-6">
      {/* Deleted marker */}
      {isDeleted && (
        <div className="bg-destructive/10 border border-destructive rounded p-3 text-sm">
          This module is marked for deletion
        </div>
      )}

      {/* Basic info */}
      <div className="space-y-4">
        <EditableField
          value={moduleDetail.label}
          originalValue={undefined} // TODO: Get original value from canonical when in draft
          onChange={(value) => {
            // TODO: Auto-save via draft changes API
            console.log('Update label:', value)
          }}
          onRevert={() => {
            // TODO: Revert to original
            console.log('Revert label')
          }}
          isEditing={isEditing}
          label="Label"
          placeholder="Module label"
        />

        {moduleDetail.version && (
          <VisualChangeMarker status={changeStatus} className="py-2">
            <div className="text-sm">
              <span className="text-muted-foreground">Version: </span>
              <Badge variant="outline">{moduleDetail.version}</Badge>
            </div>
          </VisualChangeMarker>
        )}
      </div>

      {/* Direct members grouped by entity type */}
      <AccordionSection
        id="members"
        title="Direct Members"
        count={totalMembers}
        defaultOpen={true}
      >
        <div className="space-y-4">
          {Object.entries(moduleDetail.entities || {}).map(([entityType, members]) => (
            <div key={entityType} className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground capitalize">
                {entityType}s
                <Badge variant="secondary" className="ml-2 text-xs">
                  {members.length}
                </Badge>
              </h4>
              <div className="pl-4 space-y-1">
                {members.length === 0 ? (
                  <div className="text-sm text-muted-foreground italic">
                    No {entityType}s
                  </div>
                ) : (
                  <ul className="space-y-1">
                    {members.map((memberKey) => (
                      <li key={memberKey} className="text-sm">
                        <VisualChangeMarker status="unchanged">
                          <div className="flex items-center justify-between py-1 px-2 hover:bg-accent rounded">
                            <span className="font-mono text-xs">{memberKey}</span>
                            {isEditing && (
                              <button
                                className="text-destructive hover:text-destructive/80 text-xs"
                                onClick={() => {
                                  // TODO: Remove member
                                  console.log('Remove member:', memberKey)
                                }}
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        </VisualChangeMarker>
                      </li>
                    ))}
                  </ul>
                )}
                {isEditing && (
                  <button
                    className="text-sm text-primary hover:text-primary/80 mt-2"
                    onClick={() => {
                      // TODO: Add member UI
                      console.log('Add', entityType)
                    }}
                  >
                    + Add {entityType}
                  </button>
                )}
              </div>
            </div>
          ))}

          {Object.keys(moduleDetail.entities || {}).length === 0 && (
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
                  {categoryKey}
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
                {/* TODO: Calculate based on change type */}
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
