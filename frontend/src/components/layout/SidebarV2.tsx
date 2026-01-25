import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronRight, Boxes, Tag, Package, Layers, Archive, FileCode, Plus } from 'lucide-react'
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
  useOntologyVersion,
} from '@/api/entitiesV2'
import { useDraftV2 } from '@/api/draftApiV2'
import { useGraphStore } from '@/stores/graphStore'
import { useDraftStoreV2 } from '@/stores/draftStoreV2'
import { getAffectedEntityCount } from '@/lib/dependencyGraph'
import { cn } from '@/lib/utils'
import type { EntityWithStatus } from '@/api/types'

interface EntitySectionProps {
  title: string
  icon: React.ComponentType<{ className?: string }>
  entities: EntityWithStatus[]
  isLoading: boolean
  searchTerm: string
  entityType: string
  isDraftMode: boolean
  onAddNew?: () => void
}

function EntitySection({ title, icon: Icon, entities, isLoading, searchTerm, entityType, isDraftMode, onAddNew }: EntitySectionProps) {
  const setSelectedEntity = useGraphStore((state) => state.setSelectedEntity)
  const directEdits = useDraftStoreV2((s) => s.directlyEditedEntities)
  const transitiveAffects = useDraftStoreV2((s) => s.transitivelyAffectedEntities)
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
            const isDeleted = entity.change_status === 'deleted' || entity.deleted
            const isDirectEdit = directEdits.has(entity.entity_key)
            const isTransitiveEffect = transitiveAffects.has(entity.entity_key)
            return (
              <li key={entity.entity_key}>
                <button
                  onClick={() => setSelectedEntity(entity.entity_key, entityType)}
                  className={cn(
                    'flex items-center gap-2 w-full px-2 py-1 text-sm rounded hover:bg-sidebar-accent truncate text-left',
                    isDirectEdit && 'bg-blue-100 dark:bg-blue-900/30',
                    // Only show transitive if NOT direct edit (direct wins)
                    !isDirectEdit && isTransitiveEffect && 'bg-blue-50 dark:bg-blue-900/10',
                    isDeleted && 'line-through text-muted-foreground'
                  )}
                  title={entity.label}
                >
                  <span className="flex-1 truncate">{entity.label}</span>
                  {entity.change_status && entity.change_status !== 'unchanged' && (
                    <Badge
                      variant={
                        entity.change_status === 'added'
                          ? 'default'
                          : entity.change_status === 'modified'
                          ? 'secondary'
                          : 'destructive'
                      }
                      className={`ml-auto ${
                        entity.change_status === 'added'
                          ? 'bg-green-500 hover:bg-green-600'
                          : entity.change_status === 'modified'
                          ? 'bg-yellow-500 hover:bg-yellow-600'
                          : ''
                      }`}
                    >
                      {entity.change_status === 'added'
                        ? '+'
                        : entity.change_status === 'modified'
                        ? '~'
                        : '-'}
                    </Badge>
                  )}
                </button>
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

export function SidebarV2() {
  const [searchParams] = useSearchParams()
  const draftToken = searchParams.get('draft_token') || undefined
  const draftV2 = useDraftV2(draftToken)

  // Derive draftId from fetched draft (v2 workflow) or fall back to URL param (v1 workflow)
  const draftId = draftV2.data?.id?.toString() || searchParams.get('draft_id') || undefined

  // Draft mode state - determines if "+ New" buttons are visible
  const isDraftMode = !!draftToken

  // Create modal actions
  const openCreateModal = useDraftStoreV2((s) => s.openCreateModal)

  // Change tracking state for badge display
  const directEdits = useDraftStoreV2((s) => s.directlyEditedEntities)
  const transitiveAffects = useDraftStoreV2((s) => s.transitivelyAffectedEntities)
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

  const { data: versionInfo } = useOntologyVersion()

  const categories = categoriesData?.items || []
  const properties = propertiesData?.items || []
  const subobjects = subobjectsData?.items || []
  const modules = modulesData?.items || []
  const bundles = bundlesData?.items || []
  const templates = templatesData?.items || []

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
          />
        </div>

        <div className="h-px bg-border my-2" />

        {/* Templates section */}
        <div>
          <EntitySection
            title="Templates"
            icon={FileCode}
            entities={templates}
            isLoading={templatesLoading}
            searchTerm={debouncedSearchTerm}
            entityType="template"
            isDraftMode={isDraftMode}
            onAddNew={() => openCreateModal('template')}
          />
        </div>
      </nav>
    </aside>
  )
}
