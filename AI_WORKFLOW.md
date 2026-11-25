# AI workflow

## Planning and implementation

ChatGPT helped analyze requirements, plan the architecture, make scope decisions, prepare implementation prompts, review Codex's reports, and guide deployment. The human rejected external authentication and cloud dependencies for the local MVP and selected two seeded identities and a simple editor-sharing model.

Codex implemented the React frontend, Express API, SQLite persistence, and Vitest/Supertest integration tests. It made targeted revisions, updated documentation, and handled GitHub commits and pushes. AI accelerated implementation by carrying the shared editor schema and access rules through the frontend, API, and tests. The human manually tested the initial MVP, ran the automated suite, reviewed its results, and decided which findings to address.

## Findings and revisions

The human found that the first automated run passed 9 of 10 tests. The persistence test reported `EBUSY` during temporary SQLite file cleanup on Windows, and the human requested a fix that kept the original assertions. Both clients already called `close()`, and the installed libSQL version has a documented issue retaining native handles after preparing statements. Codex moved the write and reopen phases into separate Node processes, closed each client in `finally`, and waited for both processes to exit before cleanup. The test still makes the same persistence assertions. [libSQL prepared-statement lifecycle issue](https://github.com/tursodatabase/libsql-js/issues/230)

The human found during usability testing that accidentally created documents could not be deleted and requested owner-only deletion with tests. Codex added permanent deletion, share cleanup, and tests for successful deletion and denied requests. The expanded suite passed all 13 tests.

## Deployment and MVP verification

The human configured Render and Turso. Codex added the configurable listener and adapted database writes for remote libSQL, including atomic deletion of documents and shares. Render built and deployed successfully.

After the deployment compatibility changes, the human reran `npm test` (13 passed in 2.54 seconds), `npm run typecheck` (passed with no errors), and `npm run build` (succeeded in 2.90 seconds). The build emitted a non-blocking warning for a 751.80 KB JavaScript bundle (241.44 KB gzipped). The human also verified the core live workflows, persistence after page refresh, and owner-only deletion.

## Optional document export and final verification

The human selected document export as the optional stretch enhancement. Codex added client-side Markdown download and a browser print view for the open draft, then wrote unit tests for Markdown conversion and filenames.

The human ran the final checks. All 25 tests passed in 2.21 seconds (13 backend integration tests and 12 Markdown export unit tests). Type checking passed and the production build succeeded in 3.16 seconds. On the live application, the human verified Markdown download, browser PDF export, export as a shared editor, and the existing editing, saving, and sharing workflows. The [future improvement priorities](SUBMISSION.md#future-improvement-priorities) remain open.
