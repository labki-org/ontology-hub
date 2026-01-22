import { Link } from 'react-router-dom'
import { Boxes, Tag, Package } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import type { EntityPublic, EntityType } from '@/api/types'

interface SearchResultsProps {
  /** Search results to display */
  items: EntityPublic[]
  /** The search query (for empty state message) */
  query: string
}

const typeConfig: Record<EntityType, { label: string; icon: typeof Boxes; variant: 'default' | 'secondary' | 'outline' }> = {
  category: { label: 'Category', icon: Boxes, variant: 'default' },
  property: { label: 'Property', icon: Tag, variant: 'secondary' },
  subobject: { label: 'Subobject', icon: Package, variant: 'outline' },
}

/**
 * Display search results as a list with entity type badges.
 * Links to entity detail pages.
 */
export function SearchResults({ items, query }: SearchResultsProps) {
  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-center">
            No results found for "{query}"
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <ul className="space-y-2">
      {items.map((entity) => {
        const config = typeConfig[entity.entity_type]
        const Icon = config.icon

        return (
          <li key={`${entity.entity_type}-${entity.entity_id}`}>
            <Link
              to={`/${entity.entity_type}/${entity.entity_id}`}
              className="block p-4 rounded-lg border bg-card hover:bg-accent transition-colors"
            >
              <div className="flex items-start gap-3">
                <Icon className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium truncate">{entity.label}</span>
                    <Badge variant={config.variant} className="shrink-0">
                      {config.label}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {entity.entity_id}
                  </p>
                  {entity.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {entity.description}
                    </p>
                  )}
                </div>
              </div>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
