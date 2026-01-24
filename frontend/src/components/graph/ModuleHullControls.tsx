import { useMemo } from 'react'
import { useHullStore } from '@/stores/hullStore'
import { getModuleColor } from './HullLayer'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'

interface ModuleHullControlsProps {
  modules: string[]
}

/**
 * Control panel for toggling module hull visibility.
 *
 * Features:
 * - Checkbox list of all modules in graph
 * - Color swatch matching hull color
 * - Show All / Hide All buttons
 * - Scrollable for graphs with many modules
 *
 * Positioned in graph controls area.
 */
export function ModuleHullControls({ modules }: ModuleHullControlsProps) {
  const visibleModules = useHullStore((s) => s.visibleModules)
  const toggleModule = useHullStore((s) => s.toggleModule)
  const showAll = useHullStore((s) => s.showAll)
  const hideAll = useHullStore((s) => s.hideAll)

  // Sort modules alphabetically for consistent display
  const sortedModules = useMemo(() => {
    return [...modules].sort()
  }, [modules])

  const allVisible = visibleModules.size === 0 || visibleModules.size === modules.length
  const noneVisible = visibleModules.size === 0 && modules.length > 0

  const handleShowAll = () => {
    showAll(modules)
  }

  const handleHideAll = () => {
    hideAll()
  }

  if (modules.length === 0) {
    return (
      <Card className="w-64">
        <CardHeader>
          <CardTitle className="text-sm">Module Hulls</CardTitle>
          <CardDescription className="text-xs">
            No modules in current graph
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className="w-64">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Module Hulls</CardTitle>
        <CardDescription className="text-xs">
          Toggle module boundary overlays
        </CardDescription>
        <div className="flex gap-2 pt-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleShowAll}
            disabled={allVisible}
            className="flex-1 h-7 text-xs"
          >
            Show All
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleHideAll}
            disabled={noneVisible}
            className="flex-1 h-7 text-xs"
          >
            Hide All
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-48">
          <div className="space-y-2">
            {sortedModules.map((moduleId) => {
              const color = getModuleColor(moduleId)
              const isChecked =
                visibleModules.size === 0 || visibleModules.has(moduleId)

              return (
                <div
                  key={moduleId}
                  className="flex items-center gap-2 py-1"
                >
                  <Checkbox
                    id={`hull-${moduleId}`}
                    checked={isChecked}
                    onCheckedChange={() => toggleModule(moduleId)}
                  />
                  <div
                    className="w-3 h-3 rounded-sm border border-gray-300 flex-shrink-0"
                    style={{
                      backgroundColor: color,
                      opacity: 0.6,
                    }}
                  />
                  <label
                    htmlFor={`hull-${moduleId}`}
                    className="text-sm cursor-pointer select-none flex-1"
                  >
                    {moduleId}
                  </label>
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
