import type { JSONContent } from '@tiptap/core'

export const MAX_IMPORT_BYTES = 1024 * 1024
export const MAX_TITLE_LENGTH = 120
export const IMPORT_MIME_TYPES = ['text/plain', 'application/octet-stream']
export const DEFAULT_TITLE = 'Untitled document'
export const ACTING_USER_HEADER = 'X-Demo-User-Id'
export const IMPORT_FILENAME_HEADER = 'X-File-Name'

export interface User {
  id: string
  name: string
}

export interface DocumentSummary {
  id: string
  title: string
  owner: User
  access: 'owner' | 'editor'
  createdAt: string
  updatedAt: string
}

export interface DocumentRecord extends DocumentSummary {
  content: JSONContent
}

export interface DocumentPatch {
  title?: string
  content?: JSONContent
}
