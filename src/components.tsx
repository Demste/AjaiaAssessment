import { AlertCircle, ChevronDown, FileText, LoaderCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { User } from '../shared/contracts'

export function Brand({ link = false }: { link?: boolean }) {
  const label = <><span className="brand-mark"><FileText size={19} aria-hidden="true" /></span>Workspace</>
  return link ? <Link className="brand" to="/">{label}</Link> : <span className="brand">{label}</span>
}

export function Avatar({ user, small = false }: { user: User; small?: boolean }) {
  return (
    <span className={`avatar${small ? ' avatar-small' : ''}`} aria-hidden="true">
      {user.name.split(/\s+/).slice(0, 2).map((name) => name[0]).join('')}
    </span>
  )
}

interface UserSelectorProps {
  user: User
  users: User[]
  onChange: (id: string) => void
  disabled?: boolean
}

export function UserSelector({ user, users, onChange, disabled }: UserSelectorProps) {
  return (
    <label className="user-picker">
      <Avatar user={user} />
      <span className="user-picker-label" aria-hidden="true">
        <span>Demo user</span>
        <strong>{user.name}</strong>
      </span>
      <ChevronDown size={15} className="picker-chevron" aria-hidden="true" />
      <select aria-label="Demo user" value={user.id} onChange={(event) => onChange(event.target.value)} disabled={disabled}>
        {users.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
      </select>
    </label>
  )
}

export function Loading({ text }: { text: string }) {
  return <p className="loading-state" role="status"><LoaderCircle className="spin" size={18} aria-hidden="true" />{text}</p>
}

export function ErrorNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="error-notice" role="alert">
      <AlertCircle size={18} aria-hidden="true" />
      <span>{message}</span>
      {onRetry && <button className="button button-secondary button-small" onClick={onRetry}>Retry</button>}
    </div>
  )
}
