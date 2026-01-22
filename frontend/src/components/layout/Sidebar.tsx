import { Link } from 'react-router-dom'
import { ChevronRight, Boxes, Tag, Package } from 'lucide-react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useAllEntitiesByType } from '@/api/entities'

const entityTypeConfig = {
  category: { label: 'Categories', icon: Boxes },
  property: { label: 'Properties', icon: Tag },
  subobject: { label: 'Subobjects', icon: Package },
} as const

export function Sidebar() {
  const { data, isLoading, error } = useAllEntitiesByType()

  return (
    <aside className="w-64 border-r bg-sidebar text-sidebar-foreground flex flex-col">
      <div className="p-4 border-b">
        <Link to="/" className="font-semibold text-lg hover:opacity-80">
          Ontology Hub
        </Link>
      </div>

      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {isLoading && (
          <div className="space-y-2 p-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        )}

        {error && (
          <div className="p-2 text-sm text-destructive">
            Failed to load entities
          </div>
        )}

        {data && (
          <>
            {(['category', 'property', 'subobject'] as const).map((type) => {
              const config = entityTypeConfig[type]
              const entities = data[type] || []
              const Icon = config.icon

              return (
                <Collapsible key={type} defaultOpen>
                  <CollapsibleTrigger className="flex items-center w-full px-2 py-1.5 rounded hover:bg-sidebar-accent text-sm group">
                    <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]:rotate-90" />
                    <Icon className="h-4 w-4 ml-1 mr-2" />
                    <span className="font-medium">{config.label}</span>
                    <Badge variant="secondary" className="ml-auto">
                      {entities.length}
                    </Badge>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <ul className="ml-7 space-y-0.5">
                      {entities.map((entity) => (
                        <li key={entity.entity_id}>
                          <Link
                            to={`/${type}/${entity.entity_id}`}
                            className="block px-2 py-1 text-sm rounded hover:bg-sidebar-accent truncate"
                            title={entity.label}
                          >
                            {entity.label}
                          </Link>
                        </li>
                      ))}
                      {entities.length === 0 && (
                        <li className="px-2 py-1 text-sm text-muted-foreground italic">
                          No {config.label.toLowerCase()} found
                        </li>
                      )}
                    </ul>
                  </CollapsibleContent>
                </Collapsible>
              )
            })}
          </>
        )}
      </nav>
    </aside>
  )
}
