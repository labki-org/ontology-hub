import { useEffect, useRef } from 'react'
import { Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useSyncStatus } from '@/api/entities'

interface SyncStatusIndicatorProps {
  onStaleDetected: () => void
  /** Increment to reset the loaded SHA baseline (e.g. after user clicks Refresh) */
  resetKey: number
}

function StatusBadge({ syncState }: { syncState: string }) {
  switch (syncState) {
    case 'synced':
      return (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800">
          Synced
        </Badge>
      )
    case 'syncing':
      return (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800">
          <Loader2 className="h-2.5 w-2.5 animate-spin mr-0.5" />
          Syncing
        </Badge>
      )
    case 'behind':
      return (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800">
          Updating
        </Badge>
      )
    case 'error':
      return (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800">
          Offline
        </Badge>
      )
    default:
      return (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
          Unknown
        </Badge>
      )
  }
}

export function SyncStatusIndicator({ onStaleDetected, resetKey }: SyncStatusIndicatorProps) {
  const { data, isError } = useSyncStatus()
  const loadedSha = useRef<string | null>(null)
  const prevResetKey = useRef(resetKey)

  // Reset baseline SHA when resetKey changes (user clicked Refresh)
  useEffect(() => {
    if (resetKey !== prevResetKey.current) {
      prevResetKey.current = resetKey
      loadedSha.current = data?.db_commit_sha ?? null
    }
  }, [resetKey, data?.db_commit_sha])

  // Track the SHA we loaded with
  useEffect(() => {
    if (data?.db_commit_sha && loadedSha.current === null) {
      loadedSha.current = data.db_commit_sha
    }
  }, [data?.db_commit_sha])

  // Detect stale data
  useEffect(() => {
    if (
      data?.db_commit_sha &&
      loadedSha.current !== null &&
      data.db_commit_sha !== loadedSha.current
    ) {
      onStaleDetected()
    }
  }, [data?.db_commit_sha, onStaleDetected])

  if (isError || !data) {
    return null
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <a
        href={data.repo_url}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:underline hover:text-foreground transition-colors"
      >
        {data.repo_name}
      </a>
      {data.db_commit_sha && (
        <>
          <span className="text-muted-foreground/50">/</span>
          <a
            href={data.db_commit_url ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono hover:underline hover:text-foreground transition-colors"
          >
            {data.db_commit_sha.slice(0, 7)}
          </a>
        </>
      )}
      <StatusBadge syncState={data.sync_state} />
    </div>
  )
}
