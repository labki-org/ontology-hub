import { Outlet, Link } from 'react-router-dom'
import { SidebarV2 } from './SidebarV2'
import { DraftSelector } from '@/components/draft/DraftSelector'

/**
 * Main layout wrapper for v2 pages with updated component structure.
 *
 * Layout:
 * - SidebarV2 on left
 * - Content area on right with:
 *   - Header with DraftSelector
 *   - Outlet for page content (pages handle their own draft UI)
 */
export function MainLayoutV2() {
  return (
    <div className="flex min-h-screen">
      <SidebarV2 />

      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="border-b px-6 py-4 flex items-center justify-between bg-background">
          <Link to="/browse" className="font-semibold text-lg hover:opacity-80">
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
