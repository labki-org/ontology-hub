import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { MainLayout } from '@/components/layout/MainLayout'
import { HomePage } from '@/pages/HomePage'
import { CategoryPage } from '@/pages/CategoryPage'
import { PropertyPage } from '@/pages/PropertyPage'
import { SubobjectPage } from '@/pages/SubobjectPage'

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
    ],
  },
])

function App() {
  return <RouterProvider router={router} />
}

export default App
