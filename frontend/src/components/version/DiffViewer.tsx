import { Boxes, Tag, Package, Layers, FolderTree } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChangeGroup } from './ChangeGroup'
import type { VersionDiffResponse, ChangesByType } from '@/api/types'

interface DiffViewerProps {
  diff: VersionDiffResponse
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

function EntityTypeCard({
  label,
  icon: Icon,
  changes,
}: {
  label: string
  icon: typeof Boxes
  changes: ChangesByType
}) {
  if (!hasChanges(changes)) return null

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
        />
        <ChangeGroup
          title="Modified"
          changes={changes.modified}
          variant="warning"
        />
        <ChangeGroup
          title="Deleted"
          changes={changes.deleted}
          variant="destructive"
        />
      </CardContent>
    </Card>
  )
}

export function DiffViewer({ diff }: DiffViewerProps) {
  const totalChanges = entityTypeSections.reduce(
    (sum, section) => sum + getTotalChanges(diff[section.key]),
    0
  )

  if (totalChanges === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No changes between these versions
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
        />
      ))}
    </div>
  )
}
