import { EditorContent, useEditor } from '@tiptap/react'
import { AlertCircle, Check, Circle, LayoutGrid, LoaderCircle, Pencil, Save, UserRound, UsersRound } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useBlocker, useLocation, useNavigate, useParams } from 'react-router-dom'
import { DEFAULT_TITLE, MAX_TITLE_LENGTH } from '../shared/contracts'
import type { DocumentPatch, DocumentRecord } from '../shared/contracts'
import { editorExtensions } from '../shared/editor'
import { api, errorMessage } from './api'
import { ErrorNotice, Loading, UserSelector } from './components'
import { ExportMenu } from './export-menu'
import { FormattingToolbar } from './formatting'
import { ShareDialog } from './share-dialog'
import { useWorkspace } from './workspace'

const discardMessage = 'You have unsaved changes. Leave this document and discard them?'

export function DocumentPage() {
  const { id = '' } = useParams()
  const { user } = useWorkspace()
  return <OpenDocument key={`${user.id}:${id}`} id={id} />
}

function EditorHeader({ returnTo, onSwitch }: { returnTo: string; onSwitch: (id: string) => void }) {
  const { user, users } = useWorkspace()
  return (
    <header className="editor-header">
      <Link className="back-link" to={returnTo}><LayoutGrid size={18} aria-hidden="true" /> Back to dashboard</Link>
      <UserSelector user={user} users={users} onChange={onSwitch} />
    </header>
  )
}

function OpenDocument({ id }: { id: string }) {
  const { user, selectUser } = useWorkspace()
  const navigate = useNavigate()
  const location = useLocation()
  const [document, setDocument] = useState<DocumentRecord | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    api.document(user.id, id, controller.signal).then((result) => {
      if (!controller.signal.aborted) setDocument(result)
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setError(errorMessage(error))
    })
    return () => controller.abort()
  }, [id, user.id, attempt])

  const previousView = location.state?.returnTo
  const returnTo = previousView === '/' || previousView === '/?view=shared'
    ? previousView
    : document?.access === 'editor' ? '/?view=shared' : '/'

  if (document) return <DocumentEditor document={document} returnTo={returnTo} />
  return (
    <div className="editor-page">
      <EditorHeader returnTo={returnTo} onSwitch={(id) => { selectUser(id); void navigate('/', { replace: true }) }} />
      <main className="editor-main">
        {error ? <ErrorNotice message={error} onRetry={() => { setError(''); setAttempt(attempt + 1) }} />
          : <Loading text="Opening document…" />}
      </main>
    </div>
  )
}

function DocumentEditor({ document, returnTo }: { document: DocumentRecord; returnTo: string }) {
  const { user, users, selectUser } = useWorkspace()
  const navigate = useNavigate()
  const owner = document.access === 'owner'
  const [title, setTitle] = useState(document.title)
  const [savedTitle, setSavedTitle] = useState(document.title)
  const [contentDirty, setContentDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [showShare, setShowShare] = useState(false)
  const contentRevision = useRef(0)
  const bypassBlocker = useRef(false)
  const titleDirty = owner && title !== savedTitle
  const dirty = titleDirty || contentDirty

  const editor = useEditor({
    extensions: editorExtensions,
    content: document.content,
    editorProps: {
      attributes: {
        role: 'textbox',
        'aria-label': 'Document content',
        'aria-multiline': 'true',
        'aria-placeholder': 'Start writing…',
        spellcheck: 'true',
      },
    },
    onUpdate: () => {
      contentRevision.current += 1
      setContentDirty(true)
      setSaveError('')
    },
  })

  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    dirty && !bypassBlocker.current &&
    (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search))

  useEffect(() => {
    if (blocker.state === 'blocked') {
      if (window.confirm(discardMessage)) blocker.proceed()
      else blocker.reset()
    }
  }, [blocker])

  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = true
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  function switchUser(id: string) {
    if (id === user.id || (dirty && !window.confirm('Switch users and discard your unsaved changes?'))) return
    bypassBlocker.current = true
    selectUser(id)
    void navigate('/', { replace: true })
  }

  async function save() {
    if (!editor || !dirty || saving) return
    if (titleDirty && !title.trim()) {
      setSaveError('Enter a document title before saving.')
      return
    }

    const revision = contentRevision.current
    const patch: DocumentPatch = {}
    if (titleDirty) patch.title = title.trim()
    if (contentDirty) patch.content = editor.getJSON()
    setSaving(true)
    setSaveError('')
    try {
      const updated = await api.save(user.id, document.id, patch)
      setSavedTitle(updated.title)
      setTitle((current) => current === title ? updated.title : current)
      if (contentRevision.current === revision) setContentDirty(false)
    } catch (error) {
      setSaveError(errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const status = saving ? 'Saving…' : saveError ? 'Save failed' : dirty ? 'Unsaved changes' : 'Saved'
  const StatusIcon = saving ? LoaderCircle : saveError ? AlertCircle : dirty ? Circle : Check
  const exportTitle = (owner ? title : savedTitle).trim() || DEFAULT_TITLE

  return (
    <div className="editor-page">
      <EditorHeader returnTo={returnTo} onSwitch={switchUser} />
      <main className="editor-main">
        <section className="document-top" aria-labelledby="document-heading">
          <div className="document-identity">
            {owner ? (
              <div className="title-field">
                <h1 id="document-heading" className="sr-only">{title || 'Untitled document'}</h1>
                <input aria-label="Document title" value={title} maxLength={MAX_TITLE_LENGTH}
                  placeholder="Untitled document" onChange={(event) => { setTitle(event.target.value); setSaveError('') }} />
                <Pencil size={16} aria-hidden="true" />
              </div>
            ) : <h1 id="document-heading">{savedTitle}</h1>}
            <p><UserRound size={15} aria-hidden="true" /> Owned by {document.owner.name}{!owner && <span className="access-label">Editor access</span>}</p>
          </div>
          <div className="editor-actions">
            {editor && <ExportMenu editor={editor} title={exportTitle} />}
            {owner && <button className="button button-secondary" onClick={() => setShowShare(true)}>
              <UsersRound size={17} aria-hidden="true" /> Share
            </button>}
            <button className="button button-primary" disabled={!editor || !dirty || saving} onClick={() => { void save() }}>
              <Save size={17} aria-hidden="true" /> Save
            </button>
            <p className={`save-status${saveError ? ' save-error' : ''}`} role="status">
              <StatusIcon size={14} className={saving ? 'spin' : undefined} aria-hidden="true" />
              {status}
            </p>
          </div>
        </section>
        {saveError && <ErrorNotice message={saveError} />}
        {editor ? (
          <>
            <FormattingToolbar editor={editor} />
            <div className="paper">
              <h1 className="print-document-title">{exportTitle}</h1>
              <EditorContent editor={editor} />
            </div>
          </>
        ) : <Loading text="Loading the editor…" />}
      </main>
      {showShare && <ShareDialog documentId={document.id} title={savedTitle} owner={document.owner} users={users} onClose={() => setShowShare(false)} />}
    </div>
  )
}
