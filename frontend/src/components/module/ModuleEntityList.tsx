import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronRight, Boxes, Tag, Package } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { OverlapIndicator } from '@/components/module/OverlapIndicator'
import type { EntityPublic, EntityType } from '@/api/types'

interface EntitySectionProps {
  title: string
  entityType: EntityType
  entities: EntityPublic[]
  icon: React.ReactNode
  defaultOpen?: boolean
  overlaps?: Record<string, string[]>
}

function EntitySection({ title, entityType, entities, icon, defaultOpen = true, overlaps }: EntitySectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const count = entities.length

  if (count === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <Button
          variant="ghost"
          className="flex items-center justify-between w-full p-0 h-auto font-normal hover:bg-transparent"
          onClick={() => setIsOpen(!isOpen)}
        >
          <div className="flex items-center gap-2">
            {icon}
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Badge variant="secondary" className="text-xs">
              {count}
            </Badge>
          </div>
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>
      </CardHeader>
      {isOpen && (
        <CardContent className="pt-0">
          <div className="grid gap-1">
            {entities.map((entity) => {
              const entityOverlaps = overlaps?.[entity.entity_id] || []
              return (
                <Link
                  key={entity.entity_id}
                  to={`/${entityType}/${entity.entity_id}`}
                  className="flex items-center justify-between p-2 rounded hover:bg-accent text-sm"
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{entity.label}</span>
                    <span className="text-xs text-muted-foreground font-mono">
                      {entity.entity_id}
                    </span>
                  </div>
                  {entityOverlaps.length > 0 && (
                    <OverlapIndicator otherModuleIds={entityOverlaps} />
                  )}
                </Link>
              )
            })}
          </div>
        </CardContent>
      )}
    </Card>
  )
}

interface ModuleEntityListProps {
  categories: EntityPublic[]
  properties: EntityPublic[]
  subobjects: EntityPublic[]
  overlaps?: Record<string, string[]>
}

/**
 * Displays module entities grouped by type with collapsible sections.
 * Optionally shows overlap indicators for entities that appear in other modules.
 */
export function ModuleEntityList({ categories, properties, subobjects, overlaps }: ModuleEntityListProps) {
  const totalCount = categories.length + properties.length + subobjects.length

  if (totalCount === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          This module contains no entities.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <EntitySection
        title="Categories"
        entityType="category"
        entities={categories}
        icon={<Boxes className="h-4 w-4 text-muted-foreground" />}
        overlaps={overlaps}
      />
      <EntitySection
        title="Properties"
        entityType="property"
        entities={properties}
        icon={<Tag className="h-4 w-4 text-muted-foreground" />}
        defaultOpen={categories.length === 0}
        overlaps={overlaps}
      />
      <EntitySection
        title="Subobjects"
        entityType="subobject"
        entities={subobjects}
        icon={<Package className="h-4 w-4 text-muted-foreground" />}
        defaultOpen={categories.length === 0 && properties.length === 0}
        overlaps={overlaps}
      />
    </div>
  )
}
