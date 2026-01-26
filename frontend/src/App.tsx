import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { MainLayout } from '@/components/layout/MainLayout'
import { BrowsePage } from '@/pages/BrowsePage'

const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
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
