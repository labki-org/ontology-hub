import { useState, useRef, useEffect } from 'react'
import { X, Link2, ChevronDown, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DependencyFeedback } from './DependencyFeedback'
import { useModules } from '@/api/modules'
import { useDraftStore } from '@/stores/draftStore'
import { cn } from '@/lib/utils'
import type { ModuleAssignmentState } from '@/api/types'

/**
 * Build a map of category ID -> assigned module IDs from the moduleAssignments state
 */
function buildCategoryAssignmentsMap(
  moduleAssignments: Map<string, ModuleAssignmentState>
): Map<string, string[]> {
  const result = new Map<string, string[]>()
  for (const [entityId, state] of moduleAssignments) {
    result.set(entityId, [...state.explicit, ...state.autoIncluded])
  }
  return result
}

interface EntitySchema {
  parent?: string
  properties?: string[]
  subobjects?: string[]
}

interface ModuleAssignmentProps {
  entityId: string
  entityType: 'category' | 'property' | 'subobject'
  parentCategories?: string[]
  entitySchema?: EntitySchema
}

export function ModuleAssignment({
  entityId,
  entityType,
  parentCategories,
  entitySchema,
}: ModuleAssignmentProps) {
  const { data: modules, isLoading } = useModules()
  const {
    moduleAssignments,
    assignToModule,
    removeFromModule,
    getEffectiveModules,
  } = useDraftStore()

  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false)
      }
    }

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isDropdownOpen])

  if (isLoading || !modules) {
    return <div className="text-sm text-muted-foreground">Loading modules...</div>
  }

  // For properties/subobjects, show inherited modules
  if (entityType !== 'category') {
    const inherited = getEffectiveModules(entityId, entityType, parentCategories)
    const inheritedModules = modules.filter((m) => inherited.includes(m.module_id))

    if (inheritedModules.length === 0) {
      return (
        <div className="text-sm text-muted-foreground italic">
          Assign parent category to modules first
        </div>
      )
    }

    return (
      <div className="space-y-1">
        <div className="text-xs text-muted-foreground">
          Module membership inherited from categories
        </div>
        <div className="flex flex-wrap gap-1">
          {inheritedModules.map((mod) => (
            <Badge
              key={mod.module_id}
              variant="secondary"
              className="text-muted-foreground italic gap-1"
            >
              <Link2 className="h-3 w-3" />
              {mod.label}
            </Badge>
          ))}
        </div>
      </div>
    )
  }

  // For categories, show full assignment UI
  const assignments = moduleAssignments.get(entityId) || {
    explicit: [],
    autoIncluded: [],
  }

  const explicitModules = modules.filter((m) =>
    assignments.explicit.includes(m.module_id)
  )
  const autoIncludedModules = modules.filter((m) =>
    assignments.autoIncluded.includes(m.module_id)
  )

  // Available modules (not yet assigned)
  const availableModules = modules.filter(
    (m) =>
      !assignments.explicit.includes(m.module_id) &&
      !assignments.autoIncluded.includes(m.module_id)
  )

  const handleRemove = (moduleId: string) => {
    // Check if any other assigned modules depend on this one
    const dependentChildren = assignments.explicit.filter((id) => {
      const mod = modules.find((m) => m.module_id === id)
      return mod?.dependencies.includes(moduleId)
    })

    removeFromModule(entityId, moduleId, dependentChildren)
  }

  const handleSelect = (moduleId: string) => {
    assignToModule(entityId, moduleId)
    setIsDropdownOpen(false)
  }

  return (
    <div className="space-y-2">
      {/* Assigned modules display */}
      <div className="flex flex-wrap gap-1 items-center">
        {explicitModules.map((mod) => (
          <Badge
            key={mod.module_id}
            variant="secondary"
            className="gap-1 pr-1"
          >
            {mod.label}
            <button
              onClick={() => handleRemove(mod.module_id)}
              className="ml-1 hover:bg-muted rounded-full p-0.5"
              title="Remove from module"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}

        {autoIncludedModules.map((mod) => (
          <Badge
            key={mod.module_id}
            variant="outline"
            className="text-muted-foreground italic gap-1"
            title="Auto-included via dependency"
          >
            <Link2 className="h-3 w-3" />
            {mod.label}
            <span className="text-xs">(via dependency)</span>
          </Badge>
        ))}

        {/* Add module dropdown */}
        <div className="relative" ref={dropdownRef}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="h-7 gap-1"
            disabled={availableModules.length === 0}
          >
            <Plus className="h-3 w-3" />
            Add Module
            <ChevronDown
              className={cn(
                'h-3 w-3 transition-transform',
                isDropdownOpen && 'rotate-180'
              )}
            />
          </Button>

          {isDropdownOpen && availableModules.length > 0 && (
            <Card className="absolute top-full left-0 mt-1 z-50 w-64 p-1 shadow-lg">
              <div className="max-h-48 overflow-y-auto">
                {availableModules.map((mod) => (
                  <button
                    key={mod.module_id}
                    onClick={() => handleSelect(mod.module_id)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent rounded-sm transition-colors"
                  >
                    <div className="font-medium">{mod.label}</div>
                    {mod.description && (
                      <div className="text-xs text-muted-foreground truncate">
                        {mod.description}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Dependency feedback */}
      <DependencyFeedback
        entityId={entityId}
        assignedModules={[...assignments.explicit, ...assignments.autoIncluded]}
        entitySchema={entitySchema}
        allCategoryAssignments={buildCategoryAssignmentsMap(moduleAssignments)}
      />
    </div>
  )
}
