import { useState } from 'react'
import { Plus, Pencil, Trash2, ChevronRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import type { DraftChangeV2 } from '@/api/draftApiV2'

interface DraftDiffViewerV2Props {
  changes: DraftChangeV2[]
  onEntityClick?: (entityType: string, entityKey: string) => void
}

interface GroupedChanges {
  [entityType: string]: DraftChangeV2[]
}

// Map change_type to display info
const changeTypeConfig = {
  CREATE: {
    icon: Plus,
    label: '+',
    badgeClass: 'bg-green-100 text-green-800',
  },
  UPDATE: {
    icon: Pencil,
    label: '~',
    badgeClass: 'bg-amber-100 text-amber-800',
  },
  DELETE: {
    icon: Trash2,
    label: '-',
    badgeClass: 'bg-red-100 text-red-800',
  },
}

// Sort order for change types
const changeTypeOrder: Record<string, number> = {
  CREATE: 0,
  UPDATE: 1,
  DELETE: 2,
}

function groupChangesByEntityType(changes: DraftChangeV2[]): GroupedChanges {
  const grouped: GroupedChanges = {}

  for (const change of changes) {
    if (!grouped[change.entity_type]) {
      grouped[change.entity_type] = []
    }
    grouped[change.entity_type].push(change)
  }

  // Sort changes within each group
  for (const entityType in grouped) {
    grouped[entityType].sort((a, b) => {
      // First by change type
      const typeOrder = changeTypeOrder[a.change_type] - changeTypeOrder[b.change_type]
      if (typeOrder !== 0) return typeOrder

      // Then by entity key
      return a.entity_key.localeCompare(b.entity_key)
    })
  }

  return grouped
}

function ChangeCard({
  change,
  onEntityClick,
}: {
  change: DraftChangeV2
  onEntityClick?: (entityType: string, entityKey: string) => void
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const config = changeTypeConfig[change.change_type]
  const Icon = config.icon

  const handleEntityClick = () => {
    if (onEntityClick) {
      onEntityClick(change.entity_type, change.entity_key)
    }
  }

  return (
    <div className="border rounded-md p-2 hover:bg-accent/50">
      <div className="flex items-center gap-3">
        {/* Change type badge */}
        <Badge className={`${config.badgeClass} shrink-0`}>
          {config.label}
        </Badge>

        {/* Entity key (clickable if handler provided) */}
        {onEntityClick ? (
          <button
            onClick={handleEntityClick}
            className="font-mono text-sm hover:underline text-left flex-1"
          >
            {change.entity_key}
          </button>
        ) : (
          <span className="font-mono text-sm flex-1">{change.entity_key}</span>
        )}

        {/* Entity type label */}
        <span className="text-xs text-muted-foreground">{change.entity_type}</span>

        {/* Expand button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1 hover:bg-accent rounded"
        >
          <ChevronRight
            className={`h-4 w-4 transition-transform ${
              isExpanded ? 'rotate-90' : ''
            }`}
          />
        </button>
      </div>

      {/* Expandable detail panel */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t text-sm space-y-2">
          {change.change_type === 'CREATE' && change.replacement_json && (
            <div className="space-y-1">
              <div className="font-medium text-muted-foreground mb-2">
                New Entity Fields:
              </div>
              {Object.entries(change.replacement_json).map(([key, value]) => (
                <div
                  key={key}
                  className="font-mono text-xs bg-green-50 dark:bg-green-950 p-2 rounded"
                >
                  <span className="text-green-700 dark:text-green-300">
                    {key}:
                  </span>{' '}
                  <span className="text-green-600 dark:text-green-400">
                    {JSON.stringify(value)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {change.change_type === 'UPDATE' && change.patch && (
            <div className="space-y-1">
              <div className="font-medium text-muted-foreground mb-2">
                Patch Operations:
              </div>
              {change.patch.map((op, idx) => (
                <div
                  key={idx}
                  className="font-mono text-xs bg-amber-50 dark:bg-amber-950 p-2 rounded space-y-1"
                >
                  <div>
                    <span className="text-amber-700 dark:text-amber-300">op:</span>{' '}
                    {op.op}
                  </div>
                  <div>
                    <span className="text-amber-700 dark:text-amber-300">path:</span>{' '}
                    {op.path}
                  </div>
                  {op.value !== undefined && (
                    <div>
                      <span className="text-amber-700 dark:text-amber-300">
                        value:
                      </span>{' '}
                      {JSON.stringify(op.value)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {change.change_type === 'DELETE' && (
            <div className="text-red-600 dark:text-red-400 font-medium">
              Entity will be deleted
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function EntityTypeSection({
  entityType,
  changes,
  onEntityClick,
}: {
  entityType: string
  changes: DraftChangeV2[]
  onEntityClick?: (entityType: string, entityKey: string) => void
}) {
  const [isOpen, setIsOpen] = useState(true)

  // Calculate counts by change type
  const createCount = changes.filter((c) => c.change_type === 'CREATE').length
  const updateCount = changes.filter((c) => c.change_type === 'UPDATE').length
  const deleteCount = changes.filter((c) => c.change_type === 'DELETE').length

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 hover:bg-accent/50 rounded px-2">
        <ChevronRight
          className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-90' : ''}`}
        />
        <span className="font-medium">
          {entityType} ({changes.length})
        </span>
        <div className="ml-auto flex items-center gap-2">
          {createCount > 0 && (
            <Badge className="bg-green-100 text-green-800 text-xs">
              +{createCount}
            </Badge>
          )}
          {updateCount > 0 && (
            <Badge className="bg-amber-100 text-amber-800 text-xs">
              ~{updateCount}
            </Badge>
          )}
          {deleteCount > 0 && (
            <Badge className="bg-red-100 text-red-800 text-xs">
              -{deleteCount}
            </Badge>
          )}
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-6 mt-2 space-y-2">
          {changes.map((change) => (
            <ChangeCard
              key={change.id}
              change={change}
              onEntityClick={onEntityClick}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

export function DraftDiffViewerV2({
  changes,
  onEntityClick,
}: DraftDiffViewerV2Props) {
  if (changes.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No changes in this draft
        </CardContent>
      </Card>
    )
  }

  // Group changes by entity type
  const grouped = groupChangesByEntityType(changes)

  // Sort entity types alphabetically
  const entityTypes = Object.keys(grouped).sort()

  // Calculate summary counts
  const createCount = changes.filter((c) => c.change_type === 'CREATE').length
  const updateCount = changes.filter((c) => c.change_type === 'UPDATE').length
  const deleteCount = changes.filter((c) => c.change_type === 'DELETE').length

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <Card>
        <CardContent className="py-3">
          <div className="flex items-center gap-4 text-sm">
            <span className="font-medium">Total: {changes.length} changes</span>
            <div className="flex items-center gap-3">
              {createCount > 0 && (
                <span className="text-green-700 dark:text-green-300">
                  +{createCount} added
                </span>
              )}
              {updateCount > 0 && (
                <span className="text-amber-700 dark:text-amber-300">
                  ~{updateCount} modified
                </span>
              )}
              {deleteCount > 0 && (
                <span className="text-red-700 dark:text-red-300">
                  -{deleteCount} deleted
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Entity type sections */}
      <Card>
        <CardContent className="py-3 space-y-1">
          {entityTypes.map((entityType) => (
            <EntityTypeSection
              key={entityType}
              entityType={entityType}
              changes={grouped[entityType]}
              onEntityClick={onEntityClick}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
