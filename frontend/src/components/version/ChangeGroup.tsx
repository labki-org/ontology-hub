import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Plus, Pencil, Trash2 } from 'lucide-react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Badge } from '@/components/ui/badge'
import { computeDiff, flattenDelta, type FieldChange } from '@/lib/diff'
import type { EntityChange } from '@/api/types'

interface ChangeGroupProps {
  title: string
  changes: EntityChange[]
  variant: 'success' | 'warning' | 'destructive'
}

const variantConfig = {
  success: {
    icon: Plus,
    badgeClass: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    headerClass: 'text-green-700 dark:text-green-300',
  },
  warning: {
    icon: Pencil,
    badgeClass: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    headerClass: 'text-yellow-700 dark:text-yellow-300',
  },
  destructive: {
    icon: Trash2,
    badgeClass: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    headerClass: 'text-red-700 dark:text-red-300',
  },
}

function getEntityLink(entityType: string, entityId: string): string {
  // Map plural entity_type from API to singular route
  const typeMap: Record<string, string> = {
    categories: 'category',
    properties: 'property',
    subobjects: 'subobject',
    modules: 'module',
    profiles: 'profile',
  }
  const routeType = typeMap[entityType] || entityType
  return `/${routeType}/${entityId}`
}

function FieldDiff({ changes }: { changes: FieldChange[] }) {
  if (changes.length === 0) return null

  return (
    <div className="ml-4 mt-2 space-y-1 text-sm">
      {changes.map((change, idx) => (
        <div key={idx} className="flex items-start gap-2 font-mono text-xs">
          <span className="text-muted-foreground min-w-[120px] truncate">
            {change.path}:
          </span>
          {change.type === 'added' && (
            <span className="text-green-600 dark:text-green-400">
              + {JSON.stringify(change.newValue)}
            </span>
          )}
          {change.type === 'deleted' && (
            <span className="text-red-600 dark:text-red-400 line-through">
              - {JSON.stringify(change.oldValue)}
            </span>
          )}
          {change.type === 'modified' && (
            <span>
              <span className="text-red-600 dark:text-red-400 line-through">
                {JSON.stringify(change.oldValue)}
              </span>
              {' -> '}
              <span className="text-green-600 dark:text-green-400">
                {JSON.stringify(change.newValue)}
              </span>
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

function EntityChangeItem({
  change,
  variant,
}: {
  change: EntityChange
  variant: 'success' | 'warning' | 'destructive'
}) {
  const [isOpen, setIsOpen] = useState(false)

  // For modified changes, compute field-level diff
  const fieldChanges: FieldChange[] =
    variant === 'warning' && change.old && change.new
      ? flattenDelta(computeDiff(change.old, change.new))
      : []

  const hasFieldChanges = fieldChanges.length > 0

  return (
    <div className="py-1">
      {hasFieldChanges ? (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger className="flex items-center gap-2 hover:bg-accent rounded px-1 py-0.5 w-full text-left">
            <ChevronRight
              className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-90' : ''}`}
            />
            <Link
              to={getEntityLink(change.entity_type, change.entity_id)}
              className="text-sm hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {change.entity_id}
            </Link>
            <Badge variant="outline" className="text-xs ml-auto">
              {fieldChanges.length} field{fieldChanges.length !== 1 ? 's' : ''} changed
            </Badge>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <FieldDiff changes={fieldChanges} />
          </CollapsibleContent>
        </Collapsible>
      ) : (
        <div className="flex items-center gap-2 px-1 py-0.5">
          <Link
            to={getEntityLink(change.entity_type, change.entity_id)}
            className="text-sm hover:underline"
          >
            {change.entity_id}
          </Link>
        </div>
      )}
    </div>
  )
}

export function ChangeGroup({ title, changes, variant }: ChangeGroupProps) {
  const [isOpen, setIsOpen] = useState(true)
  const config = variantConfig[variant]
  const Icon = config.icon

  if (changes.length === 0) return null

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 hover:bg-accent/50 rounded px-2">
        <ChevronRight
          className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-90' : ''}`}
        />
        <Icon className={`h-4 w-4 ${config.headerClass}`} />
        <span className={`font-medium ${config.headerClass}`}>{title}</span>
        <Badge className={`ml-auto ${config.badgeClass}`}>{changes.length}</Badge>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-6 border-l pl-4 py-1">
          {changes.map((change) => (
            <EntityChangeItem key={change.key} change={change} variant={variant} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
