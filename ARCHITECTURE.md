# Architecture

## Frontend

React, Vite, and TypeScript power the dashboard and document editor. React Router handles document URLs and in-app navigation warnings. Tailwind CSS and shared styles define the responsive interface. Tiptap StarterKit provides the editor, with extensions limited to the supported document schema. The formatting controls derive their active state from the current selection.

The editor keeps title and content edits in memory until Save is pressed. Each save submits the changed fields. A content revision counter keeps edits made during an in-flight save marked as unsaved. The only browser-persisted setting is the demo identity.

In **My Documents**, an owner can confirm permanent deletion from a document's row. The dashboard removes the row after the API confirms deletion and displays an error if the request fails.

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

`server/database.ts` centralizes connection, schema initialization, and parameterized SQL. The libSQL client opens a local SQLite file by default and uses the Turso endpoint and token when configured. Startup runs create-if-absent DDL and conflict-safe demo-user inserts in one write batch before accepting requests. [Turso TypeScript SDK](https://docs.turso.tech/sdk/ts/reference#batch-transactions)

The schema retains its foreign keys and `ON DELETE CASCADE`, and the local SQLite connection enables enforcement at startup. The remote HTTP client opens a new stream for each operation, so connection-level settings do not carry over from startup. Document and share inserts check that referenced rows exist as part of the write. Deletion removes shares and the document in a single write batch, with the owner checked in both statements. This keeps the operation atomic when the connection's foreign-key setting varies. [SQLite foreign key support](https://sqlite.org/foreignkeys.html#fk_enable)

The assessment permits simulated authentication. Both database modes seed Alex Morgan and Jamie Chen so reviewers can exercise ownership and sharing. The public service is a demo with selectable identities. A production system would need to derive the acting identity from verified credentials before storing private user documents.

## Scope and deployment

This MVP covers manual local editing and one editor role. Saves use last-write-wins for the fields in each request, and shared editors see persisted changes when they reopen the document. Real authentication, live collaboration, autosave, version history, and advanced sharing controls are outside the local scope.

Render installs dependencies with `npm ci --include=dev` and builds the frontend with `npm run build`. `npm start` uses the runtime dependency `tsx` to start Express with the built `dist/` directory. Express serves frontend assets, document deep links, and the API on one origin. The browser uses relative `/api` URLs. Express binds to `HOST=0.0.0.0` on the port Render supplies. Turso credentials stay on the server in Render's environment. [Render Web Services](https://render.com/docs/web-services)
