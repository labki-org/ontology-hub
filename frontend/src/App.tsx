import { useEffect } from 'react'
import { createBrowserRouter, RouterProvider, useLocation, useNavigate } from 'react-router-dom'
import { MainLayout } from '@/components/layout/MainLayout'
import { MainLayoutV2 } from '@/components/layout/MainLayoutV2'
import { HomePage } from '@/pages/HomePage'
import { BrowsePage } from '@/pages/BrowsePage'
import { CategoryPage } from '@/pages/CategoryPage'
import { PropertyPage } from '@/pages/PropertyPage'
import { SubobjectPage } from '@/pages/SubobjectPage'
import { SearchPage } from '@/pages/SearchPage'
import { GraphExplorerPage } from '@/pages/GraphExplorerPage'
import { ModulesPage } from '@/pages/ModulesPage'
import { ModulePage } from '@/pages/ModulePage'
import { ProfilesPage } from '@/pages/ProfilesPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { VersionsPage } from '@/pages/VersionsPage'
import { DraftPage } from '@/pages/DraftPage'

/**
 * Handles /drafts#{token} capability URLs by extracting the token from
 * the fragment and redirecting to /draft/{token}.
 *
 * Fragment (#) is not sent to server, so we capture it client-side
 * to reduce referrer leakage of capability tokens.
 */
function DraftCapabilityHandler() {
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    // Extract token from hash (e.g., #abc123 -> abc123)
    const token = location.hash.slice(1)

    if (token) {
      // Redirect to draft page with token as path param
      navigate(`/draft/${token}`, { replace: true })
    }
  }, [location.hash, navigate])

  // Show nothing while redirecting
  return null
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: 'search',
        element: <SearchPage />,
      },
      {
        path: 'category/:entityId',
        element: <CategoryPage />,
      },
      {
        path: 'property/:entityId',
        element: <PropertyPage />,
      },
      {
        path: 'subobject/:entityId',
        element: <SubobjectPage />,
      },
      {
        path: 'graph/:entityId',
        element: <GraphExplorerPage />,
      },
      {
        path: 'modules',
        element: <ModulesPage />,
      },
      {
        path: 'module/:moduleId',
        element: <ModulePage />,
      },
      {
        path: 'profiles',
        element: <ProfilesPage />,
      },
      {
        path: 'profile/:profileId',
        element: <ProfilePage />,
      },
      {
        path: 'versions',
        element: <VersionsPage />,
      },
      {
        path: 'drafts',
        element: <DraftCapabilityHandler />,
      },
      {
        path: 'draft/:token',
        element: <DraftPage />,
      },
    ],
  },
  {
    path: '/browse',
    element: <MainLayoutV2 />,
    children: [
      {
        index: true,
        element: <BrowsePage />,
      },
    ],
  },
])

function App() {
  return <RouterProvider router={router} />
}

export default App
