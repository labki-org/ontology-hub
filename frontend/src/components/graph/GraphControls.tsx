import { useState } from 'react'
import { useGraphStore } from '@/stores/graphStore'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { RotateCw, ChevronDown, ChevronRight, Settings2 } from 'lucide-react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'

interface GraphControlsProps {
  onResetLayout: () => void
  isSimulating?: boolean
}

/**
 * Compact, collapsible control bar for graph visualization.
 * Displays horizontally at the top of the graph.
 */
export function GraphControls({ onResetLayout, isSimulating }: GraphControlsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const edgeTypeFilter = useGraphStore((s) => s.edgeTypeFilter)
  const setEdgeTypeFilter = useGraphStore((s) => s.setEdgeTypeFilter)

  const handleEdgeTypeToggle = (edgeType: string, checked: boolean) => {
    const newFilter = new Set(edgeTypeFilter)
    if (checked) {
      newFilter.add(edgeType)
    } else {
      newFilter.delete(edgeType)
    }
    setEdgeTypeFilter(Array.from(newFilter))
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg border">
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-2 px-3 py-2 w-full hover:bg-muted/50 rounded-lg transition-colors">
            <Settings2 className="h-4 w-4" />
            <span className="text-sm font-medium">Graph Settings</span>
            {isOpen ? (
              <ChevronDown className="h-4 w-4 ml-auto" />
            ) : (
              <ChevronRight className="h-4 w-4 ml-auto" />
            )}
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-3 pb-3 pt-1 border-t">
            <div className="flex flex-wrap items-center gap-4">
              {/* Edge type filters - inline */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-muted-foreground">Edges:</span>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <Checkbox
                    id="edge-parent"
                    checked={edgeTypeFilter.has('parent')}
                    onCheckedChange={(checked) =>
                      handleEdgeTypeToggle('parent', checked as boolean)
                    }
                    className="h-3.5 w-3.5"
                  />
                  <span className="text-xs">Inheritance</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <Checkbox
                    id="edge-property"
                    checked={edgeTypeFilter.has('property')}
                    onCheckedChange={(checked) =>
                      handleEdgeTypeToggle('property', checked as boolean)
                    }
                    className="h-3.5 w-3.5"
                  />
                  <span className="text-xs">Properties</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <Checkbox
                    id="edge-subobject"
                    checked={edgeTypeFilter.has('subobject')}
                    onCheckedChange={(checked) =>
                      handleEdgeTypeToggle('subobject', checked as boolean)
                    }
                    className="h-3.5 w-3.5"
                  />
                  <span className="text-xs">Subobjects</span>
                </label>
              </div>

              <div className="h-4 w-px bg-border" />

              {/* Reset layout button */}
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={onResetLayout}
                disabled={isSimulating}
              >
                <RotateCw className="h-3 w-3 mr-1" />
                Reset
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}
