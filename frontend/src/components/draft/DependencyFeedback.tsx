import { AlertTriangle, Info } from 'lucide-react'
import { useModules } from '@/api/modules'

interface EntitySchema {
  parent?: string
  properties?: string[]
  subobjects?: string[]
}

interface DependencyFeedbackProps {
  entityId: string
  assignedModules: string[]
  entitySchema?: EntitySchema
  /** Map of all category assignments in the draft (entityId -> moduleIds) */
  allCategoryAssignments?: Map<string, string[]>
}

interface FeedbackItem {
  type: 'missing' | 'redundant' | 'info'
  message: string
  details: string
}

/**
 * Get all modules accessible from a set of assigned modules
 * (the modules themselves plus all their dependencies, recursively)
 */
function getAccessibleModules(
  assignedModules: string[],
  moduleMap: Map<string, { module_id: string; dependencies: string[] }>
): Set<string> {
  const accessible = new Set<string>()
  const toProcess = [...assignedModules]

  while (toProcess.length > 0) {
    const moduleId = toProcess.pop()!
    if (accessible.has(moduleId)) continue
    accessible.add(moduleId)

    const mod = moduleMap.get(moduleId)
    if (mod) {
      for (const dep of mod.dependencies) {
        if (!accessible.has(dep)) {
          toProcess.push(dep)
        }
      }
    }
  }

  return accessible
}

/**
 * Get all categories included in a set of modules
 */
function getCategoriesInModules(
  moduleIds: Set<string>,
  moduleMap: Map<string, { module_id: string; category_ids: string[] }>
): Set<string> {
  const categories = new Set<string>()
  for (const moduleId of moduleIds) {
    const mod = moduleMap.get(moduleId)
    if (mod) {
      for (const catId of mod.category_ids) {
        categories.add(catId)
      }
    }
  }
  return categories
}

export function DependencyFeedback({
  assignedModules,
  entitySchema,
  allCategoryAssignments,
}: DependencyFeedbackProps) {
  const { data: modules } = useModules()

  if (!modules || assignedModules.length === 0) return null

  const feedback: FeedbackItem[] = []

  // Build map of module_id -> module data
  const moduleMap = new Map(modules.map((m) => [m.module_id, m]))

  // Get all accessible modules (assigned + their dependencies)
  const accessibleModules = getAccessibleModules(assignedModules, moduleMap)

  // Get all categories in accessible modules
  const accessibleCategories = getCategoriesInModules(accessibleModules, moduleMap)

  // Also include categories that are being assigned in this draft
  if (allCategoryAssignments) {
    for (const [catId, catModules] of allCategoryAssignments) {
      // Check if any of this category's modules overlap with our accessible modules
      const hasOverlap = catModules.some((modId) => accessibleModules.has(modId))
      if (hasOverlap) {
        accessibleCategories.add(catId)
      }
    }
  }

  // Check entity-level dependencies (parent, properties, subobjects)
  if (entitySchema) {
    // Check parent category
    if (entitySchema.parent) {
      const parentId = entitySchema.parent
      const parentAccessible = accessibleCategories.has(parentId)

      // Also check if parent is being assigned to overlapping modules in this draft
      const parentInDraft = allCategoryAssignments?.has(parentId)
      const parentModules = allCategoryAssignments?.get(parentId) || []
      // Parent is accessible if any of parent's assigned modules overlap with our accessible modules
      const parentAssignedToAccessibleModule = parentModules.some((modId) =>
        accessibleModules.has(modId)
      )

      if (!parentAccessible && !parentAssignedToAccessibleModule) {
        feedback.push({
          type: 'missing',
          message: 'Missing Parent Category',
          details: `Parent "${parentId}" is not in assigned modules. ${
            parentInDraft
              ? `Assign "${parentId}" to the same module first.`
              : `"${parentId}" should be included in this module or a dependency.`
          }`,
        })
      }
    }

    // Note: Properties and subobjects are transitively included via categories
    // We could add warnings here if referenced properties/subobjects don't exist
    // but that's more of a validation concern (Phase 6)
  }

  // Check for redundant explicit assignments (info-level)
  // If module A depends on B, and both are explicitly assigned, B is redundant
  const redundantAssignments: string[] = []
  for (const moduleId of assignedModules) {
    const mod = moduleMap.get(moduleId)
    if (!mod) continue

    // Check if any other assigned module already includes this one as a dependency
    for (const otherModuleId of assignedModules) {
      if (otherModuleId === moduleId) continue
      const otherMod = moduleMap.get(otherModuleId)
      if (otherMod?.dependencies.includes(moduleId)) {
        redundantAssignments.push(moduleId)
        break
      }
    }
  }

  if (redundantAssignments.length > 0) {
    const depLabels = redundantAssignments
      .map((d) => moduleMap.get(d)?.label || d)
      .join(', ')

    feedback.push({
      type: 'info',
      message: 'Redundant Assignment',
      details: `${depLabels} already included via module dependencies`,
    })
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
              : item.type === 'info'
                ? 'bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200'
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
