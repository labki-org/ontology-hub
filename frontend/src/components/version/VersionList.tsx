import { GitBranch, Calendar } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { ReleasePublic } from '@/api/types'

interface VersionListProps {
  releases: ReleasePublic[]
  selected?: string
  onSelect: (tagName: string) => void
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function VersionList({ releases, selected, onSelect }: VersionListProps) {
  if (releases.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No releases found in this repository
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <GitBranch className="h-5 w-5" />
          All Releases
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {releases.map((release, index) => (
            <button
              key={release.tag_name}
              onClick={() => onSelect(release.tag_name)}
              className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                selected === release.tag_name
                  ? 'bg-accent'
                  : 'hover:bg-accent/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant={index === 0 ? 'default' : 'outline'}>
                    {release.tag_name}
                  </Badge>
                  {release.name && release.name !== release.tag_name && (
                    <span className="text-sm text-muted-foreground truncate max-w-[200px]">
                      {release.name}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {formatDate(release.published_at || release.created_at)}
                </div>
              </div>
              {release.body && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                  {release.body}
                </p>
              )}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
