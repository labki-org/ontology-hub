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

export interface InheritanceNode {
  id: string
  label: string
  entity_id: string
  is_current: boolean
}

export interface InheritanceEdge {
  source: string
  target: string
}

export interface InheritanceResponse {
  nodes: InheritanceNode[]
  edges: InheritanceEdge[]
  has_circular: boolean
}
