import { z } from 'zod'

/**
 * Shared ID validation pattern for all entity types.
 * IDs must be kebab-case: lowercase letters, numbers, and hyphens only.
 */
const idValidation = z
  .string()
  .min(1, 'ID is required')
  .regex(
    /^[a-z0-9-]+$/,
    'ID must be lowercase letters, numbers, and hyphens only'
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
  properties: z.array(z.string()).optional(),
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
 * Module entity schema.
 * Required: id, version, label, description
 * Requires at least one of: categories, properties, subobjects, templates
 */
export const moduleSchema = z
  .object({
    id: idValidation,
    version: z.string().min(1, 'Version is required'),
    label: z.string().min(1, 'Label is required'),
    description: z.string().min(1, 'Description is required'),
    categories: z.array(z.string()).optional(),
    properties: z.array(z.string()).optional(),
    subobjects: z.array(z.string()).optional(),
    templates: z.array(z.string()).optional(),
  })
  .superRefine((data, ctx) => {
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
 * Bundle entity schema.
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
