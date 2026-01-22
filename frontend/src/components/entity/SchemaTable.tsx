import { Card, CardContent } from '@/components/ui/card'
import type { EntityType } from '@/api/types'

interface SchemaTableProps {
  schema: Record<string, unknown>
  entityType: EntityType
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '-'
  }
  if (Array.isArray(value)) {
    return value.length === 0 ? '(none)' : value.join(', ')
  }
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2)
  }
  return String(value)
}

// Fields to display per entity type (in order)
const fieldConfig: Record<EntityType, string[]> = {
  category: ['parent', 'properties', 'subobjects'],
  property: ['datatype', 'cardinality', 'allowed_values', 'default_value'],
  subobject: ['properties'],
}

// Human-readable field labels
const fieldLabels: Record<string, string> = {
  parent: 'Parent Category',
  properties: 'Properties',
  subobjects: 'Subobjects',
  datatype: 'Datatype',
  cardinality: 'Cardinality',
  allowed_values: 'Allowed Values',
  default_value: 'Default Value',
}

export function SchemaTable({ schema, entityType }: SchemaTableProps) {
  const fieldsToShow = fieldConfig[entityType] || []

  // Get additional fields not in the config
  const additionalFields = Object.keys(schema).filter(
    (key) => !fieldsToShow.includes(key) && key !== 'id' && key !== 'label' && key !== 'description'
  )

  const allFields = [...fieldsToShow, ...additionalFields]

  if (allFields.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-sm">No schema data available</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-3">
          {allFields.map((field) => {
            const value = schema[field]
            if (value === undefined) return null

            return (
              <div key={field} className="grid grid-cols-3 gap-4">
                <dt className="text-sm font-medium text-muted-foreground">
                  {fieldLabels[field] || field}
                </dt>
                <dd className="col-span-2 text-sm font-mono">
                  {formatValue(value)}
                </dd>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
