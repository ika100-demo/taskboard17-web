---
spec_id: 001-web-task-board-on-the-start-page-that
shape: web-nextjs
spec_hash: 60d5e21007b1
summary: Start page lists tasks from the Task API and creates a task with an optional due date via a Server Action
tasks:
  - id: t1
    title: Add the server-side Task API client and the shared title rule
    files: [lib/tasks-api.ts, lib/task-title.ts, docs/env-vars.md]
    covers: [AC-001.1, AC-001.3, AC-001.4, AC-001.5, AC-001.6, AC-001.7]
    parallel_safe: true
    depends_on: []
  - id: t2
    title: Add the create-task Server Action and the TaskBoard client component
    files: [app/actions.ts, app/_components/task-board.tsx]
    covers: [AC-001.1, AC-001.2, AC-001.3, AC-001.4, AC-001.6]
    parallel_safe: true
    depends_on: [t1]
  - id: t3
    title: Turn the start page into the task board
    files: [app/page.tsx, app/globals.css, tests/page.test.tsx, e2e/home.spec.ts, e2e/smoke.spec.ts]
    covers: [AC-001.1, AC-001.2, AC-001.3, AC-001.4, AC-001.5, AC-001.6, AC-001.7]
    parallel_safe: true
    depends_on: [t2]
---

# Plan — 001 Web task board on the start page

The contract (module signatures, rendered markup, error handling) is in [design.md](design.md). Acceptance tests live in their own files under `tests/`, written before t1; no task edits them. `tests/page.test.tsx` and `e2e/*.spec.ts` are the skeleton's own tests and are updated by t3 because the start page changes.

## t1 — Add the server-side Task API client and the shared title rule

**Files:** lib/tasks-api.ts, lib/task-title.ts, docs/env-vars.md
**Covers:** AC-001.1, AC-001.3, AC-001.4, AC-001.5, AC-001.6, AC-001.7
**Goal:** one place that talks to the Task API with the contract's 5 s timeout, no caching and strict response checks, plus the pure title rule both sides share.

**Implementation notes:**
- `lib/task-title.ts`: `TITLE_ERROR`, `validateTitle(raw)` as in design.md; trim, count code points (`[...t].length`), 1..200. No imports, so the client bundle can use it.
- `lib/tasks-api.ts`: `Task`, `TASK_API_TIMEOUT_MS = 5000`, `TaskApiError`, `listTasks()`, `createTask(input)`.
- Read `process.env.TASKBOARD_API_URL` inside each call; unset or empty throws `TaskApiError`; strip a trailing `/`.
- Every fetch: `cache: "no-store"`, `signal: AbortSignal.timeout(TASK_API_TIMEOUT_MS)`, no retry; `POST` with `Content-Type: application/json` and body `{title, due_date}`.
- Success only on `200` + array of valid task objects (list) or `201` + valid task object (create); validate every element's field types with a small type guard. Anything else (status, JSON parse error, shape, network/abort error) throws `TaskApiError` with a short `reason`.
- Log each failure with `logger.warn("task api request failed", { op, reason, status })`; never log titles.
- `docs/env-vars.md`: add `TASKBOARD_API_URL` under a new "Task API" section: server-only, no default (unset means the board shows its load error), set by the gitops entry to `http://taskboard17-api`; never `NEXT_PUBLIC_`.

**Done when:** `devbox run quality` is clean; acceptance tests that exercise the client directly (if any) pass.

## t2 — Add the create-task Server Action and the TaskBoard client component

**Files:** app/actions.ts, app/_components/task-board.tsx
**Covers:** AC-001.1, AC-001.2, AC-001.3, AC-001.4, AC-001.6
**Goal:** the interactive board: list, empty message and controlled create form that appends saved tasks without a reload and keeps values on every failure.

**Implementation notes:**
- `app/actions.ts` (`"use server"`): `createTaskAction({title, due_date})` → `CreateTaskResult`; `due_date === ""` → `null`; re-run `validateTitle` and return `invalid_title` without calling the API; catch `TaskApiError` → `save_failed`.
- `task-board.tsx` (`"use client"`): state `tasks` (from `initialTasks`), `title`, `dueDate`, `titleError`, `saveError`, `pending`.
- Render exactly the markup in design.md's "Rendered page" table (labels, `aria-label`s, `role="alert"`, `id="title-error"`, `<time dateTime>`), excluding the `h1` and the load-error state, which belong to the page.
- `onSubmit`: `preventDefault`; clear both errors; if `validateTitle(title)` fails, set the title error and return (no action call); else set pending, `await createTaskAction(...)`.
- On `ok`: append `result.task`, clear `title` and `dueDate`. On `invalid_title`: show the title error. On `save_failed` or a thrown action: show the save error. Always keep inputs on failure; clear pending in `finally`.
- Form uses `noValidate`; no `required`/`maxLength` on the title input.

**Done when:** `devbox run quality` is clean; acceptance tests that render `TaskBoard` directly (if any) pass.

## t3 — Turn the start page into the task board

**Files:** app/page.tsx, app/globals.css, tests/page.test.tsx, e2e/home.spec.ts, e2e/smoke.spec.ts
**Covers:** AC-001.1, AC-001.2, AC-001.3, AC-001.4, AC-001.5, AC-001.6, AC-001.7
**Goal:** `/` loads the tasks per request on the server and renders the board or the load error.

**Implementation notes:**
- `app/page.tsx`: `export const dynamic = "force-dynamic"`; async `HomePage`; `<h1>Tasks</h1>`; `try { tasks = await listTasks() }`, on `TaskApiError` render only `<p role="alert">Tasks could not be loaded. Try again.</p>`; otherwise `<TaskBoard initialTasks={tasks} />`. Remove the skeleton hero, feature cards and get-started section.
- `app/globals.css`: styles for the list, form, field error and alert using the existing design tokens; keep the 375 px no-horizontal-scroll behaviour.
- `tests/page.test.tsx`: replace the skeleton assertions with page-level unit tests (stubbed `fetch`, `TASKBOARD_API_URL` set) for the h1 and the three page states, keeping the 80 % coverage gate green.
- `e2e/home.spec.ts`: h1 is now "Tasks"; replace the "Check health" link check with the header's "Health" nav link; keep the landmark, 404 and phone-width tests. Without a Task API locally the page shows the load error, which these tests must accept.
- `e2e/smoke.spec.ts`: keep it read-only (no `@writes`); `/` loads, h1 "Tasks" is visible, and either `ul[aria-label="Tasks"]` or the text "No tasks yet" is visible (spec note: dev holds smoke data, so "No tasks yet" alone cannot be asserted).

**Done when:** all acceptance tests for AC-001.1 to AC-001.7 pass; `devbox run ci` is green.
