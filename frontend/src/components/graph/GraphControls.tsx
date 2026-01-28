import { useState } from 'react'
import { useGraphStore, type LayoutAlgorithm, type LayoutDirection } from '@/stores/graphStore'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { RotateCw, ChevronDown, ChevronRight, Settings2 } from 'lucide-react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

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
  const layoutAlgorithm = useGraphStore((s) => s.layoutAlgorithm)
  const layoutDirection = useGraphStore((s) => s.layoutDirection)
  const setLayoutAlgorithm = useGraphStore((s) => s.setLayoutAlgorithm)
  const setLayoutDirection = useGraphStore((s) => s.setLayoutDirection)

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
          <div className="px-3 pb-3 pt-1 border-t space-y-3">
            {/* Layout controls row */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">Layout:</span>
                <Select
                  value={layoutAlgorithm}
                  onValueChange={(value) => setLayoutAlgorithm(value as LayoutAlgorithm)}
                >
                  <SelectTrigger className="h-7 w-[140px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hybrid" className="text-xs">Hierarchy + Flow</SelectItem>
                    <SelectItem value="dagre" className="text-xs">Strict Hierarchy</SelectItem>
                    <SelectItem value="force" className="text-xs">Force-Directed</SelectItem>
                    <SelectItem value="radial" className="text-xs">Radial (Outward)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Hide direction selector for radial layout (it has no direction) */}
              {layoutAlgorithm !== 'radial' && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Direction:</span>
                  <Select
                    value={layoutDirection}
                    onValueChange={(value) => setLayoutDirection(value as LayoutDirection)}
                  >
                    <SelectTrigger className="h-7 w-[100px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TB" className="text-xs">Top-Down</SelectItem>
                      <SelectItem value="LR" className="text-xs">Left-Right</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

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

            {/* Edge type filters row */}
            <div className="flex flex-wrap items-center gap-4">
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
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <Checkbox
                    id="edge-subobject-property"
                    checked={edgeTypeFilter.has('subobject_property')}
                    onCheckedChange={(checked) =>
                      handleEdgeTypeToggle('subobject_property', checked as boolean)
                    }
                    className="h-3.5 w-3.5"
                  />
                  <span className="text-xs">Subobject Props</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <Checkbox
                    id="edge-module-dashboard"
                    checked={edgeTypeFilter.has('module_dashboard')}
                    onCheckedChange={(checked) =>
                      handleEdgeTypeToggle('module_dashboard', checked as boolean)
                    }
                    className="h-3.5 w-3.5"
                  />
                  <span className="text-xs">Dashboards</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <Checkbox
                    id="edge-category-resource"
                    checked={edgeTypeFilter.has('category_resource')}
                    onCheckedChange={(checked) =>
                      handleEdgeTypeToggle('category_resource', checked as boolean)
                    }
                    className="h-3.5 w-3.5"
                  />
                  <span className="text-xs">Resources</span>
                </label>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}
