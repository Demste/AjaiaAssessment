import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ChevronDown, LoaderCircle, UsersRound, X } from 'lucide-react'
import type { User } from '../shared/contracts'
import { api, errorMessage } from './api'
import { Avatar, ErrorNotice, Loading } from './components'

interface ShareDialogProps {
  documentId: string
  title: string
  owner: User
  users: User[]
  onClose: () => void
}

export function ShareDialog({ documentId, title, owner, users, onClose }: ShareDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [collaborators, setCollaborators] = useState<User[] | null>(null)
  const [recipientId, setRecipientId] = useState('')
  const [listError, setListError] = useState('')
  const [actionError, setActionError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [sharing, setSharing] = useState(false)
  const available = users.filter((user) => user.id !== owner.id && !collaborators?.some(({ id }) => id === user.id))

  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    api.collaborators(owner.id, documentId, controller.signal).then((result) => {
      if (controller.signal.aborted) return
      setCollaborators(result)
      setRecipientId((current) => result.some((person) => person.id === current) ? '' : current)
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setListError(errorMessage(error))
    })
    return () => controller.abort()
  }, [owner.id, documentId, attempt])

  async function share(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!recipientId || sharing) return
    setSharing(true)
    setActionError('')
    setFeedback('')
    try {
      const recipient = await api.share(owner.id, documentId, recipientId)
      setCollaborators((current) => [...(current ?? []), recipient])
      setRecipientId('')
      setFeedback(`${recipient.name} now has editor access.`)
    } catch (error) {
      setActionError(errorMessage(error))
      setAttempt((current) => current + 1)
    } finally {
      setSharing(false)
    }
  }

  function close() {
    dialog.current?.close()
    onClose()
  }

  return (
    <dialog ref={dialog} className="share-dialog" aria-labelledby="share-heading"
      onCancel={(event) => { event.preventDefault(); close() }}>
      <header className="dialog-header">
        <span className="dialog-icon"><UsersRound size={22} aria-hidden="true" /></span>
        <button className="icon-button" type="button" onClick={close} aria-label="Close sharing dialog"><X size={21} aria-hidden="true" /></button>
        <h2 id="share-heading">Share document</h2>
        <p title={title}>{title}</p>
      </header>
      <div className="dialog-body">
        <h3>People with access</h3>
        <ul className="collaborators">
          <li><Avatar user={owner} /><span>{owner.name}</span><span className="collaborator-role">Owner</span></li>
          {collaborators?.map((person) => (
            <li key={person.id}><Avatar user={person} /><span>{person.name}</span><span className="collaborator-role">Editor</span></li>
          ))}
        </ul>
        {listError ? <ErrorNotice message={listError} onRetry={() => { setListError(''); setAttempt(attempt + 1) }} />
          : collaborators === null && <Loading text="Loading collaborators…" />}
        <form className="share-form" onSubmit={share}>
          <label htmlFor="share-recipient">Add an editor</label>
          <div className="share-controls">
            <div className="select-wrap">
              <select id="share-recipient" value={recipientId} aria-describedby="editor-access"
                onChange={(event) => { setRecipientId(event.target.value); setActionError('') }}
                disabled={collaborators === null || !!listError || sharing || available.length === 0}>
                <option value="">{available.length ? 'Select a demo user' : 'All demo users have access'}</option>
                {available.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
              </select>
              <ChevronDown size={16} aria-hidden="true" />
            </div>
            <button type="submit" className="button button-primary" disabled={!recipientId || sharing || !!listError}>
              {sharing && <LoaderCircle size={16} className="spin" aria-hidden="true" />}{sharing ? 'Sharing…' : 'Share'}
            </button>
          </div>
          <p id="editor-access">Editors can open and save the document’s content. Only the owner can rename it or manage sharing.</p>
        </form>
        {actionError && <ErrorNotice message={actionError} />}
        {feedback && <p className="share-feedback" role="status">{feedback}</p>}
      </div>
    </dialog>
  )
}
