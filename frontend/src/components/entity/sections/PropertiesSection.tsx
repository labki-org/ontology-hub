import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useGraphStore } from '@/stores/graphStore'
import { AccordionSection } from './AccordionSection'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { ChevronDown, X } from 'lucide-react'
import type { PropertyProvenance } from '@/api/types'

interface PropertiesSectionProps {
  properties: PropertyProvenance[]
  isEditing: boolean
  onRemoveProperty?: (propertyKey: string) => void
}

/**
 * Properties section showing direct and inherited properties.
 * Per CONTEXT.md: inherited properties grouped by parent with provenance.
 */
export function PropertiesSection({
  properties,
  isEditing,
  onRemoveProperty,
}: PropertiesSectionProps) {
  const setSelectedEntity = useGraphStore((s) => s.setSelectedEntity)

  // Separate direct and inherited
  const directProperties = properties.filter((p) => p.is_direct)
  const inheritedProperties = properties.filter((p) => p.is_inherited && !p.is_direct)

  // Group inherited by source category
  const groupedInherited = inheritedProperties.reduce(
    (acc, prop) => {
      const source = prop.source_category
      if (!acc[source]) acc[source] = []
      acc[source].push(prop)
      return acc
    },
    {} as Record<string, PropertyProvenance[]>
  )

  const renderProperty = (prop: PropertyProvenance) => (
    <div
      key={prop.entity_key}
      className="flex items-center justify-between p-2 rounded hover:bg-muted/50"
    >
      <div className="flex items-center gap-2">
        <button
          onClick={() => setSelectedEntity(prop.entity_key, 'property')}
          className="font-medium text-sm text-primary hover:underline"
        >
          {prop.label}
        </button>
        {prop.is_required && (
          <Badge variant="outline" className="text-xs">
            Required
          </Badge>
        )}
      </div>
      {isEditing && prop.is_direct && onRemoveProperty && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => onRemoveProperty(prop.entity_key)}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  )

  return (
    <AccordionSection
      id="properties"
      title="Properties"
      count={properties.length}
    >
      <div className="space-y-6">
        {/* Direct Properties */}
        <div>
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
            Direct Properties
            <Badge variant="default" className="bg-blue-500 text-xs">
              {directProperties.length}
            </Badge>
          </h4>
          {directProperties.length > 0 ? (
            <div className="space-y-1 border rounded-md p-2">
              {directProperties.map(renderProperty)}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              No direct properties
            </p>
          )}
        </div>

        {/* Inherited Properties - grouped by source */}
        {Object.keys(groupedInherited).length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
              Inherited Properties
              <Badge variant="secondary" className="text-xs">
                {inheritedProperties.length}
              </Badge>
            </h4>
            <div className="space-y-2">
              {Object.entries(groupedInherited).map(([sourceCategory, props]) => (
                <Collapsible key={sourceCategory} defaultOpen>
                  <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 rounded hover:bg-muted/50 text-left">
                    <ChevronDown className="h-4 w-4 transition-transform duration-200 [&[data-state=open]]:rotate-180" />
                    <span className="text-sm">
                      From{' '}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedEntity(sourceCategory, 'category')
                        }}
                        className="text-primary hover:underline font-medium"
                      >
                        {sourceCategory}
                      </button>
                    </span>
                    <Badge variant="outline" className="text-xs ml-auto">
                      {props.length}
                    </Badge>
                    {props[0]?.inheritance_depth > 0 && (
                      <span className="text-xs text-muted-foreground">
                        (depth: {props[0].inheritance_depth})
                      </span>
                    )}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pl-6 border-l ml-2">
                    {props.map(renderProperty)}
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          </div>
        )}
      </div>
    </AccordionSection>
  )
}
