# Workspace

Workspace is a local rich-text document editor with manual saving, UTF-8 TXT import, and editor access for a second demo user. Owners can rename, share, and permanently delete their documents from the workspace.

## Run locally

Use Node.js 22.12 or later and npm. Install dependencies and start Workspace from the project directory.

```sh
npm install
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). The development command starts Vite and the Express API together. Vite proxies `/api` to port 3001 by default. In Windows PowerShell, use `npm.cmd` in place of `npm` if execution policy blocks the npm PowerShell shim.

No account, API key, or cloud service is required. The API creates `data/workspace.db` and seeds the demo identities on startup. The database retains documents, titles, formatting, ownership, and shares across reloads and server restarts. The browser remembers the selected demo user when local storage is available.

## Create, save, and share

1. Select **Alex Morgan** or **Jamie Chen**, then choose **New Document**. Open existing documents from **My Documents** or **Shared with Me**.
2. Edit the title of an owned document or format its content with normal text, Heading 1, Heading 2, bold, italic, underline, and bulleted or numbered lists. Click **Save** to persist your changes. The editor reports unsaved, saving, saved, and failed states and warns before discarding edits.
3. As the owner, click **Share**, select the other demo user, and grant editor access. The dialog lists existing collaborators. Switch to that user and open **Shared with Me** to edit and save the content. Rename, delete, and sharing controls belong to the owner.
4. To remove a document you own, select the trash icon on its row in **My Documents**. The confirmation shows the document title. Deletion is permanent and removes collaborator access.

## Import TXT

Use **Import TXT** with a UTF-8 `.txt` file up to 1 MB (1,048,576 bytes). The name without its extension becomes the title, which may be up to 120 characters. The API validates the file before saving it, preserves line breaks, and treats markup as plain text. Workspace stores the resulting Tiptap JSON in SQLite and discards the uploaded bytes.

## Project commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite frontend and Express API |
| `npm test` | Run the Vitest/Supertest suite against isolated SQLite databases |
| `npm run typecheck` | Check TypeScript across the frontend, API, and tests |
| `npm run build` | Build the frontend into `dist/` |
| `npm start` | Serve the built frontend and API at [http://127.0.0.1:3001](http://127.0.0.1:3001) after building |

## Optional configuration

Copy `.env.example` to `.env` to override defaults. Set `PORT` for the API and local production server. Set `LIBSQL_URL` for a different SQLite file or a future remote libSQL endpoint. When specifying another local path, create its parent directory first. A remote database can use `LIBSQL_AUTH_TOKEN`.

## Known limitations

- The demo selector simulates authentication. The API trusts the selected identity header, so anyone with API access can act as either demo user.
- Document saves are manual. Concurrent saves use last-write-wins for the fields included in each request. Open editors receive updates when reopened.
- Sharing grants a fixed editor role to the other demo user. Owners retain title and sharing control. The application provides no share revocation.
- The production build emits a non-blocking bundle-size warning.

## Verification status

The human tester confirmed that all 13 integration tests and TypeScript type checking passed. The production build succeeded, and the local production application ran successfully. All core manual functionality checks passed, including owner-only deletion.
