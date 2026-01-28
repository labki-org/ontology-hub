// v2 Entity types with change status
export interface EntityWithStatus {
  entity_key: string
  label: string
  description?: string | null
  change_status?: 'added' | 'modified' | 'deleted' | 'unchanged'
  deleted?: boolean
}

export interface EntityListResponseV2 {
  items: EntityWithStatus[]
  next_cursor: string | null
  has_next: boolean
}

export interface PropertyProvenance {
  entity_key: string
  label: string
  is_direct: boolean
  is_inherited: boolean
  is_required: boolean
  source_category: string
  inheritance_depth: number
}

export interface SubobjectProvenance {
  entity_key: string
  label: string
  is_required: boolean
}

export interface CategoryDetailV2 {
  entity_key: string
  label: string
  description?: string | null
  parents: string[]
  properties: PropertyProvenance[]
  subobjects: SubobjectProvenance[]
  change_status?: 'added' | 'modified' | 'deleted' | 'unchanged'
  deleted?: boolean
  patch_error?: string
}

export interface OntologyVersionInfo {
  commit_sha: string
  ingested_at: string
}

// Graph types (from backend app/schemas/graph.py)
export interface GraphNode {
  id: string
  label: string
  entity_type: string
  depth?: number
  modules: string[]
  change_status?: 'added' | 'modified' | 'deleted' | 'unchanged'
}

export interface GraphEdge {
  source: string
  target: string
  edge_type: string
}

export interface GraphResponse {
  nodes: GraphNode[]
  edges: GraphEdge[]
  has_cycles: boolean
}

// Property detail (matches PropertyDetailResponse)
export interface PropertyDetailV2 {
  entity_key: string
  label: string
  description?: string | null
  datatype: string
  cardinality: string
  // Validation constraints
  allowed_values?: string[] | null
  allowed_pattern?: string | null
  allowed_value_list?: string | null
  // Display configuration
  display_units?: string[] | null
  display_precision?: number | null
  // Constraints and relationships
  unique_values: boolean
  has_display_template?: string | null
  change_status?: 'added' | 'modified' | 'deleted' | 'unchanged'
  deleted?: boolean
}

// Subobject property info
export interface SubobjectPropertyInfo {
  entity_key: string
  label: string
  is_required: boolean
}

// Subobject detail with required/optional properties
export interface SubobjectDetailV2 {
  entity_key: string
  label: string
  description?: string | null
  required_properties: SubobjectPropertyInfo[]
  optional_properties: SubobjectPropertyInfo[]
  change_status?: 'added' | 'modified' | 'deleted' | 'unchanged'
  deleted?: boolean
}

// Module detail (matches ModuleDetailResponse)
export interface ModuleDetailV2 {
  entity_key: string
  label: string
  version?: string | null
  description?: string | null
  entities: Record<string, string[]>  // { category: [...], property: [...] }
  dependencies: string[]  // Module entity keys this module depends on
  closure: string[]  // Transitive category dependencies
  change_status?: 'added' | 'modified' | 'deleted' | 'unchanged'
  deleted?: boolean
}

// Bundle detail (matches BundleDetailResponse)
export interface BundleDetailV2 {
  entity_key: string
  label: string
  description?: string | null
  version?: string | null
  modules: string[]
  closure: string[]  // Transitive module dependencies
  change_status?: 'added' | 'modified' | 'deleted' | 'unchanged'
  deleted?: boolean
}

// Template detail
export interface TemplateDetailV2 {
  entity_key: string
  label: string
  description?: string | null
  wikitext?: string  // Template content
  change_status?: 'added' | 'modified' | 'deleted' | 'unchanged'
  deleted?: boolean
}

// Dashboard page (used in DashboardDetailV2)
export interface DashboardPage {
  name: string
  wikitext: string
}

// Dashboard detail
export interface DashboardDetailV2 {
  entity_key: string
  label: string
  description?: string | null
  pages: DashboardPage[]
  change_status?: 'added' | 'modified' | 'deleted' | 'unchanged'
  deleted?: boolean
}

// Resource detail
export interface ResourceDetailV2 {
  entity_key: string
  label: string
  description?: string | null
  category_key: string
  dynamic_fields: Record<string, unknown>
  change_status?: 'added' | 'modified' | 'deleted' | 'unchanged'
  deleted?: boolean
}

// Union type for any entity detail
export type EntityDetailV2 =
  | CategoryDetailV2
  | PropertyDetailV2
  | SubobjectDetailV2
  | ModuleDetailV2
  | BundleDetailV2
  | TemplateDetailV2
  | DashboardDetailV2
  | ResourceDetailV2
