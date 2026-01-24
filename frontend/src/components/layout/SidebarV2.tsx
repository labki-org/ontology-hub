import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronRight, Boxes, Tag, Package, Layers, Archive, FileCode } from 'lucide-react'
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
import { useGraphStore } from '@/stores/graphStore'
import type { EntityWithStatus } from '@/api/types'

interface EntitySectionProps {
  title: string
  icon: React.ComponentType<{ className?: string }>
  entities: EntityWithStatus[]
  isLoading: boolean
  searchTerm: string
}

function EntitySection({ title, icon: Icon, entities, isLoading, searchTerm }: EntitySectionProps) {
  const setSelectedEntity = useGraphStore((state) => state.setSelectedEntity)
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
      <CollapsibleTrigger className="flex items-center w-full px-2 py-1.5 rounded hover:bg-sidebar-accent text-sm group">
        <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]:rotate-90" />
        <Icon className="h-4 w-4 ml-1 mr-2" />
        <span className="font-medium">{title}</span>
        <Badge variant="secondary" className="ml-auto">
          {filteredEntities.length}
        </Badge>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="ml-7 space-y-0.5">
          {filteredEntities.map((entity) => {
            const isDeleted = entity.change_status === 'deleted' || entity.deleted
            return (
              <li key={entity.entity_key}>
                <button
                  onClick={() => setSelectedEntity(entity.entity_key)}
                  className={`flex items-center gap-2 w-full px-2 py-1 text-sm rounded hover:bg-sidebar-accent truncate text-left ${
                    isDeleted ? 'line-through text-muted-foreground' : ''
                  }`}
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
  const draftId = searchParams.get('draft_id') || undefined
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
          />
          <EntitySection
            title="Properties"
            icon={Tag}
            entities={properties}
            isLoading={propertiesLoading}
            searchTerm={debouncedSearchTerm}
          />
          <EntitySection
            title="Subobjects"
            icon={Package}
            entities={subobjects}
            isLoading={subobjectsLoading}
            searchTerm={debouncedSearchTerm}
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
          />
          <EntitySection
            title="Bundles"
            icon={Archive}
            entities={bundles}
            isLoading={bundlesLoading}
            searchTerm={debouncedSearchTerm}
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
          />
        </div>
      </nav>
    </aside>
  )
}
