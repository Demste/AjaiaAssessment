# AI workflow

## Planning and implementation

ChatGPT helped analyze requirements, plan the architecture, prioritize scope, prepare implementation prompts, review Codex's reports, and plan deployment. The human rejected external authentication and cloud dependencies during local development. Two seeded identities and one editor role covered the local workflow.

Codex implemented the React frontend, Express API, SQLite persistence, and Vitest/Supertest integration tests in one npm project. AI accelerated implementation by carrying the shared editor schema and access rules through the frontend, API, and tests. The human ran the automated suite and tested the product manually.

## Findings and revisions

The first automated run passed 9 of 10 tests. The persistence test reported `EBUSY` during temporary SQLite file cleanup on Windows. Both clients already called `close()`, and the installed libSQL version has a documented issue retaining native file handles after preparing statements. Codex moved the write and reopen phases into separate Node processes, closed each client in `finally`, and waited for both processes to exit before cleanup. The existing persistence assertions were preserved. [libSQL prepared-statement lifecycle issue](https://github.com/tursodatabase/libsql-js/issues/230)

Human usability testing identified that accidentally created documents could not be deleted. Codex added owner-only permanent deletion, share cleanup, and tests for successful deletion and denied requests. The expanded suite passed all 13 tests.

## Deployment and final verification

The human configured Render and Turso. Codex added the configurable listener and adapted database writes for remote libSQL, including atomic deletion of documents and shares. Render built and deployed successfully, and its npm audit reported zero vulnerabilities.

After the deployment compatibility changes, the human reran `npm test` (13 passed in 2.54 seconds), `npm run typecheck` (passed with no errors), and `npm run build` (succeeded in 2.90 seconds). The build emitted a non-blocking warning for a 751.80 KB JavaScript bundle (241.44 KB gzipped). The human also verified the core live workflows, persistence after page refresh, and owner-only deletion.
