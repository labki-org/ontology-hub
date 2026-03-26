import { useState, useCallback } from 'react'
import { Outlet, Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Sidebar } from './Sidebar'
import { SyncStatusIndicator } from './SyncStatusIndicator'
import { SyncBanner } from './SyncBanner'
import { DraftSelector } from '@/components/draft/DraftSelector'

/**
 * Main layout wrapper with sidebar and content area.
 *
 * Layout:
 * - Sidebar on left
 * - Content area on right with:
 *   - Header with sync status indicator and DraftSelector
 *   - Optional sync banner when DB updates
 *   - Outlet for page content (pages handle their own draft UI)
 */
export function MainLayout() {
  const [showBanner, setShowBanner] = useState(false)
  const [resetKey, setResetKey] = useState(0)
  const queryClient = useQueryClient()

  const handleStaleDetected = useCallback(() => {
    setShowBanner(true)
  }, [])

  const handleRefresh = useCallback(() => {
    setResetKey((k) => k + 1)
    queryClient.invalidateQueries()
    setShowBanner(false)
  }, [queryClient])

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="border-b px-6 py-4 flex items-center justify-between bg-background">
          <div className="flex items-center gap-4">
            <Link to="/" className="font-semibold text-lg hover:opacity-80">
              Browse
            </Link>
            <SyncStatusIndicator
              onStaleDetected={handleStaleDetected}
              resetKey={resetKey}
            />
          </div>
          <DraftSelector />
        </header>

        {/* Sync update banner */}
        {showBanner && (
          <SyncBanner
            onRefresh={handleRefresh}
            onDismiss={() => setShowBanner(false)}
          />
        )}

        {/* Page content */}
        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
