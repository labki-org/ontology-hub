import { z } from 'zod'

/**
 * ID validation patterns matching labki-ontology _schema.json definitions.
 * These patterns are the source of truth from: https://github.com/labki-org/labki-ontology
 *
 * Pattern: ^[A-Z][a-z]*(_[a-z]+)*$
 * Used by: Category, Subobject, Module, Bundle
 * Examples: "Person", "Contact_info", "Core"
 */
const genericIdValidation = z
  .string()
  .min(1, 'ID is required')
  .regex(
    /^[A-Z][a-z]*(_[a-z]+)*$/,
    'ID must start with uppercase letter, use underscores between words (e.g., Person, Contact_info)'
  )

/**
 * Property ID validation pattern from labki-ontology properties/_schema.json.
 * Properties must have Has_ or Is_ prefix per SemanticMediaWiki convention.
 *
 * Pattern: ^(Has|Is)_[a-z]+(_[a-z]+)*$
 * Examples: "Has_name", "Is_part_of", "Has_email_address"
 */
const propertyIdValidation = z
  .string()
  .min(1, 'ID is required')
  .regex(
    /^(Has|Is)_[a-z]+(_[a-z]+)*$/,
    'Property ID must start with Has_ or Is_ prefix (e.g., Has_name, Is_part_of)'
  )

/**
 * Template ID validation from labki-ontology templates/_schema.json.
 * Templates allow more flexible IDs including / for subpages.
 *
 * Pattern: minLength 1 (no strict pattern)
 * Examples: "Infobox", "Person/sidebar", "Navigation/main"
 */
const templateIdValidation = z.string().min(1, 'ID is required')

/**
 * Category entity schema.
 * Required: id, label, description
 * Optional: parents (relationship to other categories)
 */
export const categorySchema = z.object({
  id: genericIdValidation,
  label: z.string().min(1, 'Label is required'),
  description: z.string().min(1, 'Description is required'),
  parents: z.array(z.string()).optional(),
  required_properties: z.array(z.string()).optional(),
  optional_properties: z.array(z.string()).optional(),
  required_subobjects: z.array(z.string()).optional(),
  optional_subobjects: z.array(z.string()).optional(),
})

export type CategoryFormData = z.infer<typeof categorySchema>

/**
 * Property entity schema.
 * Required: id, label, description, datatype, cardinality
 */
export const propertySchema = z.object({
  id: propertyIdValidation,
  label: z.string().min(1, 'Label is required'),
  description: z.string().min(1, 'Description is required'),
  datatype: z.string().min(1, 'Datatype is required'),
  cardinality: z.string().min(1, 'Cardinality is required'),
})

export type PropertyFormData = z.infer<typeof propertySchema>

/**
 * Subobject entity schema.
 * Required: id, label, description
 * Optional: properties (relationship to properties)
 */
export const subobjectSchema = z.object({
  id: genericIdValidation,
  label: z.string().min(1, 'Label is required'),
  description: z.string().min(1, 'Description is required'),
  required_properties: z.array(z.string()).optional(),
  optional_properties: z.array(z.string()).optional(),
})

export type SubobjectFormData = z.infer<typeof subobjectSchema>

/**
 * Template entity schema.
 * Required: id, label, description, wikitext
 */
export const templateSchema = z.object({
  id: templateIdValidation,
  label: z.string().min(1, 'Label is required'),
  description: z.string().min(1, 'Description is required'),
  wikitext: z.string().min(1, 'Wikitext is required'),
})

export type TemplateFormData = z.infer<typeof templateSchema>

/**
 * Module entity base schema (without relationship validation).
 * Used for initial creation when entities will be added after.
 */
const moduleBaseSchema = z.object({
  id: genericIdValidation,
  version: z.string().min(1, 'Version is required'),
  label: z.string().min(1, 'Label is required'),
  description: z.string().min(1, 'Description is required'),
  categories: z.array(z.string()).optional(),
  properties: z.array(z.string()).optional(),
  subobjects: z.array(z.string()).optional(),
  templates: z.array(z.string()).optional(),
})

/**
 * Module creation schema (relaxed).
 * Allows creating module without entities - they can be added after.
 */
export const moduleCreateSchema = moduleBaseSchema

export type ModuleCreateFormData = z.infer<typeof moduleCreateSchema>

/**
 * Module entity schema (full validation).
 * Required: id, version, label, description
 * Requires at least one of: categories, properties, subobjects, templates
 */
export const moduleSchema = moduleBaseSchema.superRefine((data, ctx) => {
  const hasCategories = data.categories && data.categories.length > 0
  const hasProperties = data.properties && data.properties.length > 0
  const hasSubobjects = data.subobjects && data.subobjects.length > 0
  const hasTemplates = data.templates && data.templates.length > 0

  if (!hasCategories && !hasProperties && !hasSubobjects && !hasTemplates) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        'Module must include at least one of: categories, properties, subobjects, or templates',
      path: ['categories'], // Show error on first relationship field
    })
  }
})

export type ModuleFormData = z.infer<typeof moduleSchema>

/**
 * Bundle creation schema (relaxed).
 * Allows creating bundle without modules - they can be added after.
 */
export const bundleCreateSchema = z.object({
  id: genericIdValidation,
  version: z.string().min(1, 'Version is required'),
  label: z.string().min(1, 'Label is required'),
  description: z.string().min(1, 'Description is required'),
  modules: z.array(z.string()).optional(),
})

export type BundleCreateFormData = z.infer<typeof bundleCreateSchema>

/**
 * Bundle entity schema (full validation).
 * Required: id, version, label, description, modules (at least one)
 */
export const bundleSchema = z.object({
  id: genericIdValidation,
  version: z.string().min(1, 'Version is required'),
  label: z.string().min(1, 'Label is required'),
  description: z.string().min(1, 'Description is required'),
  modules: z.array(z.string()).min(1, 'At least one module is required'),
})

export type BundleFormData = z.infer<typeof bundleSchema>

/**
 * Dashboard page schema.
 * Each page has a name (empty string for root page) and wikitext content.
 */
const dashboardPageSchema = z.object({
  name: z.string(), // Empty string for root page
  wikitext: z.string(),
})

/**
 * Dashboard entity schema.
 * Required: id, label, description, pages (at least one)
 * Root page (empty name) should be included by default.
 */
export const dashboardSchema = z.object({
  id: genericIdValidation,
  label: z.string().min(1, 'Label is required'),
  description: z.string().min(1, 'Description is required'),
  pages: z.array(dashboardPageSchema).min(1, 'At least one page is required'),
})

export type DashboardFormData = z.infer<typeof dashboardSchema>
