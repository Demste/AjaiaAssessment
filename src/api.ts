import {
  ACTING_USER_HEADER, DEFAULT_TITLE, IMPORT_FILENAME_HEADER, IMPORT_MIME_TYPES, MAX_IMPORT_BYTES,
} from '../shared/contracts'
import type { DocumentPatch, DocumentRecord, DocumentSummary, User } from '../shared/contracts'

async function sendRequest(path: string, options: RequestInit, userId?: string): Promise<Response> {
  const headers = new Headers(options.headers)
  if (userId) headers.set(ACTING_USER_HEADER, userId)
  const response = await fetch(`/api${path}`, { ...options, headers })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(typeof body?.error === 'string' ? body.error : 'The request failed. Please try again.')
  }
  return response
}

async function request<T>(path: string, options: RequestInit = {}, userId?: string): Promise<T> {
  return (await sendRequest(path, options, userId)).json()
}

function json(method: 'POST' | 'PATCH', body: object): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}

export const api = {
  users: (signal?: AbortSignal) => request<User[]>('/users', { signal }),
  documents: (userId: string, signal?: AbortSignal) =>
    request<DocumentSummary[]>('/documents', { signal }, userId),
  document: (userId: string, id: string, signal?: AbortSignal) =>
    request<DocumentRecord>(`/documents/${encodeURIComponent(id)}`, { signal }, userId),
  create: (userId: string) =>
    request<DocumentRecord>('/documents', json('POST', { title: DEFAULT_TITLE }), userId),
  save: (userId: string, id: string, patch: DocumentPatch) =>
    request<DocumentSummary>(`/documents/${id}`, json('PATCH', patch), userId),
  remove: async (userId: string, id: string) => {
    await sendRequest(`/documents/${encodeURIComponent(id)}`, { method: 'DELETE' }, userId)
  },
  import: (userId: string, file: File) => {
    const mimeType = file.type || 'application/octet-stream'
    if (!/\.txt$/i.test(file.name) || !IMPORT_MIME_TYPES.includes(mimeType)) {
      throw new Error('Select a plain .txt file.')
    }
    if (file.size > MAX_IMPORT_BYTES) throw new Error('TXT files must be 1 MB or smaller.')
    return request<DocumentRecord>('/documents/import', {
      method: 'POST',
      headers: { 'Content-Type': mimeType, [IMPORT_FILENAME_HEADER]: encodeURIComponent(file.name) },
      body: file,
    }, userId)
  },
  collaborators: (userId: string, id: string, signal?: AbortSignal) =>
    request<User[]>(`/documents/${id}/shares`, { signal }, userId),
  share: (userId: string, id: string, recipientId: string) =>
    request<User>(`/documents/${id}/shares`, json('POST', { userId: recipientId }), userId),
}

export function errorMessage(error: unknown): string {
  if (error instanceof TypeError) return 'Could not reach Workspace. Check that the local app is running and try again.'
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.'
}
