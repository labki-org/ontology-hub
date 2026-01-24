import { useBundle } from '@/api/entitiesV2'
import type { BundleDetailV2 } from '@/api/types'
import { AccordionSection } from '@/components/entity/sections/AccordionSection'
import { EditableField } from '@/components/entity/form/EditableField'
import { VisualChangeMarker } from '@/components/entity/form/VisualChangeMarker'
import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'

interface BundleDetailProps {
  entityKey: string
  draftId?: string
  isEditing: boolean
}

/**
 * Bundle detail page showing:
 * - Label and version
 * - Direct modules list
 * - Computed closure (all modules including transitive dependencies)
 * - Edit mode for adding/removing modules
 */
export function BundleDetail({ entityKey, draftId, isEditing }: BundleDetailProps) {
  const { data: bundle, isLoading, error } = useBundle(entityKey, draftId)

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
        Error loading bundle: {error instanceof Error ? error.message : 'Unknown error'}
      </div>
    )
  }

  if (!bundle) {
    return <div className="p-4 text-muted-foreground">Bundle not found</div>
  }

  // Type assertion since useBundle returns EntityWithStatus | BundleDetailV2
  const bundleDetail = bundle as BundleDetailV2

  // Get change status
  const changeStatus = bundleDetail.change_status || 'unchanged'
  const isDeleted = bundleDetail.deleted || false

  // Calculate additional modules in closure (not in direct list)
  const directModules = new Set(bundleDetail.modules || [])
  const additionalModules =
    bundleDetail.closure?.filter((mod) => !directModules.has(mod)) || []

  return (
    <div className="space-y-6">
      {/* Deleted marker */}
      {isDeleted && (
        <div className="bg-destructive/10 border border-destructive rounded p-3 text-sm">
          This bundle is marked for deletion
        </div>
      )}

      {/* Basic info */}
      <div className="space-y-4">
        <EditableField
          value={bundleDetail.label}
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
          placeholder="Bundle label"
        />

        {bundleDetail.version && (
          <VisualChangeMarker status={changeStatus} className="py-2">
            <div className="text-sm">
              <span className="text-muted-foreground">Version: </span>
              <Badge variant="outline">{bundleDetail.version}</Badge>
            </div>
          </VisualChangeMarker>
        )}
      </div>

      {/* Direct modules */}
      <AccordionSection
        id="modules"
        title="Modules"
        count={bundleDetail.modules?.length || 0}
        defaultOpen={true}
      >
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Modules directly included in this bundle
          </p>
          {bundleDetail.modules && bundleDetail.modules.length > 0 ? (
            <ul className="space-y-1 pl-4">
              {bundleDetail.modules.map((moduleKey) => (
                <li key={moduleKey} className="text-sm">
                  <VisualChangeMarker status="unchanged">
                    <div className="flex items-center justify-between py-1 px-2 hover:bg-accent rounded">
                      <span className="font-mono text-xs">{moduleKey}</span>
                      {isEditing && (
                        <button
                          className="text-destructive hover:text-destructive/80 text-xs"
                          onClick={() => {
                            // TODO: Remove module
                            console.log('Remove module:', moduleKey)
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
          ) : (
            <div className="text-sm text-muted-foreground italic">
              No modules in this bundle
            </div>
          )}
          {isEditing && (
            <button
              className="text-sm text-primary hover:text-primary/80 mt-2"
              onClick={() => {
                // TODO: Add module UI
                console.log('Add module')
              }}
            >
              + Add module
            </button>
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
              {bundleDetail.modules && bundleDetail.modules.length > 0 && (
                <div>
                  <h5 className="text-xs font-medium text-muted-foreground uppercase mb-1">
                    Direct ({bundleDetail.modules.length})
                  </h5>
                  <ul className="space-y-1 pl-4">
                    {bundleDetail.modules.map((moduleKey) => (
                      <li
                        key={moduleKey}
                        className="text-sm font-mono text-xs py-1 text-primary"
                      >
                        {moduleKey}
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
                        {moduleKey}
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
                {/* TODO: Calculate based on change type */}
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
