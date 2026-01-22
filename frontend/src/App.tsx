import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { MainLayout } from '@/components/layout/MainLayout'
import { HomePage } from '@/pages/HomePage'
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
    ],
  },
])

function App() {
  return <RouterProvider router={router} />
}

export default App
