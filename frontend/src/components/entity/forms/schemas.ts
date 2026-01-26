import { z } from 'zod'

/**
 * Shared ID validation pattern for all entity types.
 * IDs follow MediaWiki page title format: starts with uppercase letter,
 * followed by lowercase letters, with underscores separating words.
 * Examples: "Person", "Has_property", "Located_in_city"
 */
const idValidation = z
  .string()
  .min(1, 'ID is required')
  .regex(
    /^[A-Z][a-z]*(_[a-z]+)*$/,
    'ID must start with uppercase letter, use underscores between words (e.g., Has_property)'
  )

/**
 * Category entity schema.
 * Required: id, label, description
 * Optional: parents (relationship to other categories)
 */
export const categorySchema = z.object({
  id: idValidation,
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
  id: idValidation,
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
  id: idValidation,
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
  id: idValidation,
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
  id: idValidation,
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
  id: idValidation,
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
  id: idValidation,
  version: z.string().min(1, 'Version is required'),
  label: z.string().min(1, 'Label is required'),
  description: z.string().min(1, 'Description is required'),
  modules: z.array(z.string()).min(1, 'At least one module is required'),
})

export type BundleFormData = z.infer<typeof bundleSchema>
