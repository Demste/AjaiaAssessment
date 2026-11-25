import { useEffect, useState } from 'react'
import { Outlet, useLocation, useOutletContext } from 'react-router-dom'
import type { User } from '../shared/contracts'
import { api, errorMessage } from './api'
import { Brand, ErrorNotice, Loading } from './components'

const USER_KEY = 'workspace.demo-user'

function storedUser(): string | null {
  try {
    return localStorage.getItem(USER_KEY)
  } catch {
    return null
  }
}

interface WorkspaceContext {
  users: User[]
  user: User
  selectUser: (id: string) => void
}

export function useWorkspace() {
  return useOutletContext<WorkspaceContext>()
}

export function App() {
  const [users, setUsers] = useState<User[]>([])
  const [selected, setSelected] = useState(storedUser)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const { pathname } = useLocation()

  useEffect(() => {
    const controller = new AbortController()
    api.users(controller.signal).then((result) => {
      if (controller.signal.aborted) return
      if (!result.length) {
        setError('No demo users are available.')
        return
      }
      setUsers(result)
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setError(errorMessage(error))
    })
    return () => controller.abort()
  }, [attempt])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  function selectUser(id: string) {
    setSelected(id)
    try {
      localStorage.setItem(USER_KEY, id)
    } catch {
      // The selection still works for this tab when storage is unavailable.
    }
  }

  const user = users.find((candidate) => candidate.id === selected) ?? users[0]
  if (!user) {
    return (
      <main className="bootstrap">
        <Brand />
        {error ? <ErrorNotice message={error} onRetry={() => { setError(''); setAttempt(attempt + 1) }} />
          : <Loading text="Opening Workspace…" />}
      </main>
    )
  }
  return <Outlet context={{ users, user, selectUser } satisfies WorkspaceContext} />
}
