import { Outlet, Link } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { DraftSelector } from '@/components/draft/DraftSelector'

/**
 * Main layout wrapper with sidebar and content area.
 *
 * Layout:
 * - Sidebar on left
 * - Content area on right with:
 *   - Header with DraftSelector
 *   - Outlet for page content (pages handle their own draft UI)
 */
export function MainLayout() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="border-b px-6 py-4 flex items-center justify-between bg-background">
          <Link to="/" className="font-semibold text-lg hover:opacity-80">
            Browse
          </Link>
          <DraftSelector />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
