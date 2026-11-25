# Workspace MVP submission

Workspace is a rich-text document editor with local SQLite and a hosted demo backed by Turso. Reviewers can create, format, save, and share documents without a paid account.

**[Live application](https://ajaiaassessment.onrender.com)** · **[Public GitHub repository](https://github.com/Demste/AjaiaAssessment)**

The Render Free instance may sleep after 15 minutes of inactivity. Allow about 60 seconds for the first request to wake the service. [Render Free web services](https://render.com/docs/free#spinning-down-on-idle)

## Demo walkthrough

1. Select **Alex Morgan** or **Jamie Chen**. The public demo has no registration or password. Use sample text only.
2. Create a document, format some text, and click **Save**. You can also import a UTF-8 `.txt` file up to 1 MB.
3. Use **Share** to grant the other user editor access. Switch to that user and open the document under **Shared with Me** to edit and save it.
4. Switch back to the owner to rename or permanently delete the document. Deleting the document also removes its shares.
5. As either user, open **Export** to download Markdown or open **Print / Save as PDF**. Both options include the open draft, even before saving.

## Run locally

Use Node.js 22.12 or later and npm. From the repository root, run:

```sh
npm install
npm run dev
```

Open [Workspace at localhost:5173](http://127.0.0.1:5173). Startup creates `data/workspace.db` and seeds both demo users.

## Implemented scope

- **Mandatory MVP** · Rich-text editing, manual save status and unsaved-change warnings, UTF-8 TXT import, demo identities, owned and shared views, owner-only renaming, server-enforced editor permissions, and persistent documents and shares.
- **Human-driven improvement** · Owner-only permanent deletion with share cleanup, identified during usability testing.
- **Optional stretch enhancement** · Markdown download and native Print / Save as PDF for the current draft, available to owners and shared editors.

## MVP verification

The human tester reported these results after the deployment compatibility changes and before document export was added.

| Check | Result |
| --- | --- |
| `npm test` | All 13 integration tests passed in 2.54 seconds |
| `npm run typecheck` | Passed with no errors |
| `npm run build` | Succeeded in 2.90 seconds |
| Render build and deployment | Succeeded |
| Render npm audit | Reported zero vulnerabilities |
| Live manual checks | Core workflows, persistence after page refresh, and owner-only deletion passed |

The Markdown unit tests and both export workflows are pending human verification.

## Known limitations

- The public demo uses selectable identities. Reviewers should keep sensitive data out of it.
- Saving is manual. Concurrent saves use last-write-wins, and changes appear when a collaborator reopens the document.
- Sharing grants one editor role, and access lasts until the owner permanently deletes the document.
- The build has a non-blocking warning for a 751.80 KB JavaScript bundle (241.44 KB gzipped).
- Markdown keeps the text but drops underline styling. PDF pagination follows browser print settings.

## Future improvement priorities

1. Debounced autosave.
2. Share revocation.
3. Concurrent-edit conflict detection.
4. Bundle optimization.
5. Automated browser smoke tests.

## Deliverables

| Deliverable | Status |
| --- | --- |
| Live application | [Workspace on Render](https://ajaiaassessment.onrender.com) and `LIVE_URL.txt` |
| Public source repository | [Demste/AjaiaAssessment](https://github.com/Demste/AjaiaAssessment) |
| Frontend, API, and shared types | `src/`, `server/`, `shared/`, and `index.html` |
| Integration tests | `tests/documents.test.ts` and `tests/fixtures/file-database.ts` |
| Markdown export unit tests | `tests/markdown-export.test.ts` |
| Setup and configuration | `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `.env.example`, and `.gitignore` |
| Project documentation | `README.md`, `ARCHITECTURE.md`, `AI_WORKFLOW.md`, and `SUBMISSION.md` |
| Google Drive folder URL | Pending |
| Walkthrough video URL | Pending |
