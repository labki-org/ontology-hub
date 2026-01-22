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

export interface ModulePublic {
  id: string
  module_id: string
  label: string
  description: string | null
  category_ids: string[]
  dependencies: string[]
  commit_sha: string | null
  created_at: string
  updated_at: string
}

export interface ProfilePublic {
  id: string
  profile_id: string
  label: string
  description: string | null
  module_ids: string[]
  commit_sha: string | null
  created_at: string
  updated_at: string
}

export interface ModuleEntitiesResponse {
  categories: EntityPublic[]
  properties: EntityPublic[]
  subobjects: EntityPublic[]
}

// Version types
export interface ReleasePublic {
  tag_name: string
  name: string | null
  created_at: string
  published_at: string | null
  body: string | null
}

export interface EntityChange {
  key: string
  entity_type: string
  entity_id: string
  old?: Record<string, unknown>
  new?: Record<string, unknown>
}

export interface ChangesByType {
  added: EntityChange[]
  modified: EntityChange[]
  deleted: EntityChange[]
}

export interface VersionDiffResponse {
  old_version: string
  new_version: string
  categories: ChangesByType
  properties: ChangesByType
  subobjects: ChangesByType
  modules: ChangesByType
  profiles: ChangesByType
}
