/**
 * Shared property options for datatypes and cardinality.
 *
 * Source of truth: labki-ontology/properties/_schema.json
 * Reference: https://www.semantic-mediawiki.org/wiki/Help:List_of_datatypes
 *
 * IMPORTANT: Keep this in sync with the enum in labki-ontology properties/_schema.json
 */

/**
 * All allowed property datatypes from SemanticMediaWiki.
 * Values are capitalized to match backend validation.
 */
export const ALLOWED_DATATYPES = [
  'Annotation URI',
  'Boolean',
  'Code',
  'Date',
  'Email',
  'External identifier',
  'Geographic coordinates',
  'Keyword',
  'Monolingual text',
  'Number',
  'Page',
  'Quantity',
  'Record',
  'Reference',
  'Telephone number',
  'Temperature',
  'Text',
  'URL',
] as const

export type Datatype = (typeof ALLOWED_DATATYPES)[number]

/**
 * Common datatypes shown by default in dropdown menus.
 * Less common types are still available but shown after these.
 */
export const COMMON_DATATYPES: Datatype[] = [
  'Text',
  'Number',
  'Boolean',
  'Date',
  'URL',
  'Page',
  'Email',
  'Telephone number',
]

/**
 * Datatype options formatted for Select components.
 * Common types appear first, followed by other types alphabetically.
 */
export const DATATYPE_OPTIONS = [
  // Common types first
  ...COMMON_DATATYPES.map((value) => ({ value, label: value })),
  // Separator would go here in UI if needed
  // Other types alphabetically
  ...ALLOWED_DATATYPES.filter((dt) => !COMMON_DATATYPES.includes(dt))
    .sort()
    .map((value) => ({ value, label: value })),
]

/**
 * Cardinality options for property fields.
 */
export const CARDINALITY_OPTIONS = [
  { value: 'single', label: 'Single value' },
  { value: 'multiple', label: 'Multiple values' },
] as const

export type Cardinality = (typeof CARDINALITY_OPTIONS)[number]['value']
