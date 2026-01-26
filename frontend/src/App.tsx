import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { MainLayoutV2 } from '@/components/layout/MainLayoutV2'
import { BrowsePage } from '@/pages/BrowsePage'

const router = createBrowserRouter([
  {
    path: '/',
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
