import { RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface SyncBannerProps {
  onRefresh: () => void
  onDismiss: () => void
}

export function SyncBanner({ onRefresh, onDismiss }: SyncBannerProps) {
  return (
    <div className="border-b bg-blue-50 dark:bg-blue-950/30 px-6 py-2 flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm text-blue-800 dark:text-blue-200">
        <RefreshCw className="h-3.5 w-3.5" />
        <span>Ontology data has been updated.</span>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onRefresh} className="h-7 text-xs">
          Refresh
        </Button>
        <button
          onClick={onDismiss}
          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
