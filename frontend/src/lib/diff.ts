import * as jsondiffpatch from 'jsondiffpatch'

const diffpatcher = jsondiffpatch.create({
  objectHash: (obj: object) =>
    (obj as { id?: string }).id ||
    (obj as { entity_id?: string }).entity_id ||
    JSON.stringify(obj),
  arrays: {
    detectMove: true,
  },
})

export type DiffDelta = jsondiffpatch.Delta

export function computeDiff(
  oldValue: unknown,
  newValue: unknown
): DiffDelta | undefined {
  return diffpatcher.diff(oldValue, newValue)
}

export type ChangeType = 'added' | 'modified' | 'deleted' | 'unchanged'

export function classifyChange(delta: unknown): ChangeType {
  if (delta === undefined) return 'unchanged'
  if (Array.isArray(delta)) {
    if (delta.length === 1) return 'added' // [newValue]
    if (delta.length === 2) return 'modified' // [oldValue, newValue]
    if (delta.length === 3 && delta[2] === 0) return 'deleted' // [oldValue, 0, 0]
  }
  return 'modified' // Nested object changes
}

export function formatPath(path: string): string {
  // Convert JSON path to human-readable format
  return path.replace(/\./g, ' > ').replace(/\[(\d+)\]/g, ' [$1]')
}

/**
 * Flatten a diff delta into a list of field-level changes.
 * Returns array of { path, type, oldValue, newValue } objects.
 */
export interface FieldChange {
  path: string
  type: ChangeType
  oldValue?: unknown
  newValue?: unknown
}

export function flattenDelta(
  delta: DiffDelta | undefined,
  parentPath: string = ''
): FieldChange[] {
  if (!delta || typeof delta !== 'object') return []

  const changes: FieldChange[] = []

  for (const [key, value] of Object.entries(delta)) {
    // Skip internal keys like _t for arrays
    if (key === '_t') continue

    const path = parentPath ? `${parentPath}.${key}` : key

    if (Array.isArray(value)) {
      const type = classifyChange(value)
      if (type === 'added') {
        changes.push({ path, type, newValue: value[0] })
      } else if (type === 'deleted') {
        changes.push({ path, type, oldValue: value[0] })
      } else if (type === 'modified') {
        changes.push({ path, type, oldValue: value[0], newValue: value[1] })
      }
    } else if (typeof value === 'object' && value !== null) {
      // Nested object - recurse
      changes.push(...flattenDelta(value as DiffDelta, path))
    }
  }

  return changes
}
