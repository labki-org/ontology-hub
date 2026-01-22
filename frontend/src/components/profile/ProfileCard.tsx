import { Link } from 'react-router-dom'
import { Layers } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { ProfilePublic } from '@/api/types'

interface ProfileCardProps {
  profile: ProfilePublic
}

/**
 * Card component for displaying a profile in list views.
 * Shows label, module count, and module preview.
 */
export function ProfileCard({ profile }: ProfileCardProps) {
  const moduleCount = profile.module_ids?.length || 0
  const previewModules = profile.module_ids?.slice(0, 3) || []
  const hasMoreModules = moduleCount > 3

  return (
    <Link to={`/profile/${profile.profile_id}`}>
      <Card className="h-full hover:bg-accent/50 transition-colors cursor-pointer">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-muted-foreground" />
              <CardTitle>{profile.label}</CardTitle>
            </div>
            <Badge variant="outline">
              {moduleCount} {moduleCount === 1 ? 'module' : 'modules'}
            </Badge>
          </div>
          {profile.description && (
            <CardDescription className="line-clamp-2">
              {profile.description}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {/* Module preview */}
          {previewModules.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {previewModules.map((modId) => (
                <Badge key={modId} variant="secondary" className="text-xs">
                  {modId}
                </Badge>
              ))}
              {hasMoreModules && (
                <Badge variant="secondary" className="text-xs">
                  +{moduleCount - 3} more
                </Badge>
              )}
            </div>
          )}
          {previewModules.length === 0 && (
            <p className="text-sm text-muted-foreground italic">No modules</p>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
