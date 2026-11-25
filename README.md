# Workspace

Workspace's required MVP covers rich-text editing, manual saving, UTF-8 TXT import, and sharing with a second demo user. Owner-only deletion was added after human usability testing. Document export is an optional stretch enhancement.

**[Live application](https://ajaiaassessment.onrender.com)** · **[Public GitHub repository](https://github.com/Demste/AjaiaAssessment)**

Render Free can put the service to sleep after 15 minutes of inactivity. Allow about 60 seconds for the first request to wake it. No paid services or dependencies are required for review. [Render Free web services](https://render.com/docs/free#spinning-down-on-idle)

The public demo uses simulated identities. Anyone can select Alex Morgan or Jamie Chen without registering or entering a password. Use sample text and keep confidential information out of the demo.

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

## Export documents

Owners and shared editors can use **Export** to download or print the current draft, including unsaved edits. Both actions work in the browser without saving the document.

- **Download Markdown (.md)** exports headings, paragraphs, bold, italic, lists, and line breaks using a filename based on the document title. Underlined text keeps its text and any bold or italic styling. Numbered lists use decimal markers, and a few emphasis and line-break cases use inline HTML.
- **Print / Save as PDF** opens the browser's print dialog with the title and formatted content. Choose **Save as PDF** if your browser offers it. Paper size, pagination, and browser headers and footers depend on the print settings.

## Project commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite frontend and Express API |
| `npm test` | Run the SQLite integration suite and Markdown export unit tests |
| `npm run typecheck` | Check TypeScript across the frontend, API, and tests |
| `npm run build` | Build the frontend into `dist/` |
| `npm start` | Serve the built frontend and API at [http://127.0.0.1:3001](http://127.0.0.1:3001) after building |

## Optional configuration

Copy `.env.example` to `.env` to override defaults. Express listens on `127.0.0.1:3001` by default. Set `HOST` or `PORT` to override the listener. Set `LIBSQL_URL` for a different SQLite file or a remote libSQL database. Create the parent directory first when specifying a different local file.

## Deploy to Render with Turso

The live app uses a Render Free Web Service in Frankfurt, the Node runtime, and the GitHub repository's `main` branch.

| Setting | Value |
| --- | --- |
| Build command | `npm ci --include=dev && npm run build` |
| Start command | `npm start` |
| `NODE_VERSION` | `22` |
| `HOST` | `0.0.0.0` |
| `PORT` | Provided by Render |
| `LIBSQL_URL` | Existing Turso libSQL database URL, set in Render |
| `LIBSQL_AUTH_TOKEN` | Existing Turso database token with schema and write access, set securely in Render |

On startup, Express initializes the Turso schema and seeds Alex Morgan and Jamie Chen if needed. The service serves the built frontend and `/api` from the same public origin. Hosted documents and shares are stored in Turso, independently of Render's ephemeral filesystem. Local development defaults to SQLite. [Render Free web services](https://render.com/docs/free#local-files-lost-on-redeploy) · [Turso TypeScript SDK](https://docs.turso.tech/sdk/ts/reference)

## Known limitations

- The demo selector simulates authentication. The API trusts the selected identity header, so anyone with API access can act as either demo user.
- Document saves are manual. Concurrent saves use last-write-wins for the fields included in each request. Collaborators see saved changes when they reopen the document.
- Sharing grants a fixed editor role to the other demo user. Owners retain title and sharing control. The application provides no share revocation.
- The production build emits a non-blocking bundle-size warning. It produced 755.87 KB of JavaScript (243.00 KB gzipped) and 19.04 KB of CSS.

See the [future improvement priorities](SUBMISSION.md#future-improvement-priorities).

## Verification status

The human tester reported these results after document export was added.

| Check | Result |
| --- | --- |
| `npm test` | 25/25 passed in 2.21 seconds (13 backend integration tests and 12 Markdown export unit tests) |
| `npm run typecheck` | Passed with no errors |
| `npm run build` | Succeeded in 3.16 seconds with the non-blocking bundle-size warning above |
| Live manual checks | Editing, saving, sharing, Markdown download, browser PDF export, and export as a shared editor passed |
