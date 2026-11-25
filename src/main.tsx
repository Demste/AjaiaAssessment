import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import { App } from './workspace'
import { Dashboard } from './dashboard'
import { DocumentPage } from './document'
import './styles.css'

const router = createBrowserRouter([{
  element: <App />,
  children: [
    { index: true, element: <Dashboard /> },
    { path: 'documents/:id', element: <DocumentPage /> },
    { path: '*', element: <Navigate to="/" replace /> },
  ],
}])

createRoot(document.getElementById('root')!).render(<RouterProvider router={router} />)
