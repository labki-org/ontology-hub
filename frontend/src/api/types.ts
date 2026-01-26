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

// Draft types

export interface EntityDefinition {
  entity_id: string
  label: string
  description?: string
  schema_definition: Record<string, unknown>
}

export interface ModuleDefinition {
  module_id: string
  label: string
  description?: string
  category_ids: string[]
  dependencies: string[]
}

export interface ProfileDefinition {
  profile_id: string
  label: string
  description?: string
  module_ids: string[]
}

export interface EntitiesPayload {
  categories: EntityDefinition[]
  properties: EntityDefinition[]
  subobjects: EntityDefinition[]
}

export interface DraftPayload {
  wiki_url: string
  base_version: string
  entities: EntitiesPayload
  modules?: ModuleDefinition[]
  profiles?: ProfileDefinition[]
}

export type DraftStatus = 'pending' | 'validated' | 'submitted' | 'expired'

export interface DraftPublic {
  id: string
  status: DraftStatus
  payload: DraftPayload
  source_wiki: string | null
  base_commit_sha: string | null
  diff_preview: VersionDiffResponse | null
  validation_results: DraftValidationReport | null
  expires_at: string
  created_at: string
}

export interface ValidationError {
  field: string
  message: string
  severity: 'error' | 'warning'
}

export interface DraftCreateResponse {
  capability_url: string
  expires_at: string
  diff_preview: VersionDiffResponse | null
  validation_results: DraftValidationReport | null
  validation_warnings: ValidationError[]  // Keep for backward compat
}

// Module assignment state types for draft editing
export interface ModuleAssignmentState {
  explicit: string[]      // Explicitly assigned module IDs
  autoIncluded: string[]  // Auto-included via dependencies
}

export interface NewModule {
  module_id: string
  label: string
  description?: string
  category_ids: string[]
  dependencies: string[]
}

// Patch payload types for draft updates
export interface EntityUpdate {
  entity_id: string
  label?: string
  description?: string
  schema_definition?: Record<string, unknown>
}

export interface EntitiesUpdate {
  categories?: EntityUpdate[]
  properties?: EntityUpdate[]
  subobjects?: EntityUpdate[]
}

export interface ModuleUpdate {
  entity_id: string
  module_ids: string[]
}

export interface ProfileUpdate {
  profile_id: string
  module_ids: string[]
}

export interface DraftPatchPayload {
  entities?: EntitiesUpdate
  modules?: (ModuleUpdate | NewModule)[]
  profiles?: (ProfileUpdate | ProfileDefinition)[]
}

// Validation types (matches backend schemas/validation.py)

export type ValidationSeverity = 'error' | 'warning' | 'info'
export type SemverSuggestion = 'major' | 'minor' | 'patch'

export interface ValidationResult {
  entity_type: 'category' | 'property' | 'subobject' | 'module' | 'profile'
  entity_id: string
  field: string | null
  code: string  // e.g., "MISSING_PARENT", "DATATYPE_CHANGED"
  message: string
  severity: ValidationSeverity
  suggested_semver: SemverSuggestion | null
  old_value: string | null
  new_value: string | null
}

export interface DraftValidationReport {
  is_valid: boolean
  errors: ValidationResult[]
  warnings: ValidationResult[]
  info: ValidationResult[]
  suggested_semver: SemverSuggestion
  semver_reasons: string[]
}

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

// Additional v2 entity detail types

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

// Draft change types for edit mode
export type ChangeType = 'create' | 'update' | 'delete'

export interface DraftChangeCreate {
  change_type: ChangeType
  entity_type: string
  entity_key: string
  patch?: Array<{ op: string; path: string; value?: unknown }>
  replacement_json?: Record<string, unknown>
}

export interface DraftChangeResponse {
  id: string
  change_type: ChangeType
  entity_type: string
  entity_key: string
  patch?: Array<{ op: string; path: string; value?: unknown }>
  replacement_json?: Record<string, unknown>
  created_at: string
}

// Union type for any entity detail
export type EntityDetailV2 =
  | CategoryDetailV2
  | PropertyDetailV2
  | SubobjectDetailV2
  | ModuleDetailV2
  | BundleDetailV2
  | TemplateDetailV2
