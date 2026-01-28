import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronRight, Boxes, Tag, Package, Layers, Archive, FileCode, LayoutDashboard, FileText, Plus, Trash2 } from 'lucide-react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EntitySearch, useSearchFilter } from '@/components/search/EntitySearch'
import { useDebounce } from '@/hooks/useDebounce'
import {
  useCategories,
  useProperties,
  useSubobjects,
  useModules,
  useBundles,
  useTemplates,
  useDashboards,
  useResources,
  useOntologyVersion,
} from '@/api/entities'
import { useDraftV2, useCreateEntityChange, useDeleteEntityChange, useUndoDeleteChange, useDraftChanges } from '@/api/drafts'
import { useGraphStore } from '@/stores/graphStore'
import { useDraftStore } from '@/stores/draftStore'
import { getAffectedEntityCount } from '@/lib/dependencyGraph'
import { canDelete } from '@/lib/dependencyChecker'
import { cn } from '@/lib/utils'
import type { EntityWithStatus } from '@/api/types'
import { CreateEntityModal } from '@/components/entity/modals/CreateEntityModal'
import { NestedModalStack } from '@/components/entity/modals/NestedModalStack'
import { DeleteConfirmation } from '@/components/entity/DeleteConfirmation'
import { DeletedItemBadge } from '@/components/entity/form/DeletedItemBadge'
import { CategoryForm } from '@/components/entity/forms/CategoryForm'
import { PropertyForm } from '@/components/entity/forms/PropertyForm'
import { SubobjectForm } from '@/components/entity/forms/SubobjectForm'
import { TemplateForm } from '@/components/entity/forms/TemplateForm'
import { ModuleForm } from '@/components/entity/forms/ModuleForm'
import { BundleForm } from '@/components/entity/forms/BundleForm'
import { DashboardForm } from '@/components/entity/forms/DashboardForm'
import { ResourceForm } from '@/components/entity/forms/ResourceForm'

interface EntitySectionProps {
  title: string
  icon: React.ComponentType<{ className?: string }>
  entities: EntityWithStatus[]
  isLoading: boolean
  searchTerm: string
  entityType: 'category' | 'property' | 'subobject' | 'template' | 'module' | 'bundle' | 'dashboard' | 'resource'
  isDraftMode: boolean
  onAddNew?: () => void
  onDelete?: (entityKey: string, entityLabel: string) => void
  onUndoDelete?: (entityKey: string) => void
  deletedEntityChanges: Map<string, string>
}

