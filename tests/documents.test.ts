import type { Client } from '@libsql/client'
import { execFile } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../server/app'
import { openDatabase } from '../server/database'
import { ACTING_USER_HEADER, IMPORT_FILENAME_HEADER, MAX_IMPORT_BYTES } from '../shared/contracts'

const formattedContent = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Planning notes' }] },
    { type: 'paragraph', content: [
      { type: 'text', text: 'Important', marks: [{ type: 'bold' }, { type: 'italic' }, { type: 'underline' }] },
    ] },
    { type: 'bulletList', content: [
      { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'First item' }] }] },
    ] },
    { type: 'orderedList', attrs: { start: 1 }, content: [
      { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Next step' }] }] },
    ] },
  ],
}

describe('Workspace documents API', () => {
  let db: Client
  let app: ReturnType<typeof createApp>

  beforeEach(async () => {
    db = await openDatabase({ url: 'file::memory:' })
    app = createApp(db)
  })

  afterEach(() => db?.close())

  function as(userId: string) {
    const agent = request.agent(app)
    agent.set(ACTING_USER_HEADER, userId)
    return agent
  }

  async function createDocument(title = 'Project notes'): Promise<string> {
    const result = await as('alex').post('/api/documents').send({ title }).expect(201)
    return result.body.id
  }

  function importFile(filename: string, contents: Buffer, mime = 'text/plain') {
    return as('alex').post('/api/documents/import')
      .set(IMPORT_FILENAME_HEADER, encodeURIComponent(filename))
      .set('Content-Type', mime)
      .send(contents)
  }

  it('seeds both identities and rejects missing or unknown acting identities', async () => {
    const response = await request(app).get('/api/users').expect(200)
    expect(response.body).toEqual([
      { id: 'alex', name: 'Alex Morgan' },
      { id: 'jamie', name: 'Jamie Chen' },
    ])
    await request(app).get('/api/documents').expect(401)
    await as('someone-else').get('/api/documents').expect(401)
  })

  it('creates, lists, and opens a blank document for its owner', async () => {
    const id = await createDocument('  Project notes  ')
    const detail = await as('alex').get(`/api/documents/${id}`).expect(200)
    expect(detail.body).toMatchObject({
      id, title: 'Project notes', access: 'owner', owner: { id: 'alex', name: 'Alex Morgan' },
      content: { type: 'doc', content: [{ type: 'paragraph' }] },
    })
    const list = await as('alex').get('/api/documents').expect(200)
    expect(list.body).toHaveLength(1)
    expect(list.body[0]).toMatchObject({ id, title: 'Project notes' })
  })

  it('renames and saves a document, then returns all formatting on reopen', async () => {
    const id = await createDocument()
    await as('alex').patch(`/api/documents/${id}`)
      .send({ title: 'Planning', content: formattedContent }).expect(200)

    const response = await as('alex').get(`/api/documents/${id}`).expect(200)
    expect(response.body).toMatchObject({ title: 'Planning', content: formattedContent })
  })

  it('hides private documents and denies direct reads, edits, and share requests', async () => {
    const id = await createDocument()
    const jamie = as('jamie')
    const list = await jamie.get('/api/documents').expect(200)
    expect(list.body).toEqual([])
    await jamie.get(`/api/documents/${id}`).expect(404)
    await jamie.patch(`/api/documents/${id}`).send({ content: formattedContent }).expect(404)
    await jamie.get(`/api/documents/${id}/shares`).expect(404)
    await jamie.post(`/api/documents/${id}/shares`).send({ userId: 'jamie' }).expect(404)
  })

  it('grants editor access, lists the collaborator, and shows the document to the recipient', async () => {
    const id = await createDocument()
    const alex = as('alex')
    await alex.post(`/api/documents/${id}/shares`).send({ userId: 'jamie' }).expect(201)
    const collaborators = await alex.get(`/api/documents/${id}/shares`).expect(200)
    expect(collaborators.body).toEqual([{ id: 'jamie', name: 'Jamie Chen' }])

    const jamie = as('jamie')
    const shared = await jamie.get('/api/documents').expect(200)
    expect(shared.body).toEqual([expect.objectContaining({ id, access: 'editor', owner: { id: 'alex', name: 'Alex Morgan' } })])
    await jamie.get(`/api/documents/${id}`).expect(200)
  })

  it('allows shared content edits and protects the title, sharing, and ownership', async () => {
    const id = await createDocument()
    const url = `/api/documents/${id}`
    const alex = as('alex')
    await alex.post(`${url}/shares`).send({ userId: 'jamie' }).expect(201)

    const jamie = as('jamie')
    await jamie.patch(url).send({ content: formattedContent }).expect(200)
    await jamie.patch(url).send({ title: 'Hijacked' }).expect(403)
    await jamie.get(`${url}/shares`).expect(403)
    await jamie.post(`${url}/shares`).send({ userId: 'alex' }).expect(403)
    await jamie.patch(url).send({ owner_id: 'jamie' }).expect(400)
    await alex.patch(url).send({ ownerId: 'jamie' }).expect(400)

    const saved = await alex.get(url).expect(200)
    expect(saved.body).toMatchObject({ title: 'Project notes', owner: { id: 'alex' }, content: formattedContent })
  })

  it('lets the owner delete a document and removes its shares', async () => {
    const id = await createDocument()
    const url = `/api/documents/${id}`
    const alex = as('alex')
    const jamie = as('jamie')
    await alex.post(`${url}/shares`).send({ userId: 'jamie' }).expect(201)
    await jamie.get(url).expect(200)

    await alex.delete(url).expect(204)
    await alex.get(url).expect(404)
    await jamie.get(url).expect(404)
    await alex.get('/api/documents').expect(200, [])
    await jamie.get('/api/documents').expect(200, [])

    const { rows } = await db.execute({
      sql: 'SELECT user_id FROM document_shares WHERE document_id = ?',
      args: [id],
    })
    expect(rows).toHaveLength(0)
  })

  it('rejects deletion by a shared editor and preserves the document', async () => {
    const id = await createDocument()
    const url = `/api/documents/${id}`
    const alex = as('alex')
    const jamie = as('jamie')
    await alex.post(`${url}/shares`).send({ userId: 'jamie' }).expect(201)

    await jamie.delete(url).expect(403)
    await alex.get(url).expect(200)
    await jamie.get(url).expect(200)
  })

  it('rejects deletion by an unrelated user and validates the identity and ID', async () => {
    const id = await createDocument()
    const url = `/api/documents/${id}`
    await as('jamie').delete(url).expect(404)
    await as('someone-else').delete(url).expect(401)
    await as('alex').delete('/api/documents/invalid-id').expect(400)
    await as('alex').get(url).expect(200)
  })

  it('rejects invalid IDs, titles, formatting, and duplicate or self-shares', async () => {
    const id = await createDocument()
    const alex = as('alex')
    const url = `/api/documents/${id}`
    await alex.get('/api/documents/invalid-id').expect(400)
    await alex.post('/api/documents').send({ title: '  ' }).expect(400)
    await alex.patch(url).send({ content: { type: 'doc', content: [{ type: 'text', text: 'Outside a block' }] } }).expect(400)
    await alex.post(`${url}/shares`).send({ userId: 'alex' }).expect(400)
    await alex.post(`${url}/shares`).send({ userId: 'unknown' }).expect(400)
    await alex.post(`${url}/shares`).send({ userId: 'jamie' }).expect(201)
    await alex.post(`${url}/shares`).send({ userId: 'jamie' }).expect(409)
  })

  it('imports UTF-8 text with its original line breaks and literal markup', async () => {
    const response = await importFile('Résumé.TXT', Buffer.from('First line\r\n\n<strong>Résumé</strong>\r'))
      .expect(201)
    expect(response.body).toMatchObject({
      title: 'Résumé',
      owner: { id: 'alex' },
      content: {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'First line' }] },
          { type: 'paragraph' },
          { type: 'paragraph', content: [{ type: 'text', text: '<strong>Résumé</strong>' }] },
          { type: 'paragraph' },
        ],
      },
    })
    await as('alex').get(`/api/documents/${response.body.id}`).expect(200)
  })

  it('rejects invalid TXT uploads without creating documents', async () => {
    await importFile('notes.html', Buffer.from('test')).expect(400)
    await importFile('notes.txt', Buffer.from('test'), 'text/html').expect(415)
    await importFile('bad-encoding.txt', Buffer.from([0xc3, 0x28])).expect(400)
    const tooLarge = await importFile('too-large.txt', Buffer.alloc(MAX_IMPORT_BYTES + 1, 'a')).expect(413)
    expect(tooLarge.body.error).toContain('1 MB')
    const list = await as('alex').get('/api/documents').expect(200)
    expect(list.body).toEqual([])
  })
})

it('retains documents and shares when the file database is opened again', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'workspace-test-'))
  try {
    const { pathname } = pathToFileURL(join(directory, 'test.db'))
    const databaseUrl = `file:${process.platform === 'win32' ? pathname.slice(1) : pathname}`
    const script = fileURLToPath(new URL('./fixtures/file-database.ts', import.meta.url))
    const run = promisify(execFile)
    const nodeArgs = ['--import', 'tsx', script, databaseUrl]
    const options = { timeout: 10_000, windowsHide: true }

    // Native libSQL statements can retain file handles after close(). Wait for
    // each process to exit so Windows releases every handle before cleanup.
    const { stdout: id } = await run(process.execPath, [...nodeArgs, 'write', JSON.stringify(formattedContent)], options)
    const { stdout: reopened } = await run(process.execPath, [...nodeArgs, 'read', id.trim()], options)
    expect(JSON.parse(reopened)).toMatchObject({
      title: 'Saved document', owner: { id: 'alex' }, access: 'editor', content: formattedContent,
    })
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}, 25_000)
