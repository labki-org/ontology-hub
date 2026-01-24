import { Outlet, Link, useSearchParams } from 'react-router-dom'
import { SidebarV2 } from './SidebarV2'
import { DraftBanner } from '@/components/draft/DraftBanner'
import { DraftSelector } from '@/components/draft/DraftSelector'
import { useDraft } from '@/api/drafts'

/**
 * Main layout wrapper for v2 pages with updated component structure.
 *
 * Layout:
 * - SidebarV2 on left
 * - Content area on right with:
 *   - Header with DraftSelector
 *   - DraftBanner at top (conditional on draft_id)
 *   - Outlet for page content
 */
export function MainLayoutV2() {
  const [searchParams] = useSearchParams()
  const draftId = searchParams.get('draft_id') || undefined

  // Fetch draft info if in draft mode
  const { data: draft } = useDraft(draftId)

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

        {/* Draft banner (conditional) */}
        {draft && (
          <DraftBanner
            draft={draft}
            onExit={() => {
              // Exit handled by DraftBanner internal navigation
            }}
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
