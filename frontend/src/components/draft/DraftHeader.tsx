import { ExternalLink, Globe, GitBranch, Calendar, Clock, AlertCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { DraftPublic } from '@/api/types'

interface DraftHeaderProps {
  draft: DraftPublic
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getTimeRemaining(expiresAt: string): {
  text: string
  urgency: 'normal' | 'warning' | 'critical'
} {
  const now = new Date()
  const expiry = new Date(expiresAt)
  const diffMs = expiry.getTime() - now.getTime()

  if (diffMs <= 0) {
    return { text: 'Expired', urgency: 'critical' }
  }

  const diffHours = diffMs / (1000 * 60 * 60)
  const diffDays = diffHours / 24

  if (diffHours < 1) {
    const minutes = Math.floor(diffMs / (1000 * 60))
    return { text: `${minutes}m remaining`, urgency: 'critical' }
  }

  if (diffHours < 24) {
    const hours = Math.floor(diffHours)
    return { text: `${hours}h remaining`, urgency: 'warning' }
  }

  const days = Math.floor(diffDays)
  return { text: `${days}d remaining`, urgency: 'normal' }
}

function StatusBadge({ status }: { status: DraftPublic['status'] }) {
  const variants: Record<
    DraftPublic['status'],
    { className: string; label: string }
  > = {
    pending: {
      className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      label: 'Pending Review',
    },
    validated: {
      className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      label: 'Validated',
    },
    submitted: {
      className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      label: 'Submitted',
    },
    expired: {
      className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      label: 'Expired',
    },
  }

  const { className, label } = variants[status]

  return (
    <Badge className={className} variant="outline">
      {label}
    </Badge>
  )
}

export function DraftHeader({ draft }: DraftHeaderProps) {
  const timeRemaining = getTimeRemaining(draft.expires_at)

  const urgencyColors = {
    normal: 'text-muted-foreground',
    warning: 'text-yellow-600 dark:text-yellow-400',
    critical: 'text-red-600 dark:text-red-400',
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          {/* Left: Wiki info */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Source Wiki:</span>
              <a
                href={draft.source_wiki || draft.payload.wiki_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                {draft.source_wiki || draft.payload.wiki_url}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            <div className="flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Base Version:</span>
              <code className="text-sm bg-muted px-2 py-0.5 rounded">
                {draft.base_commit_sha || draft.payload.base_version}
              </code>
            </div>

            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Created:</span>
              <span className="text-sm text-muted-foreground">
                {formatDate(draft.created_at)}
              </span>
            </div>
          </div>

          {/* Right: Status and expiration */}
          <div className="flex flex-col items-end gap-2">
            <StatusBadge status={draft.status} />

            <div className="flex items-center gap-2">
              {timeRemaining.urgency !== 'normal' && (
                <AlertCircle
                  className={`h-4 w-4 ${urgencyColors[timeRemaining.urgency]}`}
                />
              )}
              <Clock
                className={`h-4 w-4 ${
                  timeRemaining.urgency === 'normal'
                    ? 'text-muted-foreground'
                    : urgencyColors[timeRemaining.urgency]
                }`}
              />
              <span
                className={`text-sm ${urgencyColors[timeRemaining.urgency]}`}
              >
                {timeRemaining.text}
              </span>
            </div>

            <span className="text-xs text-muted-foreground">
              Expires: {formatDate(draft.expires_at)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
