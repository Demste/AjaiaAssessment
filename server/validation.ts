import { getSchema } from '@tiptap/core'
import type { JSONContent } from '@tiptap/core'
import { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { MAX_TITLE_LENGTH } from '../shared/contracts'
import { editorExtensions } from '../shared/editor'

export const MAX_CONTENT_BYTES = 32 * 1024 * 1024
const MAX_DOCUMENT_DEPTH = 64
const schema = getSchema(editorExtensions)

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function bodyObject(value: unknown, fields: string[]): Record<string, unknown> {
  if (!isObject(value)) throw new ApiError(400, 'Send a JSON object.')
  if (Object.keys(value).some((key) => !fields.includes(key))) {
    throw new ApiError(400, 'The request contains unsupported fields.')
  }
  return value
}

export function validateTitle(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new ApiError(400, 'Enter a document title on one line.')
  }
  const title = value.trim()
  if (title.length > MAX_TITLE_LENGTH) {
    throw new ApiError(400, `Document titles can be up to ${MAX_TITLE_LENGTH} characters.`)
  }
  return title
}

export function validateDocumentId(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value)) {
    throw new ApiError(400, 'Invalid document ID.')
  }
  return value
}

function validAttributes(type: string, attrs: unknown): boolean {
  if (attrs === undefined) return true
  if (!isObject(attrs)) return false

  const allowed = schema.nodes[type].spec.attrs ?? {}
  if (Object.keys(attrs).some((key) => !Object.hasOwn(allowed, key))) return false
  if (type === 'heading') return attrs.level === undefined || attrs.level === 1 || attrs.level === 2
  if (type === 'orderedList') {
    const { start, type: numbering } = attrs
    return (start === undefined || (typeof start === 'number' && Number.isSafeInteger(start)))
      && (numbering === undefined || numbering === null || ['1', 'a', 'A', 'i', 'I'].some((style) => style === numbering))
  }
  return true
}

function validMark(value: unknown): boolean {
  return isObject(value) && typeof value.type === 'string'
    && Object.hasOwn(schema.marks, value.type)
    && Object.keys(value).every((key) => key === 'type')
}

function validNode(value: unknown, depth: number): boolean {
  if (depth > MAX_DOCUMENT_DEPTH || !isObject(value) || typeof value.type !== 'string'
    || !Object.hasOwn(schema.nodes, value.type)) return false
  if (Object.keys(value).some((key) => !['type', 'attrs', 'content', 'text', 'marks'].includes(key))) return false

  const nodeType = schema.nodes[value.type]
  if (!validAttributes(value.type, value.attrs)) return false
  if (value.marks !== undefined && (!nodeType.isInline || !Array.isArray(value.marks)
    || !value.marks.every(validMark))) return false
  if (nodeType.isText) return typeof value.text === 'string' && value.text.length > 0 && value.content === undefined
  if (value.text !== undefined) return false

  return value.content === undefined
    || (Array.isArray(value.content) && value.content.every((child) => validNode(child, depth + 1)))
}

export function validateContent(value: unknown): string {
  if (!isObject(value) || value.type !== 'doc' || !validNode(value, 0)) {
    throw new ApiError(400, 'Content must be valid Workspace editor JSON.')
  }

  const content = JSON.stringify(value)
  if (Buffer.byteLength(content, 'utf8') > MAX_CONTENT_BYTES) {
    throw new ApiError(413, 'Editor content exceeds the 32 MB limit.')
  }
  try {
    ProseMirrorNode.fromJSON(schema, value).check()
  } catch {
    throw new ApiError(400, 'Content contains invalid formatting or document structure.')
  }
  return content
}

export function textToDocument(text: string): JSONContent {
  return {
    type: 'doc',
    content: text.split(/\r\n|\n|\r/).map((line) => (
      line ? { type: 'paragraph', content: [{ type: 'text', text: line }] } : { type: 'paragraph' }
    )),
  }
}