function EntitySection({
  title,
  icon: Icon,
  entities,
  isLoading,
  searchTerm,
  entityType,
  isDraftMode,
  onAddNew,
  onDelete,
  onUndoDelete,
  deletedEntityChanges,
}: EntitySectionProps) {
  const setSelectedEntity = useGraphStore((state) => state.setSelectedEntity)
  const directEdits = useDraftStore((s) => s.directlyEditedEntities)
  const transitiveAffects = useDraftStore((s) => s.transitivelyAffectedEntities)
  const filteredEntities = useSearchFilter(searchTerm, entities)

  if (isLoading) {
    return (
      <div className="space-y-2 p-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    )
  }

  return (
    <Collapsible defaultOpen>
      <div className="flex items-center w-full">
        <CollapsibleTrigger className="flex items-center flex-1 px-2 py-1.5 rounded hover:bg-sidebar-accent text-sm group">
          <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]:rotate-90" />
          <Icon className="h-4 w-4 ml-1 mr-2" />
          <span className="font-medium">{title}</span>
          <Badge variant="secondary" className="ml-auto">
            {filteredEntities.length}
          </Badge>
        </CollapsibleTrigger>
        {isDraftMode && onAddNew && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onAddNew()
            }}
            className="p-1 mr-1 rounded hover:bg-sidebar-accent"
            aria-label={`Add new ${title.toLowerCase().slice(0, -1)}`}
            title={`Add new ${title.toLowerCase().slice(0, -1)}`}
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>
      <CollapsibleContent>
        <ul className="ml-7 space-y-0.5">
          {filteredEntities.map((entity) => {
            const isDeleted = entity.change_status === 'deleted' || entity.deleted || deletedEntityChanges.has(entity.entity_key)
            const isDirectEdit = directEdits.has(entity.entity_key)
            const isTransitiveEffect = transitiveAffects.has(entity.entity_key)

            // If entity is deleted and we're in draft mode, show DeletedItemBadge
            if (isDeleted && isDraftMode && onUndoDelete) {
              return (
                <li key={entity.entity_key}>
                  <DeletedItemBadge
                    label={entity.label}
                    onUndo={() => onUndoDelete(entity.entity_key)}
                    className="px-2 py-1"
                  />
                </li>
              )
            }

            return (
              <li key={entity.entity_key} className="group">
                <div
                  className={cn(
                    'flex items-center gap-1 w-full px-2 py-1 text-sm rounded hover:bg-sidebar-accent',
                    isDirectEdit && 'bg-blue-100 dark:bg-blue-900/30',
                    // Only show transitive if NOT direct edit (direct wins)
                    !isDirectEdit && isTransitiveEffect && 'bg-blue-50 dark:bg-blue-900/10',
                    isDeleted && 'line-through text-muted-foreground'
                  )}
                >
                  <button
                    onClick={() => setSelectedEntity(entity.entity_key, entityType)}
                    className="flex-1 truncate text-left"
                    title={entity.label}
                  >
                    {entity.label}
                  </button>
                  {entity.change_status && entity.change_status !== 'unchanged' && (
                    <Badge
                      variant={
                        entity.change_status === 'added'
                          ? 'default'
                          : entity.change_status === 'modified'
                          ? 'secondary'
                          : 'destructive'
                      }
                      className={cn(
                        'flex-shrink-0',
                        entity.change_status === 'added' && 'bg-green-500 hover:bg-green-600',
                        entity.change_status === 'modified' && 'bg-yellow-500 hover:bg-yellow-600'
                      )}
                    >
                      {entity.change_status === 'added'
                        ? '+'
                        : entity.change_status === 'modified'
                        ? '~'
                        : '-'}
                    </Badge>
                  )}
                  {/* Delete button - visible on hover in draft mode */}
                  {isDraftMode && onDelete && !isDeleted && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onDelete(entity.entity_key, entity.label)
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-opacity"
                      aria-label={`Delete ${entity.label}`}
                      title={`Delete ${entity.label}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </li>
            )
          })}
          {filteredEntities.length === 0 && (
            <li className="px-2 py-1 text-sm text-muted-foreground italic">
              {searchTerm ? 'No matches found' : `No ${title.toLowerCase()} found`}
            </li>
          )}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  )
}

export function Sidebar() {
  const [searchParams] = useSearchParams()
  const draftToken = searchParams.get('draft_token') || undefined
  const draftV2 = useDraftV2(draftToken)

  // Derive draftId from fetched draft (v2 workflow) or fall back to URL param (v1 workflow)
  const draftId = draftV2.data?.id?.toString() || searchParams.get('draft_id') || undefined

  // Draft mode state - determines if "+ New" and delete buttons are visible
  const isDraftMode = !!draftToken

  // Create modal state and actions
  const openCreateModal = useDraftStore((s) => s.openCreateModal)
  const closeCreateModal = useDraftStore((s) => s.closeCreateModal)
  const createModalOpen = useDraftStore((s) => s.createModalOpen)
  const createModalEntityType = useDraftStore((s) => s.createModalEntityType)

  // Nested create modal state and actions (for cascading create flow)
  const openNestedCreateModal = useDraftStore((s) => s.openNestedCreateModal)
  const setOnNestedEntityCreated = useDraftStore((s) => s.setOnNestedEntityCreated)

  // Delete state and actions
  const deleteBlockedEntity = useDraftStore((s) => s.deleteBlockedEntity)
  const setDeleteBlocked = useDraftStore((s) => s.setDeleteBlocked)
  const trackDeletedEntity = useDraftStore((s) => s.trackDeletedEntity)
  const untrackDeletedEntity = useDraftStore((s) => s.untrackDeletedEntity)
  const deletedEntityChanges = useDraftStore((s) => s.deletedEntityChanges)

  // Entity mutations
  const createEntity = useCreateEntityChange(draftToken)
  const deleteEntity = useDeleteEntityChange(draftToken)
  const undoDelete = useUndoDeleteChange(draftToken)

  // Fetch draft changes to find changeIds for undo
  const { data: draftChangesData } = useDraftChanges(draftToken)

  // Graph store for selecting new entity after creation and dependency checking
  const setSelectedEntity = useGraphStore((s) => s.setSelectedEntity)
  const graphNodes = useGraphStore((s) => s.nodes)
  const graphEdges = useGraphStore((s) => s.edges)

  // Change tracking state for badge display
  const directEdits = useDraftStore((s) => s.directlyEditedEntities)
  const transitiveAffects = useDraftStore((s) => s.transitivelyAffectedEntities)
  const affectedCount = getAffectedEntityCount(directEdits, transitiveAffects)

  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearchTerm = useDebounce(searchTerm, 150)

  // Fetch all entity types
  const { data: categoriesData, isLoading: categoriesLoading } = useCategories(
    undefined,
    undefined,
    draftId
  )
  const { data: propertiesData, isLoading: propertiesLoading } = useProperties(
    undefined,
    undefined,
    draftId
  )
  const { data: subobjectsData, isLoading: subobjectsLoading } = useSubobjects(
    undefined,
    undefined,
    draftId
  )
  const { data: modulesData, isLoading: modulesLoading } = useModules(
    undefined,
    undefined,
    draftId
  )
  const { data: bundlesData, isLoading: bundlesLoading } = useBundles(
    undefined,
    undefined,
    draftId
  )
  const { data: templatesData, isLoading: templatesLoading } = useTemplates(
    undefined,
    undefined,
    draftId
  )
  const { data: dashboardsData, isLoading: dashboardsLoading } = useDashboards(
    undefined,
    undefined,
    draftId
  )
  const { data: resourcesData, isLoading: resourcesLoading } = useResources(
    undefined,
    undefined,
    draftId
  )

  const { data: versionInfo } = useOntologyVersion()

  const categories = categoriesData?.items || []
  const properties = propertiesData?.items || []
  const subobjects = subobjectsData?.items || []
  const modules = modulesData?.items || []
  const bundles = bundlesData?.items || []
  const templates = templatesData?.items || []
  const dashboards = dashboardsData?.items || []
  const resources = resourcesData?.items || []

  // Handle entity creation form submission
  const handleCreateSubmit = async (data: Record<string, unknown>) => {
    if (!createModalEntityType) return

    try {
      // Transform data for resource entities
      // Backend expects: { id, category, ...dynamic_fields }
      // Form sends: { id, category_key, dynamic_fields: {...} }
      // Resource entity_key format: "{category}/{id}" (hierarchical path)
      let transformedData = data
      let entityKey = data.id as string

      if (createModalEntityType === 'resource') {
        const { category_key, dynamic_fields, ...rest } = data as {
          category_key?: string
          dynamic_fields?: Record<string, string>
          [key: string]: unknown
        }
        transformedData = {
          ...rest,
          category: category_key,
          ...(dynamic_fields || {}),
        }
        // Resource entity_key is "{category}/{id}"
        entityKey = `${category_key}/${data.id}`
      }

      await createEntity.mutateAsync({
        entityType: createModalEntityType,
        entityKey,
        data: transformedData,
      })
      closeCreateModal()
      // Select the newly created entity in the graph
      setSelectedEntity(entityKey, createModalEntityType)
    } catch (error) {
      // Error handling - form should show error via mutation state
      console.error('Failed to create entity:', error)
    }
  }

  // Generate modal title from entity type
  const getModalTitle = () => {
    if (!createModalEntityType) return ''
    return `Create ${createModalEntityType.charAt(0).toUpperCase() + createModalEntityType.slice(1)}`
  }

  // Handle cascading create from relationship fields
  // When user types a non-existent entity in a combobox and clicks "Create",
  // this opens a nested modal prefilled with the typed ID
  const handleCreateRelatedEntity = (
    targetEntityType: string,
    prefilledId: string,
    parentFieldName: string
  ) => {
    if (!createModalEntityType) return

    // Set callback to add created entity to parent form's selection
    // Note: The actual form state update is handled by the parent form's callback
    // which will be set by the form component itself

    openNestedCreateModal({
      entityType: targetEntityType as 'category' | 'property' | 'subobject' | 'template' | 'module' | 'bundle',
      prefilledId,
      parentContext: {
        entityType: createModalEntityType,
        fieldName: parentFieldName,
      },
    })
  }

  // Handle entity deletion with dependency checking
  const handleDelete = async (
    entityType: 'category' | 'property' | 'subobject' | 'template' | 'module' | 'bundle' | 'dashboard' | 'resource',
    entityKey: string,
    entityLabel: string
  ) => {
    // Check if entity has dependents
    const { canDelete: allowed, dependents } = canDelete(entityKey, graphNodes, graphEdges)

    if (!allowed) {
      // Show error with dependents list
      setDeleteBlocked({ key: entityKey, label: entityLabel, dependents })
      return
    }

    // Perform delete
    try {
      const result = await deleteEntity.mutateAsync({ entityType, entityKey })
      // Track the change for undo capability
      trackDeletedEntity(entityKey, result.id)
    } catch (error) {
      console.error('Failed to delete entity:', error)
    }
  }

  // Handle undo delete
  const handleUndoDelete = async (entityKey: string) => {
    console.log('handleUndoDelete called for:', entityKey)
    console.log('deletedEntityChanges:', deletedEntityChanges)
    console.log('draftChangesData:', draftChangesData)

    // Find the changeId for this entity
    const changeId = deletedEntityChanges.get(entityKey)
    console.log('changeId from map:', changeId)

    if (!changeId) {
      // Try to find from draft changes
      const change = draftChangesData?.changes.find(
        (c) => c.entity_key === entityKey && c.change_type === 'delete'
      )
      console.log('change from draftChangesData:', change)
      if (change) {
        try {
          console.log('Calling undoDelete with change.id:', change.id)
          await undoDelete.mutateAsync(change.id)
          untrackDeletedEntity(entityKey)
        } catch (error) {
          console.error('Failed to undo delete:', error)
        }
      } else {
        console.log('No change found for entity, cannot undo')
      }
      return
    }

    try {
      console.log('Calling undoDelete with changeId:', changeId)
      await undoDelete.mutateAsync(changeId)
      untrackDeletedEntity(entityKey)
    } catch (error) {
      console.error('Failed to undo delete:', error)
    }
  }

  return (
    <aside className="w-64 border-r bg-sidebar text-sidebar-foreground flex flex-col">
      <div className="p-4 border-b">
        <Link to="/" className="font-semibold text-lg hover:opacity-80">
          Ontology Hub
        </Link>
        {versionInfo && (
          <div className="text-xs text-muted-foreground mt-1">
            v {versionInfo.commit_sha.slice(0, 7)}
          </div>
        )}
        {draftToken && (
          <Badge variant="outline" className="text-xs mt-1">
            Draft Mode
          </Badge>
        )}
        {draftToken && affectedCount > 0 && (
          <div className="text-xs text-muted-foreground mt-1">
            <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900/30">
              {affectedCount} {affectedCount === 1 ? 'entity' : 'entities'} affected
            </Badge>
          </div>
        )}
      </div>

      <div className="p-2 border-b">
        <EntitySearch value={searchTerm} onChange={setSearchTerm} />
      </div>

      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {/* Delete blocked error display */}
        {deleteBlockedEntity && (
          <div className="mb-2">
            <DeleteConfirmation
              entityLabel={deleteBlockedEntity.label}
              dependents={deleteBlockedEntity.dependents}
              onClose={() => setDeleteBlocked(null)}
            />
          </div>
        )}

        {/* Schema group */}
        <div className="mb-2">
          <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Schema
          </div>
          <EntitySection
            title="Categories"
            icon={Boxes}
            entities={categories}
            isLoading={categoriesLoading}
            searchTerm={debouncedSearchTerm}
            entityType="category"
            isDraftMode={isDraftMode}
            onAddNew={() => openCreateModal('category')}
            onDelete={(key, label) => handleDelete('category', key, label)}
            onUndoDelete={handleUndoDelete}
            deletedEntityChanges={deletedEntityChanges}
          />
          <EntitySection
            title="Properties"
            icon={Tag}
            entities={properties}
            isLoading={propertiesLoading}
            searchTerm={debouncedSearchTerm}
            entityType="property"
            isDraftMode={isDraftMode}
            onAddNew={() => openCreateModal('property')}
            onDelete={(key, label) => handleDelete('property', key, label)}
            onUndoDelete={handleUndoDelete}
            deletedEntityChanges={deletedEntityChanges}
          />
          <EntitySection
            title="Subobjects"
            icon={Package}
            entities={subobjects}
            isLoading={subobjectsLoading}
            searchTerm={debouncedSearchTerm}
            entityType="subobject"
            isDraftMode={isDraftMode}
            onAddNew={() => openCreateModal('subobject')}
            onDelete={(key, label) => handleDelete('subobject', key, label)}
            onUndoDelete={handleUndoDelete}
            deletedEntityChanges={deletedEntityChanges}
          />
        </div>

        <div className="h-px bg-border my-2" />

        {/* Modules group */}
        <div className="mb-2">
          <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Modules
          </div>
          <EntitySection
            title="Modules"
            icon={Layers}
            entities={modules}
            isLoading={modulesLoading}
            searchTerm={debouncedSearchTerm}
            entityType="module"
            isDraftMode={isDraftMode}
            onAddNew={() => openCreateModal('module')}
            onDelete={(key, label) => handleDelete('module', key, label)}
            onUndoDelete={handleUndoDelete}
            deletedEntityChanges={deletedEntityChanges}
          />
          <EntitySection
            title="Bundles"
            icon={Archive}
            entities={bundles}
            isLoading={bundlesLoading}
            searchTerm={debouncedSearchTerm}
            entityType="bundle"
            isDraftMode={isDraftMode}
            onAddNew={() => openCreateModal('bundle')}
            onDelete={(key, label) => handleDelete('bundle', key, label)}
            onUndoDelete={handleUndoDelete}
            deletedEntityChanges={deletedEntityChanges}
          />
        </div>

        <div className="h-px bg-border my-2" />

        {/* Artifacts group */}
        <div className="mb-2">
          <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Artifacts
          </div>
          <EntitySection
            title="Dashboards"
            icon={LayoutDashboard}
            entities={dashboards}
            isLoading={dashboardsLoading}
            searchTerm={debouncedSearchTerm}
            entityType="dashboard"
            isDraftMode={isDraftMode}
            onAddNew={() => openCreateModal('dashboard')}
            onDelete={(key, label) => handleDelete('dashboard', key, label)}
            onUndoDelete={handleUndoDelete}
            deletedEntityChanges={deletedEntityChanges}
          />
          <EntitySection
            title="Resources"
            icon={FileText}
            entities={resources}
            isLoading={resourcesLoading}
            searchTerm={debouncedSearchTerm}
            entityType="resource"
            isDraftMode={isDraftMode}
            onAddNew={() => openCreateModal('resource')}
            onDelete={(key, label) => handleDelete('resource', key, label)}
            onUndoDelete={handleUndoDelete}
            deletedEntityChanges={deletedEntityChanges}
          />
          <EntitySection
            title="Templates"
            icon={FileCode}
            entities={templates}
            isLoading={templatesLoading}
            searchTerm={debouncedSearchTerm}
            entityType="template"
            isDraftMode={isDraftMode}
            onAddNew={() => openCreateModal('template')}
            onDelete={(key, label) => handleDelete('template', key, label)}
            onUndoDelete={handleUndoDelete}
            deletedEntityChanges={deletedEntityChanges}
          />
        </div>
      </nav>

      {/* Create Entity Modal */}
      <CreateEntityModal
        isOpen={createModalOpen}
        onClose={closeCreateModal}
        title={getModalTitle()}
      >
        {createModalEntityType === 'category' && (
          <CategoryForm
            onSubmit={handleCreateSubmit}
            onCancel={closeCreateModal}
            isSubmitting={createEntity.isPending}
            draftId={draftId}
            onCreateRelatedEntity={(type, id) =>
              handleCreateRelatedEntity(type, id, 'Parent Categories')
            }
            setOnNestedEntityCreated={setOnNestedEntityCreated}
          />
        )}
        {createModalEntityType === 'property' && (
          <PropertyForm
            onSubmit={handleCreateSubmit}
            onCancel={closeCreateModal}
            isSubmitting={createEntity.isPending}
          />
        )}
        {createModalEntityType === 'subobject' && (
          <SubobjectForm
            onSubmit={handleCreateSubmit}
            onCancel={closeCreateModal}
            isSubmitting={createEntity.isPending}
          />
        )}
        {createModalEntityType === 'template' && (
          <TemplateForm
            onSubmit={handleCreateSubmit}
            onCancel={closeCreateModal}
            isSubmitting={createEntity.isPending}
          />
        )}
        {createModalEntityType === 'module' && (
          <ModuleForm
            onSubmit={handleCreateSubmit}
            onCancel={closeCreateModal}
            isSubmitting={createEntity.isPending}
            draftId={draftId}
            onCreateRelatedEntity={handleCreateRelatedEntity}
            setOnNestedEntityCreated={setOnNestedEntityCreated}
          />
        )}
        {createModalEntityType === 'bundle' && (
          <BundleForm
            onSubmit={handleCreateSubmit}
            onCancel={closeCreateModal}
            isSubmitting={createEntity.isPending}
            draftId={draftId}
            onCreateRelatedEntity={(type, id) =>
              handleCreateRelatedEntity(type, id, 'Modules')
            }
            setOnNestedEntityCreated={setOnNestedEntityCreated}
          />
        )}
        {createModalEntityType === 'dashboard' && (
          <DashboardForm
            onSubmit={handleCreateSubmit}
            onCancel={closeCreateModal}
            isSubmitting={createEntity.isPending}
            draftId={draftId}
          />
        )}
        {createModalEntityType === 'resource' && (
          <ResourceForm
            onSubmit={handleCreateSubmit}
            onCancel={closeCreateModal}
            isSubmitting={createEntity.isPending}
            draftId={draftId}
          />
        )}
      </CreateEntityModal>

      {/* Nested Create Modal for cascading entity creation */}
      {draftToken && <NestedModalStack draftToken={draftToken} draftId={draftId} />}
    </aside>
  )
}
