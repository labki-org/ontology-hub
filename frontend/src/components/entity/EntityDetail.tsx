import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import type { EntityPublic } from '@/api/types'

interface EntityDetailProps {
  entity: EntityPublic
}

export function EntityDetail({ entity }: EntityDetailProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-2xl">{entity.label}</CardTitle>
            <p className="text-sm text-muted-foreground font-mono mt-1">
              {entity.entity_id}
            </p>
          </div>
          <Badge variant="outline" className="capitalize">
            {entity.entity_type}
          </Badge>
        </div>
      </CardHeader>
      {entity.description && (
        <CardContent>
          <p className="text-muted-foreground">{entity.description}</p>
        </CardContent>
      )}
      <CardFooter className="text-xs text-muted-foreground">
        <div className="flex gap-4">
          {entity.commit_sha && (
            <span>Commit: {entity.commit_sha.slice(0, 7)}</span>
          )}
          <span>
            Updated: {new Date(entity.updated_at).toLocaleDateString()}
          </span>
        </div>
      </CardFooter>
    </Card>
  )
}
