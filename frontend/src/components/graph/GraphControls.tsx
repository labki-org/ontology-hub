import { useGraphStore } from '@/stores/graphStore'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { RotateCw, Minus, Plus } from 'lucide-react'

interface GraphControlsProps {
  onResetLayout: () => void
  isSimulating?: boolean
}

/**
 * Control panel overlay for graph visualization.
 *
 * Features:
 * - Depth control (1-3) with +/- buttons
 * - Edge type filter checkboxes (inheritance, properties, subobjects)
 * - Reset Layout button to restart force simulation
 */
export function GraphControls({ onResetLayout, isSimulating }: GraphControlsProps) {
  const depth = useGraphStore((s) => s.depth)
  const setDepth = useGraphStore((s) => s.setDepth)
  const edgeTypeFilter = useGraphStore((s) => s.edgeTypeFilter)
  const setEdgeTypeFilter = useGraphStore((s) => s.setEdgeTypeFilter)

  const handleDepthChange = (delta: number) => {
    setDepth(depth + delta)
  }

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
    <div className="absolute top-4 right-4 z-10 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg border p-4 min-w-[200px]">
      <div className="space-y-4">
        {/* Depth control */}
        <div>
          <Label className="text-sm font-semibold mb-2 block">Depth</Label>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => handleDepthChange(-1)}
              disabled={depth <= 1}
            >
              <Minus className="h-3 w-3" />
            </Button>
            <span className="text-sm font-medium w-8 text-center">{depth}</span>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => handleDepthChange(1)}
              disabled={depth >= 3}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Edge type filters */}
        <div>
          <Label className="text-sm font-semibold mb-2 block">Edge Types</Label>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="edge-parent"
                checked={edgeTypeFilter.has('parent')}
                onCheckedChange={(checked) =>
                  handleEdgeTypeToggle('parent', checked as boolean)
                }
              />
              <label
                htmlFor="edge-parent"
                className="text-sm cursor-pointer select-none"
              >
                Inheritance
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="edge-property"
                checked={edgeTypeFilter.has('property')}
                onCheckedChange={(checked) =>
                  handleEdgeTypeToggle('property', checked as boolean)
                }
              />
              <label
                htmlFor="edge-property"
                className="text-sm cursor-pointer select-none"
              >
                Properties
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="edge-subobject"
                checked={edgeTypeFilter.has('subobject')}
                onCheckedChange={(checked) =>
                  handleEdgeTypeToggle('subobject', checked as boolean)
                }
              />
              <label
                htmlFor="edge-subobject"
                className="text-sm cursor-pointer select-none"
              >
                Subobjects
              </label>
            </div>
          </div>
        </div>

        {/* Reset layout button */}
        <div>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={onResetLayout}
            disabled={isSimulating}
          >
            <RotateCw className="h-3 w-3 mr-2" />
            Reset Layout
          </Button>
        </div>
      </div>
    </div>
  )
}
