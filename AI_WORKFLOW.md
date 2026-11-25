# AI workflow

## Planning and implementation

ChatGPT helped plan the project, make scope decisions, prepare implementation prompts, and review Codex's implementation reports. The human tester rejected unnecessary external authentication and kept the MVP intentionally scoped to a local workflow with two seeded demo identities and one editor role.

Codex implemented the frontend, API, and SQLite persistence in one npm project, wrote the Vitest/Supertest integration tests, and made revisions in response to the human tester's findings.

- Used one Tiptap schema for editor configuration and API validation. Import decodes UTF-8 on the server and stores text as paragraph nodes.
- Used header-based demo identities to exercise ownership and sharing. Saves use last-write-wins.
- Kept the frontend build and Express listener separate from API construction. Bundled the two development processes under one npm command.
- The initial npm install failed at registry DNS resolution in the sandbox. Retrying with registry access installed dependencies and generated the lockfile. npm reported an esbuild postinstall approval notice, and the platform esbuild package was installed.

## Findings and revisions

The first automated run passed 9 of 10 tests. The persistence test reported `EBUSY` during temporary SQLite file cleanup on Windows. Both clients already called `close()`, and the installed libSQL version has a documented issue retaining native file handles after preparing statements. Codex moved the write and reopen phases into separate Node processes, closed each client in `finally`, and waited for both processes to exit before cleanup. The existing persistence assertions were preserved. [libSQL prepared-statement lifecycle issue](https://github.com/tursodatabase/libsql-js/issues/230)

The human tester requested deletion after creating documents by mistake during usability testing. Codex added owner-only permanent deletion, cascading share removal, and integration tests for successful deletion and denied requests.

## Final verification reported by the human tester

- All 13 automated integration tests passed, including the Windows persistence test.
- TypeScript type checking passed.
- The production build succeeded with a non-blocking bundle-size warning.
- All core manual functionality checks passed, including owner-only deletion.
- The local production application ran successfully.
