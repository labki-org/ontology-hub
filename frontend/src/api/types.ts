export type EntityType = 'category' | 'property' | 'subobject'

export interface EntityPublic {
  id: string                      // UUID
  entity_id: string               // Schema ID like "Person"
  entity_type: EntityType
  label: string
  description: string | null
  schema_definition: Record<string, unknown>
  commit_sha: string | null
  created_at: string
  updated_at: string
}

export interface EntityListResponse {
  items: EntityPublic[]
  next_cursor: string | null
  has_next: boolean
}

export interface EntityTypeSummary {
  entity_type: string
  count: number
}

export interface EntityOverviewResponse {
  types: EntityTypeSummary[]
  total: number
}
