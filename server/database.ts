import { createClient } from '@libsql/client'
import type { Client, Config, Row } from '@libsql/client'
import { mkdir } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import type { DocumentRecord, DocumentSummary, User } from '../shared/contracts'

export async function openDatabase(config?: Config): Promise<Client> {
  const url = process.env.LIBSQL_URL
  if (!config && !url) await mkdir('data', { recursive: true })

  const db = createClient(config ?? {
    url: url || 'file:./data/workspace.db',
    authToken: process.env.LIBSQL_AUTH_TOKEN || undefined,
  })

  try {
    if (db.protocol === 'file') await db.execute('PRAGMA foreign_keys = ON')
    await db.batch([
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY NOT NULL,
        owner_id TEXT NOT NULL REFERENCES users(id),
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      )`,
      `CREATE TABLE IF NOT EXISTS document_shares (
        document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        PRIMARY KEY (document_id, user_id)
      )`,
      'CREATE INDEX IF NOT EXISTS documents_by_owner ON documents(owner_id)',
      'CREATE INDEX IF NOT EXISTS shares_by_user ON document_shares(user_id)',
      {
        sql: `INSERT INTO users (id, name) VALUES (?, ?), (?, ?)
              ON CONFLICT (id) DO NOTHING`,
        args: ['alex', 'Alex Morgan', 'jamie', 'Jamie Chen'],
      },
    ], 'write')
    return db
  } catch (error) {
    db.close()
    throw error
  }
}

function toUser(row: Row): User {
  return { id: String(row.id), name: String(row.name) }
}

export async function listUsers(db: Client): Promise<User[]> {
  const { rows } = await db.execute('SELECT id, name FROM users ORDER BY name')
  return rows.map(toUser)
}

export async function findUser(db: Client, id: string): Promise<User | undefined> {
  const { rows } = await db.execute({ sql: 'SELECT id, name FROM users WHERE id = ?', args: [id] })
  return rows[0] && toUser(rows[0])
}

const documentColumns = 'd.id, d.owner_id, u.name AS owner_name, d.title, d.created_at, d.updated_at'
const accessibleDocuments = `
  FROM documents d
  JOIN users u ON u.id = d.owner_id
  LEFT JOIN document_shares s ON s.document_id = d.id AND s.user_id = ?
  WHERE (d.owner_id = ? OR s.user_id IS NOT NULL)
`

function toSummary(
  row: Row, userId: string, owner = { id: String(row.owner_id), name: String(row.owner_name) },
): DocumentSummary {
  return {
    id: String(row.id),
    title: String(row.title),
    owner,
    access: owner.id === userId ? 'owner' : 'editor',
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

export async function listDocuments(db: Client, userId: string): Promise<DocumentSummary[]> {
  const { rows } = await db.execute({
    sql: `SELECT ${documentColumns} ${accessibleDocuments} ORDER BY d.updated_at DESC, d.id`,
    args: [userId, userId],
  })
  return rows.map((row) => toSummary(row, userId))
}

export async function findDocument(
  db: Client, userId: string, id: string, includeContent: true,
): Promise<DocumentRecord | undefined>
export async function findDocument(
  db: Client, userId: string, id: string, includeContent?: false,
): Promise<DocumentSummary | undefined>
export async function findDocument(db: Client, userId: string, id: string, includeContent = false) {
  const columns = includeContent ? `${documentColumns}, d.content` : documentColumns
  const { rows: [row] } = await db.execute({
    sql: `SELECT ${columns} ${accessibleDocuments} AND d.id = ?`,
    args: [userId, userId, id],
  })
  if (!row) return undefined

  const summary = toSummary(row, userId)
  return includeContent ? { ...summary, content: JSON.parse(String(row.content)) } : summary
}

export async function insertDocument(
  db: Client, owner: User, title: string, content: string,
): Promise<DocumentRecord> {
  const { rows: [row] } = await db.execute({
    sql: `INSERT INTO documents (id, owner_id, title, content)
          VALUES (?, (SELECT id FROM users WHERE id = ?), ?, ?)
          RETURNING id, title, created_at, updated_at`,
    args: [randomUUID(), owner.id, title, content],
  })
  return {
    ...toSummary(row, owner.id, owner),
    content: JSON.parse(content),
  }
}

export async function updateDocument(
  db: Client, document: DocumentSummary, patch: { title?: string; content?: string },
): Promise<DocumentSummary | undefined> {
  const { rows: [row] } = await db.execute({
    sql: `UPDATE documents
          SET title = coalesce(?, title), content = coalesce(?, content),
              updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
          WHERE id = ? RETURNING title, updated_at`,
    args: [patch.title ?? null, patch.content ?? null, document.id],
  })
  if (row) return { ...document, title: String(row.title), updatedAt: String(row.updated_at) }
}

export async function deleteOwnedDocument(db: Client, id: string, ownerId: string): Promise<boolean> {
  const args = [id, ownerId]
  // Foreign-key enforcement is connection-scoped on remote libSQL.
  const [, result] = await db.batch([
    {
      sql: `DELETE FROM document_shares WHERE document_id = (
              SELECT id FROM documents WHERE id = ? AND owner_id = ?
            )`,
      args,
    },
    { sql: 'DELETE FROM documents WHERE id = ? AND owner_id = ?', args },
  ], 'write')
  return result.rowsAffected > 0
}

export async function listCollaborators(db: Client, documentId: string): Promise<User[]> {
  const { rows } = await db.execute({
    sql: `SELECT u.id, u.name FROM document_shares s
          JOIN users u ON u.id = s.user_id WHERE s.document_id = ? ORDER BY u.name`,
    args: [documentId],
  })
  return rows.map(toUser)
}

export async function insertShare(db: Client, documentId: string, userId: string): Promise<boolean> {
  const result = await db.execute({
    sql: `INSERT INTO document_shares (document_id, user_id)
          SELECT d.id, u.id FROM documents d CROSS JOIN users u
          WHERE d.id = ? AND u.id = ?
          ON CONFLICT (document_id, user_id) DO NOTHING`,
    args: [documentId, userId],
  })
  return result.rowsAffected > 0
}
