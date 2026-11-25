import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { FilePlus2, Files, FileText, FolderOpen, Plus, Trash2, Upload, UsersRound } from 'lucide-react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import type { DocumentRecord, DocumentSummary } from '../shared/contracts'
import { api, errorMessage } from './api'
import { Avatar, Brand, ErrorNotice, Loading, UserSelector } from './components'
import { useWorkspace } from './workspace'

const dateFormat = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' })
const timestampFormat = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' })

export function Dashboard() {
  const { user } = useWorkspace()
  return <DocumentLibrary key={user.id} />
}

function DocumentLibrary() {
  const { user, users, selectUser } = useWorkspace()
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const shared = params.get('view') === 'shared'
  const title = shared ? 'Shared with Me' : 'My Documents'
  const fileInput = useRef<HTMLInputElement>(null)
  const libraryHeading = useRef<HTMLHeadingElement>(null)
  const active = useRef(false)
  const [documents, setDocuments] = useState<DocumentSummary[] | null>(null)
  const [listError, setListError] = useState('')
  const [actionError, setActionError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [pending, setPending] = useState<'create' | 'import' | 'delete' | null>(null)

  useEffect(() => {
    active.current = true
    return () => { active.current = false }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    api.documents(user.id, controller.signal).then((result) => {
      if (!controller.signal.aborted) setDocuments(result)
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setListError(errorMessage(error))
    })
    return () => controller.abort()
  }, [user.id, attempt])

  async function addDocument(action: 'create' | 'import', operation: () => Promise<DocumentRecord>) {
    setPending(action)
    setActionError('')
    try {
      const document = await operation()
      if (active.current) void navigate(`/documents/${document.id}`, { state: { returnTo: '/' } })
    } catch (error) {
      if (active.current) setActionError(errorMessage(error))
    } finally {
      if (active.current) setPending(null)
    }
  }

  const create = () => { void addDocument('create', () => api.create(user.id)) }
  function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) void addDocument('import', () => api.import(user.id, file))
  }

  async function deleteDocument(document: DocumentSummary) {
    if (pending) return
    if (!window.confirm(`Delete “${document.title}”? This permanently deletes the document and removes collaborator access.`)) return

    setPending('delete')
    setActionError('')
    try {
      await api.remove(user.id, document.id)
      if (active.current) {
        setDocuments((current) => current?.filter(({ id }) => id !== document.id) ?? null)
        libraryHeading.current?.focus()
      }
    } catch (error) {
      if (active.current) setActionError(`Could not delete “${document.title}”. ${errorMessage(error)}`)
    } finally {
      if (active.current) setPending(null)
    }
  }

  const visible = documents?.filter((document) => document.access === (shared ? 'editor' : 'owner'))

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <Brand link />
        <nav className="sidebar-nav" aria-label="Document views">
          <Link to="/" className="nav-item" aria-current={!shared ? 'page' : undefined}>
            <Files size={19} aria-hidden="true" /> My Documents
          </Link>
          <Link to="/?view=shared" className="nav-item" aria-current={shared ? 'page' : undefined}>
            <UsersRound size={19} aria-hidden="true" /> Shared with Me
          </Link>
        </nav>
      </aside>

      <div className="dashboard-body">
        <header className="topbar">
          <span className="topbar-context"><FolderOpen size={18} aria-hidden="true" /> Documents</span>
          <UserSelector user={user} users={users} onChange={selectUser} disabled={pending !== null} />
        </header>
        <main className="library" aria-labelledby="library-title">
          <div className="library-heading">
            <div>
              <h1 id="library-title" ref={libraryHeading} tabIndex={-1}>{title}</h1>
              <p>{shared ? 'Documents you have been invited to edit.' : 'Documents you own and can share.'}</p>
            </div>
            <div className="library-actions">
              <button className="button button-secondary" onClick={() => fileInput.current?.click()} disabled={pending !== null} aria-describedby="import-hint">
                <Upload size={17} aria-hidden="true" />{pending === 'import' ? 'Importing…' : 'Import TXT'}
              </button>
              <input hidden ref={fileInput} type="file" accept=".txt,text/plain" onChange={importFile} />
              <button className="button button-primary" onClick={create} disabled={pending !== null}>
                <Plus size={19} aria-hidden="true" />{pending === 'create' ? 'Creating…' : 'New Document'}
              </button>
              <p id="import-hint">UTF-8 .txt files up to 1 MB</p>
            </div>
          </div>
          {actionError && <ErrorNotice message={actionError} />}
          {listError ? (
            <ErrorNotice message={listError} onRetry={() => { setListError(''); setAttempt(attempt + 1) }} />
          ) : (
            <section className={shared ? 'document-list' : 'document-list owned-documents'}
              aria-label={title} aria-busy={visible === undefined || pending === 'delete'}>
              <div className="document-list-header" aria-hidden="true">
                <span>Name</span><span>Owner</span><span>Last updated</span>
              </div>
              {visible === undefined ? <Loading text="Loading documents…" /> : visible.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-icon">
                    {shared ? <UsersRound size={30} aria-hidden="true" /> : <FilePlus2 size={30} aria-hidden="true" />}
                  </span>
                  <h2>{shared ? 'No shared documents' : 'No documents yet'}</h2>
                  <p>{shared ? 'Documents will appear here when another user shares them with you.'
                    : 'Start a blank document or import a TXT file to get writing.'}</p>
                  {!shared && <button className="button button-secondary empty-action" onClick={create} disabled={pending !== null}>
                    <Plus size={17} aria-hidden="true" />{pending === 'create' ? 'Creating…' : 'Create a document'}
                  </button>}
                </div>
              ) : (
                <ul className="document-rows">
                  {visible.map((document) => (
                    <li key={document.id}>
                      <Link
                        className="document-row"
                        to={`/documents/${document.id}`}
                        state={{ returnTo: location.pathname + location.search }}
                      >
                        <span className="document-name"><span className="file-icon"><FileText size={19} aria-hidden="true" /></span><strong>{document.title}</strong></span>
                        <span className="document-owner"><Avatar user={document.owner} small />{document.owner.name}</span>
                        <time dateTime={document.updatedAt} title={timestampFormat.format(new Date(document.updatedAt))}>{dateFormat.format(new Date(document.updatedAt))}</time>
                      </Link>
                      {!shared && document.access === 'owner' && (
                        <button type="button" className="icon-button document-delete" title="Delete document"
                          aria-label={`Delete ${document.title}`} disabled={pending !== null}
                          onClick={() => { void deleteDocument(document) }}>
                          <Trash2 size={17} aria-hidden="true" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </main>
      </div>
    </div>
  )
}
