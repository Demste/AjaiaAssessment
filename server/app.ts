import express, { Router } from 'express'
import type { ErrorRequestHandler, Request } from 'express'
import type { Client } from '@libsql/client'
import { join } from 'node:path'
import {
  ACTING_USER_HEADER, IMPORT_FILENAME_HEADER, IMPORT_MIME_TYPES, MAX_IMPORT_BYTES,
} from '../shared/contracts'
import type { User } from '../shared/contracts'
import {
  deleteOwnedDocument, findDocument, findUser, insertDocument, insertShare, listCollaborators,
  listDocuments, listUsers, updateDocument,
} from './database'
import {
  ApiError, bodyObject, MAX_CONTENT_BYTES, textToDocument, validateContent, validateDocumentId,
  validateTitle,
} from './validation'

function importTitle(header: string | undefined): string {
  let filename: string
  try {
    filename = decodeURIComponent(header ?? '')
  } catch {
    throw new ApiError(400, 'The filename is invalid.')
  }
  if (!/^[^/\\\u0000-\u001f\u007f]+\.txt$/i.test(filename)) {
    throw new ApiError(400, 'Select a file with a .txt extension.')
  }
  return validateTitle(filename.slice(0, -4))
}

function importedText(body: unknown): string {
  const file = body === undefined ? Buffer.alloc(0) : body
  if (!Buffer.isBuffer(file)) throw new ApiError(400, 'Send the TXT file as the request body.')
  if (file.byteLength > MAX_IMPORT_BYTES) throw new ApiError(413, 'TXT files must be 1 MB or smaller.')

  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(file)
  } catch {
    throw new ApiError(400, 'Save the TXT file with UTF-8 encoding and try again.')
  }
  if (text.includes('\0')) throw new ApiError(400, 'The file must contain plain UTF-8 text.')
  return text
}

const handleError: ErrorRequestHandler = (error, req, res, next) => {
  if (res.headersSent) {
    next(error)
    return
  }
  if (error instanceof ApiError) {
    res.status(error.status).json({ error: error.message })
    return
  }

  switch (error.type) {
    case 'entity.parse.failed':
      res.status(400).json({ error: 'The request body contains invalid JSON.' })
      return
    case 'entity.too.large':
      res.status(413).json({
        error: req.path === '/api/documents/import' || req.path === '/documents/import'
          ? 'TXT files must be 1 MB or smaller.'
          : 'The request body is too large.',
      })
      return
    case 'charset.unsupported':
    case 'encoding.unsupported':
      res.status(415).json({ error: 'The request encoding is unsupported.' })
      return
    case 'request.aborted':
    case 'request.size.invalid':
      res.status(400).json({ error: 'The request body is incomplete.' })
      return
    default:
      if (error instanceof URIError) {
        res.status(400).json({ error: 'The request URL is invalid.' })
        return
      }
      console.error(error)
      res.status(500).json({ error: 'Something went wrong. Please try again.' })
  }
}

export function createApp(db: Client, staticDirectory?: string) {
  const app = express()
  const api = Router()
  const json = express.json({ limit: '8kb' })
  const documentJson = express.json({ limit: MAX_CONTENT_BYTES + 8192 })
  const rawFile = express.raw({ type: () => true, limit: MAX_IMPORT_BYTES, inflate: false })
  app.disable('x-powered-by')

  api.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store')
    next()
  })
  api.get('/users', async (_req, res) => {
    res.json(await listUsers(db))
  })
  api.use(async (req, res, next) => {
    const userId = req.get(ACTING_USER_HEADER)
    if (!userId) throw new ApiError(401, 'Select a demo user.')
    const user = await findUser(db, userId)
    if (!user) throw new ApiError(401, 'The selected demo user is invalid.')
    res.locals.user = user
    next()
  })

  api.get('/documents', async (_req, res) => {
    const user: User = res.locals.user
    res.json(await listDocuments(db, user.id))
  })
  api.post('/documents', json, async (req, res) => {
    const { title } = bodyObject(req.body, ['title'])
    const document = await insertDocument(db, res.locals.user, validateTitle(title), JSON.stringify(textToDocument('')))
    res.status(201).json(document)
  })
  api.post('/documents/import', (req, _res, next) => {
    const mediaType = req.get('Content-Type')?.split(';')[0].trim().toLowerCase()
    if (!mediaType || !IMPORT_MIME_TYPES.includes(mediaType)) {
      throw new ApiError(415, 'Only plain TXT files are supported.')
    }
    next()
  }, rawFile, async (req, res) => {
    const title = importTitle(req.get(IMPORT_FILENAME_HEADER))
    const content = JSON.stringify(textToDocument(importedText(req.body)))
    res.status(201).json(await insertDocument(db, res.locals.user, title, content))
  })

  async function requireDocument(req: Request, user: User, ownerOnly = false) {
    const document = await findDocument(db, user.id, validateDocumentId(req.params.id))
    if (!document) throw new ApiError(404, 'Document not found or you do not have access.')
    if (ownerOnly && document.access !== 'owner') {
      throw new ApiError(403, 'Only the owner can manage sharing.')
    }
    return document
  }

  api.get('/documents/:id', async (req, res) => {
    const user: User = res.locals.user
    const document = await findDocument(db, user.id, validateDocumentId(req.params.id), true)
    if (!document) throw new ApiError(404, 'Document not found or you do not have access.')
    res.json(document)
  })
  api.patch('/documents/:id', documentJson, async (req, res) => {
    const document = await requireDocument(req, res.locals.user)
    const { title, content } = bodyObject(req.body, ['title', 'content'])
    if (title === undefined && content === undefined) throw new ApiError(400, 'Send a title or content to update.')
    if (title !== undefined && document.access !== 'owner') {
      throw new ApiError(403, 'Only the owner can rename this document.')
    }

    const updated = await updateDocument(db, document, {
      title: title === undefined ? undefined : validateTitle(title),
      content: content === undefined ? undefined : validateContent(content),
    })
    if (!updated) throw new ApiError(404, 'Document not found or you do not have access.')
    res.json(updated)
  })
  api.delete('/documents/:id', async (req, res) => {
    const user: User = res.locals.user
    const document = await requireDocument(req, user)
    if (document.access !== 'owner') throw new ApiError(403, 'Only the owner can delete this document.')
    if (!await deleteOwnedDocument(db, document.id, user.id)) {
      throw new ApiError(404, 'Document not found or you do not have access.')
    }
    res.status(204).end()
  })
  api.get('/documents/:id/shares', async (req, res) => {
    const document = await requireDocument(req, res.locals.user, true)
    res.json(await listCollaborators(db, document.id))
  })
  api.post('/documents/:id/shares', json, async (req, res) => {
    const document = await requireDocument(req, res.locals.user, true)
    const { userId } = bodyObject(req.body, ['userId'])
    const recipient = typeof userId === 'string' ? await findUser(db, userId) : undefined

    if (!recipient) throw new ApiError(400, 'Select a valid demo user.')
    if (recipient.id === document.owner.id) throw new ApiError(400, 'You already own this document.')
    if (!await insertShare(db, document.id, recipient.id)) {
      throw new ApiError(409, 'This user already has editor access.')
    }
    res.status(201).json(recipient)
  })
  api.use((_req, res) => {
    res.status(404).json({ error: 'API route not found.' })
  })
  app.use('/api', api)

  if (staticDirectory) {
    app.use(express.static(staticDirectory))
    app.get('/documents/:id', (_req, res) => {
      res.sendFile(join(staticDirectory, 'index.html'))
    })
  }
  app.use(handleError)
  return app
}
