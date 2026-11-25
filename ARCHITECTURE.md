# Architecture

## Runtime paths

- **Local** · React and Vite → Express → local SQLite
- **Deployed** · Browser → Render Express application → Turso libSQL

## Frontend

React, Vite, and TypeScript power the dashboard and document editor. React Router handles document URLs and in-app navigation warnings. Tailwind CSS and shared styles define the responsive interface. Tiptap StarterKit provides the editor, with extensions limited to the supported document schema. The formatting controls derive their active state from the current selection.

The editor keeps title and content edits in memory until Save is pressed. Each save submits the changed fields. A content revision counter keeps edits made during an in-flight save marked as unsaved. The only browser-persisted setting is the demo identity.

The required MVP covers editing, manual saving, TXT import, and owner/editor sharing. Human usability testing led to owner-only deletion in **My Documents**. The dashboard removes the row after the API confirms deletion and displays an error if the request fails.

### Optional document export

The Export control is available to both roles. Markdown serialization reads the live Tiptap JSON and uses the current title for a sanitized browser download. The serializer escapes literal Markdown, keeps supported marks, and writes underlined text without underline styling. Print CSS renders the draft title and existing editor content in the browser's print layout, including underline. Both paths work from the open draft and use no API or database writes.

The serializer has focused unit tests in `tests/markdown-export.test.ts`. Human verification of the export changes is pending. See the [future improvement priorities](SUBMISSION.md#future-improvement-priorities).

## Backend

`server/app.ts` exports `createApp(db, staticDirectory?)`. It serves the Express REST API and can also serve a built frontend. `server/index.ts` loads configuration, opens the database, and binds to `HOST` and `PORT`, defaulting to `127.0.0.1:3001`. Keeping those responsibilities separate allows Supertest to use the same application with isolated databases.

| Endpoint | Access |
| --- | --- |
| `GET /api/users` | List seeded demo identities |
| `GET /api/documents` | List the acting user's owned and shared documents |
| `POST /api/documents` | Create a blank document owned by the acting user |
| `GET /api/documents/:id` | Read as owner or shared editor |
| `PATCH /api/documents/:id` | Owner can change title and content. Shared editor can change content |
| `DELETE /api/documents/:id` | Owner permanently deletes a document and its shares. Returns 204 |
| `POST /api/documents/import` | Create a document from UTF-8 TXT bytes |
| `GET /api/documents/:id/shares` | Owner lists editors |
| `POST /api/documents/:id/shares` | Owner grants editor access |

Document routes validate the `X-Demo-User-Id` header against seeded users. Missing or unknown identities receive 401. Document reads and mutations use ownership or share membership, and inaccessible document IDs receive 404. Shared editors receive 403 for renaming, managing sharing, or deleting a document. PATCH accepts title and content only. Errors use a JSON object with an `error` message.

The API validates editor JSON against the same ProseMirror schema as the frontend, with a 32 MiB serialized content limit and a nesting depth limit. Import accepts UTF-8 `.txt` files up to 1 MB via a raw request body and a percent-encoded `X-File-Name` header. The API checks the filename, media type, size, and decoding, then builds paragraph nodes to preserve line breaks. It stores the editor JSON and discards the upload bytes.

## Database and sharing

| Table | Model |
| --- | --- |
| `users` | Seeded identity with primary key `id` and `name` |
| `documents` | UUID primary key, foreign key `owner_id`, title, Tiptap JSON, and creation and update timestamps |
| `document_shares` | Foreign keys `document_id` and `user_id`, creation timestamp, and a composite primary key that prevents duplicate grants |

`server/database.ts` centralizes connection setup, schema initialization, and parameterized SQL. The libSQL client defaults to `data/workspace.db` and uses `LIBSQL_URL` and `LIBSQL_AUTH_TOKEN` for the deployed Turso database. Startup creates missing tables and seeds Alex Morgan and Jamie Chen in one idempotent write batch before accepting requests. [Turso TypeScript SDK](https://docs.turso.tech/sdk/ts/reference#batch-transactions)

The schema retains its foreign keys and `ON DELETE CASCADE`, and the local SQLite connection enables enforcement at startup. The remote HTTP client opens a new stream for each operation, so connection-level settings do not carry over from startup. Document and share inserts check that referenced rows exist as part of the write. Deletion removes shares and the document in a single write batch, with the owner checked in both statements. This keeps the operation atomic when the connection's foreign-key setting varies. [SQLite foreign key support](https://sqlite.org/foreignkeys.html#fk_enable)

Simulated identities let reviewers exercise ownership and sharing without registration or an identity provider. Real authentication and real-time editing were excluded to keep the MVP focused on document editing and sharing. Edits require a manual save. Concurrent saves use last-write-wins for the fields sent, and collaborators see saved changes when they reopen the document.

## Deployment

Render's Free Web Service runs the existing Express server and serves frontend assets, document links, and `/api` on one origin. Turso keeps the same libSQL client and schema while storing documents and shares independently of Render's ephemeral filesystem.

The Frankfurt service uses Node.js 22. Render runs `npm ci --include=dev && npm run build`, then `npm start` serves `dist/` and the API. Express binds to `HOST=0.0.0.0` on Render's port, and Turso credentials stay in Render's environment. After 15 minutes of inactivity, the Free instance may sleep and take about 60 seconds to wake on the next request. [Render Web Services](https://render.com/docs/web-services) · [Render Free web services](https://render.com/docs/free#spinning-down-on-idle)
