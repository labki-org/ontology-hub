import { useMemo, useState } from 'react'
import { useHullStore } from '@/stores/hullStore'
import { getModuleColor } from './HullLayer'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ChevronDown, ChevronRight, Layers } from 'lucide-react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'

interface ModuleHullControlsProps {
  modules: string[]
}

/**
 * Compact, collapsible control for toggling module hull visibility.
 */
export function ModuleHullControls({ modules }: ModuleHullControlsProps) {
  const [isOpen, setIsOpen] = useState(false)
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
    return null
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg border">
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-2 px-3 py-2 w-full hover:bg-muted/50 rounded-lg transition-colors">
            <Layers className="h-4 w-4" />
            <span className="text-sm font-medium">Module Hulls</span>
            <span className="text-xs text-muted-foreground ml-1">
              ({modules.length})
            </span>
            {isOpen ? (
              <ChevronDown className="h-4 w-4 ml-auto" />
            ) : (
              <ChevronRight className="h-4 w-4 ml-auto" />
            )}
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-3 pb-3 pt-1 border-t">
            {/* Show/Hide all buttons */}
            <div className="flex gap-2 mb-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleShowAll}
                disabled={allVisible}
                className="flex-1 h-6 text-xs"
              >
                Show All
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleHideAll}
                disabled={noneVisible}
                className="flex-1 h-6 text-xs"
              >
                Hide All
              </Button>
            </div>

            {/* Module list */}
            <ScrollArea className="max-h-32">
              <div className="space-y-1">
                {sortedModules.map((moduleId) => {
                  const color = getModuleColor(moduleId)
                  const isChecked =
                    visibleModules.size === 0 || visibleModules.has(moduleId)

                  return (
                    <label
                      key={moduleId}
                      className="flex items-center gap-2 py-0.5 cursor-pointer"
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => toggleModule(moduleId)}
                        className="h-3.5 w-3.5"
                      />
                      <div
                        className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                        style={{
                          backgroundColor: color,
                          opacity: 0.7,
                        }}
                      />
                      <span className="text-xs truncate">{moduleId}</span>
                    </label>
                  )
                })}
              </div>
            </ScrollArea>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}
