import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Boxes, Tag, Package, Layers, FolderTree, ChevronRight, Plus, Pencil, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { EditableField } from './EditableField'
import { ModuleAssignment } from './ModuleAssignment'
import { ValidationBadges } from './ValidationBadge'
import { useDraftStore } from '@/stores/draftStore'
import { computeDiff, flattenDelta, type FieldChange } from '@/lib/diff'
import type { VersionDiffResponse, ChangesByType, EntityChange, DraftValidationReport, ValidationResult } from '@/api/types'

interface DraftDiffViewerProps {
  diff: VersionDiffResponse
  editable?: boolean
  validationResults?: DraftValidationReport | null
}

interface EntityTypeSection {
  key: keyof Pick<
    VersionDiffResponse,
    'categories' | 'properties' | 'subobjects' | 'modules' | 'profiles'
  >
  label: string
  icon: typeof Boxes
}

const entityTypeSections: EntityTypeSection[] = [
  { key: 'categories', label: 'Categories', icon: Boxes },
  { key: 'properties', label: 'Properties', icon: Tag },
  { key: 'subobjects', label: 'Subobjects', icon: Package },
  { key: 'modules', label: 'Modules', icon: FolderTree },
  { key: 'profiles', label: 'Profiles', icon: Layers },
]

const variantConfig = {
  success: {
    icon: Plus,
    badgeClass: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    headerClass: 'text-green-700 dark:text-green-300',
  },
  warning: {
    icon: Pencil,
    badgeClass: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    headerClass: 'text-yellow-700 dark:text-yellow-300',
  },
  destructive: {
    icon: Trash2,
    badgeClass: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    headerClass: 'text-red-700 dark:text-red-300',
  },
}

function hasChanges(changes: ChangesByType): boolean {
  return (
    changes.added.length > 0 ||
    changes.modified.length > 0 ||
    changes.deleted.length > 0
  )
}

function getTotalChanges(changes: ChangesByType): number {
  return changes.added.length + changes.modified.length + changes.deleted.length
}

function getEntityLink(entityType: string, entityId: string): string {
  const typeMap: Record<string, string> = {
    categories: 'category',
    properties: 'property',
    subobjects: 'subobject',
    modules: 'module',
    profiles: 'profile',
  }
  const routeType = typeMap[entityType] || entityType
  return `/${routeType}/${entityId}`
}

function getEntityValidationResults(
  validationResults: DraftValidationReport | null | undefined,
  entityType: string,
  entityId: string
): ValidationResult[] {
  if (!validationResults) return []

  // Map plural entity type to singular for matching
  const typeMap: Record<string, string> = {
    categories: 'category',
    properties: 'property',
    subobjects: 'subobject',
    modules: 'module',
    profiles: 'profile',
  }
  const singularType = typeMap[entityType] || entityType

  const allResults = [
    ...validationResults.errors,
    ...validationResults.warnings,
    ...validationResults.info,
  ]

  return allResults.filter(
    (r) => r.entity_type === singularType && r.entity_id === entityId
  )
}

