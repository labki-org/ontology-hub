import { useState, useRef, useEffect } from 'react'
import { Check, ChevronDown, Boxes } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useModules } from '@/api/modules'
import { useDraftStore } from '@/stores/draftStore'
import { cn } from '@/lib/utils'
import type { VersionDiffResponse } from '@/api/types'

interface BulkModuleAssignmentProps {
  diff: VersionDiffResponse
}

export function BulkModuleAssignment({ diff }: BulkModuleAssignmentProps) {
  const { data: modules, isLoading } = useModules()
  const { bulkAssignToModule, moduleAssignments } = useDraftStore()

  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(
    new Set()
  )
  const [selectedModule, setSelectedModule] = useState<string | null>(null)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Get new categories that need module assignment
  const newCategories = diff.categories.added.map((change) => ({
    id: change.entity_id,
    label: change.new?.label as string || change.entity_id,
  }))

  // Filter out categories that already have assignments
  const unassignedCategories = newCategories.filter(
    (cat) => !moduleAssignments.has(cat.id)
  )

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

  // Don't show if no new categories
  if (newCategories.length === 0) return null

  // Don't show if all categories already assigned
  if (unassignedCategories.length === 0) {
    return (
      <Card className="border-green-200 dark:border-green-900">
        <CardContent className="py-4">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
            <Check className="h-5 w-5" />
            <span>All new categories have been assigned to modules</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  const toggleCategory = (categoryId: string) => {
    const next = new Set(selectedCategories)
    if (next.has(categoryId)) {
      next.delete(categoryId)
    } else {
      next.add(categoryId)
    }
    setSelectedCategories(next)
  }

  const toggleSelectAll = () => {
    if (selectedCategories.size === unassignedCategories.length) {
      setSelectedCategories(new Set())
    } else {
      setSelectedCategories(new Set(unassignedCategories.map((c) => c.id)))
    }
  }

  const handleAssign = () => {
    if (selectedModule && selectedCategories.size > 0) {
      bulkAssignToModule(Array.from(selectedCategories), selectedModule)
      setSelectedCategories(new Set())
      setSelectedModule(null)
    }
  }

  const handleSelectModule = (moduleId: string) => {
    setSelectedModule(moduleId)
    setIsDropdownOpen(false)
  }

  const selectedModuleData = modules?.find(
    (m) => m.module_id === selectedModule
  )

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Boxes className="h-5 w-5" />
          Assign New Categories to Modules
          <Badge variant="secondary" className="ml-auto">
            {unassignedCategories.length} need assignment
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Category selection */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Select categories:</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSelectAll}
              className="h-7 text-xs"
            >
              {selectedCategories.size === unassignedCategories.length
                ? 'Deselect All'
                : 'Select All'}
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1">
            {unassignedCategories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => toggleCategory(cat.id)}
                className={cn(
                  'flex items-center gap-2 rounded-md border p-2 text-sm text-left transition-colors',
                  selectedCategories.has(cat.id)
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:bg-accent'
                )}
              >
                <div
                  className={cn(
                    'h-4 w-4 rounded border flex items-center justify-center shrink-0',
                    selectedCategories.has(cat.id)
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-muted-foreground'
                  )}
                >
                  {selectedCategories.has(cat.id) && (
                    <Check className="h-3 w-3" />
                  )}
                </div>
                <span className="truncate">{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Module selection and assign button */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1" ref={dropdownRef}>
            <Button
              variant="outline"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="w-full justify-between"
              disabled={isLoading}
            >
              {selectedModuleData ? (
                selectedModuleData.label
              ) : (
                <span className="text-muted-foreground">Select a module...</span>
              )}
              <ChevronDown
                className={cn(
                  'h-4 w-4 transition-transform',
                  isDropdownOpen && 'rotate-180'
                )}
              />
            </Button>

            {isDropdownOpen && modules && (
              <Card className="absolute top-full left-0 right-0 mt-1 z-50 p-1 shadow-lg">
                <div className="max-h-48 overflow-y-auto">
                  {modules.map((mod) => (
                    <button
                      key={mod.module_id}
                      onClick={() => handleSelectModule(mod.module_id)}
                      className={cn(
                        'w-full text-left px-3 py-2 text-sm hover:bg-accent rounded-sm transition-colors',
                        selectedModule === mod.module_id && 'bg-accent'
                      )}
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

          <Button
            onClick={handleAssign}
            disabled={!selectedModule || selectedCategories.size === 0}
          >
            Assign {selectedCategories.size > 0 && `(${selectedCategories.size})`}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
