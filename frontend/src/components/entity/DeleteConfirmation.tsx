import { AlertCircle } from 'lucide-react'
import type { DependentEntity } from '@/lib/dependencyChecker'

interface DeleteConfirmationProps {
  /** The label of the entity being deleted */
  entityLabel: string
  /** List of entities that depend on this entity */
  dependents: DependentEntity[]
  /** Callback to close the confirmation dialog */
  onClose: () => void
}

/**
 * Error display shown when deletion is blocked due to dependent entities.
 *
 * Shows:
 * - Alert icon and "Cannot delete" message
 * - Count of dependent entities
 * - Scrollable list of dependents with their types and relationship
 * - Close button to dismiss
 */
export function DeleteConfirmation({
  entityLabel,
  dependents,
  onClose,
}: DeleteConfirmationProps) {
  return (
    <div className="p-4 border border-red-200 rounded bg-red-50 dark:bg-red-900/20 dark:border-red-800">
      <div className="flex items-start gap-2">
        <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-red-900 dark:text-red-100">
            Cannot delete "{entityLabel}"
          </p>
          <p className="text-sm text-red-700 dark:text-red-300 mt-1">
            {dependents.length} {dependents.length === 1 ? 'entity depends' : 'entities depend'} on this item:
          </p>
          <ul className="mt-2 text-sm text-red-700 dark:text-red-300 list-disc list-inside max-h-32 overflow-auto">
            {dependents.map((dep) => (
              <li key={dep.entityKey} className="truncate">
                <span className="font-medium">{dep.label}</span>
                <span className="text-red-600 dark:text-red-400"> ({dep.entityType})</span>
                <span className="text-red-500 dark:text-red-500"> - {dep.relationshipType}</span>
              </li>
            ))}
          </ul>
          <button
            onClick={onClose}
            className="mt-3 text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 underline"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
