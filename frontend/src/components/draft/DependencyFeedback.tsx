import { AlertTriangle, Info } from 'lucide-react'
import { useModules } from '@/api/modules'

interface DependencyFeedbackProps {
  entityId: string
  assignedModules: string[]
}

interface FeedbackItem {
  type: 'missing' | 'redundant'
  message: string
  details: string
}

export function DependencyFeedback({
  entityId: _entityId,
  assignedModules,
}: DependencyFeedbackProps) {
  const { data: modules } = useModules()

  if (!modules || assignedModules.length === 0) return null

  const feedback: FeedbackItem[] = []

  // Build map of module_id -> module data
  const moduleMap = new Map(modules.map((m) => [m.module_id, m]))

  // Check for missing dependencies
  for (const moduleId of assignedModules) {
    const mod = moduleMap.get(moduleId)
    if (!mod) continue

    const missingDeps = mod.dependencies.filter(
      (dep) => !assignedModules.includes(dep)
    )

    if (missingDeps.length > 0) {
      const depLabels = missingDeps
        .map((d) => moduleMap.get(d)?.label || d)
        .join(', ')

      feedback.push({
        type: 'missing',
        message: `Missing Dependencies`,
        details: `${mod.label} requires: ${depLabels}`,
      })
    }
  }

  // Check for redundancy: if A depends on B and both are explicitly assigned,
  // A's dependency on B is redundant (B is auto-included)
  for (const moduleId of assignedModules) {
    const mod = moduleMap.get(moduleId)
    if (!mod) continue

    const redundantDeps = mod.dependencies.filter((dep) =>
      assignedModules.includes(dep)
    )

    if (redundantDeps.length > 0) {
      const depLabels = redundantDeps
        .map((d) => moduleMap.get(d)?.label || d)
        .join(', ')

      feedback.push({
        type: 'redundant',
        message: `Redundant Assignment`,
        details: `${mod.label} already includes: ${depLabels}`,
      })
    }
  }

  if (feedback.length === 0) return null

  return (
    <div className="mt-2 space-y-2">
      {feedback.map((item, idx) => (
        <div
          key={idx}
          className={`flex items-start gap-2 rounded-md p-2 text-sm ${
            item.type === 'missing'
              ? 'bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200'
              : 'bg-yellow-50 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200'
          }`}
        >
          {item.type === 'missing' ? (
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          ) : (
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
          )}
          <div>
            <span className="font-medium">{item.message}: </span>
            <span>{item.details}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
