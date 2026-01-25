import { z } from 'zod'

// Shared ID validation: lowercase letters, numbers, and hyphens only
const idSchema = z
  .string()
  .min(1, 'ID is required')
  .regex(/^[a-z0-9-]+$/, 'ID must be lowercase letters, numbers, and hyphens only')

// Shared required string validation
const requiredString = (fieldName: string) =>
  z.string().min(1, `${fieldName} is required`)

// Category schema - basic entity with optional parent relationships
export const categorySchema = z.object({
  id: idSchema,
  label: requiredString('Label'),
  description: requiredString('Description'),
  parents: z.array(z.string()).optional(),
})

export type CategoryFormData = z.infer<typeof categorySchema>

// Property schema - includes datatype and cardinality
export const propertySchema = z.object({
  id: idSchema,
  label: requiredString('Label'),
  description: requiredString('Description'),
  datatype: requiredString('Datatype'),
  cardinality: requiredString('Cardinality'),
})

export type PropertyFormData = z.infer<typeof propertySchema>

// Subobject schema - basic entity with optional property relationships
export const subobjectSchema = z.object({
  id: idSchema,
  label: requiredString('Label'),
  description: requiredString('Description'),
  properties: z.array(z.string()).optional(),
})

export type SubobjectFormData = z.infer<typeof subobjectSchema>

// Template schema - includes wikitext
export const templateSchema = z.object({
  id: idSchema,
  label: requiredString('Label'),
  description: requiredString('Description'),
  wikitext: requiredString('Wikitext'),
})

export type TemplateFormData = z.infer<typeof templateSchema>

// Module schema - requires at least one of categories/properties/subobjects/templates
export const moduleSchema = z
  .object({
    id: idSchema,
    version: requiredString('Version'),
    label: requiredString('Label'),
    description: requiredString('Description'),
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
        message: 'At least one category, property, subobject, or template is required',
        path: ['categories'],
      })
    }
  })

export type ModuleFormData = z.infer<typeof moduleSchema>

// Bundle schema - requires at least one module
export const bundleSchema = z.object({
  id: idSchema,
  version: requiredString('Version'),
  label: requiredString('Label'),
  description: requiredString('Description'),
  modules: z.array(z.string()).min(1, 'At least one module is required'),
})

export type BundleFormData = z.infer<typeof bundleSchema>