function FieldDiff({
  changes,
  editable,
  entityType,
  entityId,
}: {
  changes: FieldChange[]
  editable?: boolean
  entityType: string
  entityId: string
}) {
  const { getEditedValue } = useDraftStore()

  if (changes.length === 0) return null

  return (
    <div className="ml-4 mt-2 space-y-1 text-sm">
      {changes.map((change, idx) => {
        // Only allow editing "new" values on modified fields
        const canEdit = editable && change.type === 'modified'
        const editedValue = getEditedValue(entityType, entityId, change.path)
        const currentNewValue = editedValue !== undefined ? editedValue : change.newValue

        return (
          <div key={idx} className="flex items-start gap-2 font-mono text-xs">
            <span className="text-muted-foreground min-w-[120px] truncate">
              {change.path}:
            </span>
            {change.type === 'added' && (
              <span className="text-green-600 dark:text-green-400">
                + {JSON.stringify(change.newValue)}
              </span>
            )}
            {change.type === 'deleted' && (
              <span className="text-red-600 dark:text-red-400 line-through">
                - {JSON.stringify(change.oldValue)}
              </span>
            )}
            {change.type === 'modified' && (
              <span className="flex items-center gap-1 flex-wrap">
                <span className="text-red-600 dark:text-red-400 line-through">
                  {JSON.stringify(change.oldValue)}
                </span>
                {' -> '}
                {canEdit ? (
                  <EditableField
                    entityType={entityType}
                    entityId={entityId}
                    fieldName={change.path}
                    value={currentNewValue}
                    originalValue={change.newValue}
                    fieldType={typeof change.newValue === 'number' ? 'number' : 'text'}
                  />
                ) : (
                  <span className="text-green-600 dark:text-green-400">
                    {JSON.stringify(currentNewValue)}
                  </span>
                )}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

function AddedEntityItem({
  change,
  editable,
  entityType,
  parentCategories,
  validationResults,
}: {
  change: EntityChange
  editable?: boolean
  entityType: string
  parentCategories?: string[]
  validationResults?: DraftValidationReport | null
}) {
  const [isOpen, setIsOpen] = useState(false)
  const { getEditedValue } = useDraftStore()

  const newData = change.new || {}
  const editableFields = ['label', 'description']

  // Determine entity type for module assignment
  const moduleEntityType = entityType === 'categories' ? 'category'
    : entityType === 'properties' ? 'property'
    : entityType === 'subobjects' ? 'subobject'
    : null

  // Get validation results for this entity
  const entityValidation = getEntityValidationResults(validationResults, entityType, change.entity_id)

  return (
    <div className="py-1">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="flex items-center gap-2 hover:bg-accent rounded px-1 py-0.5 w-full text-left">
          <ChevronRight
            className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-90' : ''}`}
          />
          <Link
            to={getEntityLink(change.entity_type, change.entity_id)}
            className="text-sm hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {change.entity_id}
          </Link>
          <ValidationBadges results={entityValidation} compact />
          <Badge variant="outline" className="text-xs ml-auto bg-green-50 text-green-700">
            new
          </Badge>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="ml-4 mt-2 space-y-2 text-sm">
            {editableFields.map((field) => {
              const originalValue = newData[field]
              const editedValue = getEditedValue(entityType, change.entity_id, field)
              const currentValue = editedValue !== undefined ? editedValue : originalValue

              return (
                <div key={field} className="flex items-start gap-2">
                  <span className="text-muted-foreground min-w-[100px] font-medium">
                    {field}:
                  </span>
                  {editable ? (
                    <EditableField
                      entityType={entityType}
                      entityId={change.entity_id}
                      fieldName={field}
                      value={currentValue}
                      originalValue={originalValue}
                      fieldType={field === 'description' ? 'textarea' : 'text'}
                    />
                  ) : (
                    <span>{String(currentValue ?? '')}</span>
                  )}
                </div>
              )
            })}

            {/* Module assignment for entities (not modules/profiles themselves) */}
            {editable && moduleEntityType && (
              <div className="pt-2 border-t mt-2">
                <div className="text-muted-foreground font-medium mb-1">
                  Module Assignment:
                </div>
                <ModuleAssignment
                  entityId={change.entity_id}
                  entityType={moduleEntityType}
                  parentCategories={parentCategories}
                  entitySchema={moduleEntityType === 'category' ? {
                    parent: (newData.schema_definition as Record<string, unknown>)?.parent as string | undefined,
                    properties: (newData.schema_definition as Record<string, unknown>)?.properties as string[] | undefined,
                    subobjects: (newData.schema_definition as Record<string, unknown>)?.subobjects as string[] | undefined,
                  } : undefined}
                />
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

function EntityChangeItem({
  change,
  variant,
  editable,
  entityType,
  parentCategories,
  validationResults,
}: {
  change: EntityChange
  variant: 'success' | 'warning' | 'destructive'
  editable?: boolean
  entityType: string
  parentCategories?: string[]
  validationResults?: DraftValidationReport | null
}) {
  const [isOpen, setIsOpen] = useState(false)

  // For added entities, use special handler
  if (variant === 'success') {
    return (
      <AddedEntityItem
        change={change}
        editable={editable}
        entityType={entityType}
        parentCategories={parentCategories}
        validationResults={validationResults}
      />
    )
  }

  // For modified changes, compute field-level diff
  const fieldChanges: FieldChange[] =
    variant === 'warning' && change.old && change.new
      ? flattenDelta(computeDiff(change.old, change.new))
      : []

  const hasFieldChanges = fieldChanges.length > 0

  // Get validation results for this entity
  const entityValidation = getEntityValidationResults(validationResults, entityType, change.entity_id)

  return (
    <div className="py-1">
      {hasFieldChanges ? (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger className="flex items-center gap-2 hover:bg-accent rounded px-1 py-0.5 w-full text-left">
            <ChevronRight
              className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-90' : ''}`}
            />
            <Link
              to={getEntityLink(change.entity_type, change.entity_id)}
              className="text-sm hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {change.entity_id}
            </Link>
            <ValidationBadges results={entityValidation} compact />
            <Badge variant="outline" className="text-xs ml-auto">
              {fieldChanges.length} field{fieldChanges.length !== 1 ? 's' : ''} changed
            </Badge>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <FieldDiff
              changes={fieldChanges}
              editable={editable}
              entityType={entityType}
              entityId={change.entity_id}
            />
          </CollapsibleContent>
        </Collapsible>
      ) : (
        <div className="flex items-center gap-2 px-1 py-0.5">
          <Link
            to={getEntityLink(change.entity_type, change.entity_id)}
            className="text-sm hover:underline"
          >
            {change.entity_id}
          </Link>
          <ValidationBadges results={entityValidation} compact />
        </div>
      )}
    </div>
  )
}

function ChangeGroup({
  title,
  changes,
  variant,
  editable,
  entityType,
  parentCategories,
  validationResults,
}: {
  title: string
  changes: EntityChange[]
  variant: 'success' | 'warning' | 'destructive'
  editable?: boolean
  entityType: string
  parentCategories?: string[]
  validationResults?: DraftValidationReport | null
}) {
  const [isOpen, setIsOpen] = useState(true)
  const config = variantConfig[variant]
  const Icon = config.icon

  if (changes.length === 0) return null

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 hover:bg-accent/50 rounded px-2">
        <ChevronRight
          className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-90' : ''}`}
        />
        <Icon className={`h-4 w-4 ${config.headerClass}`} />
        <span className={`font-medium ${config.headerClass}`}>{title}</span>
        <Badge className={`ml-auto ${config.badgeClass}`}>{changes.length}</Badge>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-6 border-l pl-4 py-1">
          {changes.map((change) => (
            <EntityChangeItem
              key={change.key}
              change={change}
              variant={variant}
              editable={editable}
              entityType={entityType}
              parentCategories={parentCategories}
              validationResults={validationResults}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function EntityTypeCard({
  label,
  icon: Icon,
  changes,
  editable,
  entityType,
  allCategoryIds,
  validationResults,
}: {
  label: string
  icon: typeof Boxes
  changes: ChangesByType
  editable?: boolean
  entityType: string
  allCategoryIds?: string[]
  validationResults?: DraftValidationReport | null
}) {
  if (!hasChanges(changes)) return null

  // For properties/subobjects, they need parent category IDs
  // In a real scenario, this would come from the entity's schema_definition
  // For now, we pass all categories as potential parents
  const parentCategories = (entityType === 'properties' || entityType === 'subobjects')
    ? allCategoryIds
    : undefined

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Icon className="h-5 w-5" />
          {label}
          <span className="text-muted-foreground font-normal text-sm ml-auto">
            {getTotalChanges(changes)} change{getTotalChanges(changes) !== 1 ? 's' : ''}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <ChangeGroup
          title="Added"
          changes={changes.added}
          variant="success"
          editable={editable}
          entityType={entityType}
          parentCategories={parentCategories}
          validationResults={validationResults}
        />
        <ChangeGroup
          title="Modified"
          changes={changes.modified}
          variant="warning"
          editable={editable}
          entityType={entityType}
          parentCategories={parentCategories}
          validationResults={validationResults}
        />
        <ChangeGroup
          title="Deleted"
          changes={changes.deleted}
          variant="destructive"
          editable={false}
          entityType={entityType}
          validationResults={validationResults}
        />
      </CardContent>
    </Card>
  )
}

export function DraftDiffViewer({ diff, editable = false, validationResults }: DraftDiffViewerProps) {
  const totalChanges = entityTypeSections.reduce(
    (sum, section) => sum + getTotalChanges(diff[section.key]),
    0
  )

  // Collect all category IDs for parent lookup
  const allCategoryIds = [
    ...diff.categories.added.map((c) => c.entity_id),
    ...diff.categories.modified.map((c) => c.entity_id),
  ]

  if (totalChanges === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No changes in this draft
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {entityTypeSections.map(({ key, label, icon }) => (
        <EntityTypeCard
          key={key}
          label={label}
          icon={icon}
          changes={diff[key]}
          editable={editable}
          entityType={key}
          allCategoryIds={allCategoryIds}
          validationResults={validationResults}
        />
      ))}
    </div>
  )
}
