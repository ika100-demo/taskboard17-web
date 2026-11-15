# Design — 001 Web task board on the start page

## Decisions

- The browser never calls the Task API. The start page `/` is an async Server Component that loads the list with `listTasks()`; the create form is a Client Component that calls the Server Action `createTaskAction` as a plain async function (not a `<form action>`), so the form stays controlled and keeps its values on every failure (AC-001.4, AC-001.6) and React does not reset it.
- The title rule is checked twice with one shared pure function (`lib/task-title.ts`): in the browser before calling the action, so an invalid title sends no request at all (AC-001.4), and again in the action, which never trusts its input.
- `/` is rendered per request: `export const dynamic = "force-dynamic"` on the page and `cache: "no-store"` on every Task API fetch, so no build-time or earlier-request list is ever shown (AC-001.7). No polling (spec note, system A9).
- Every Task API failure (connection error, 5 s timeout, any status other than the expected one, non-JSON body, wrong shape, `TASKBOARD_API_URL` unset) becomes one `TaskApiError`; the page and the action never distinguish the causes in the UI (contract "Errors"). The page catches it itself and does not fall through to `app/error.tsx`.
- On a load failure the page shows only the error message: no list, no "No tasks yet" and no create form (a task added to a list that is not shown would itself be a stale view). The user reloads to retry.
- `/api/ready` stays independent of the Task API: the web can still serve its error message when the API is down, and gating readiness on it would take every web instance out of routing at once.
- Due dates are rendered as the `YYYY-MM-DD` string the API returns, never parsed into a `Date`, so no time zone can shift the day.
- The title length counts Unicode code points (`[...s].length`), matching the API's Python `len()`.
- The page's `h1` becomes "Tasks"; the skeleton's hero and feature cards are removed. The layout's header still shows the app name.
- No ADR: the server-side-only access to the Task API is fixed by the system plan; everything else is local to this page.

## Modules

| Module | Responsibility | New / changed |
|---|---|---|
| `lib/task-title.ts` | pure title rule, shared by client and server | new |
| `lib/tasks-api.ts` | server-side Task API client: `listTasks`, `createTask`, `TaskApiError`, `Task` type | new |
| `app/actions.ts` | `"use server"`: `createTaskAction` | new |
| `app/_components/task-board.tsx` | `"use client"`: list, empty message, create form, client state | new |
| `app/page.tsx` | async Server Component: loads tasks, renders board or load error | changed |
| `docs/env-vars.md` | documents `TASKBOARD_API_URL` | changed |

## Contract

### Task API (consumed, binding from the system plan)

As in the spec's "System context / Contract". Base URL from `TASKBOARD_API_URL` (trailing `/` stripped). `GET /tasks` succeeds only on `200` with a JSON array whose every element has `id: string`, `title: string`, `due_date: string | null`. `POST /tasks` sends `Content-Type: application/json`, body `{"title": <trimmed>, "due_date": "<YYYY-MM-DD>" | null}`, and succeeds only on `201` with such a task object. Each call: `fetch(url, { cache: "no-store", signal: AbortSignal.timeout(5000) })`, no retry.

### Internal modules (testers may import these)

```ts
// lib/task-title.ts
export const TITLE_ERROR = "Title must be 1 to 200 characters";
export function validateTitle(raw: string): { ok: true; title: string } | { ok: false };
// ok when raw.trim() has 1..200 code points; title is the trimmed value

// lib/tasks-api.ts
export type Task = { id: string; title: string; due_date: string | null };
export const TASK_API_TIMEOUT_MS = 5000;
export class TaskApiError extends Error {}
export function listTasks(): Promise<Task[]>;                                        // throws TaskApiError
export function createTask(input: { title: string; due_date: string | null }): Promise<Task>; // throws TaskApiError
// reads process.env.TASKBOARD_API_URL on every call (not at import), so tests can set it per test

// app/actions.ts  ("use server")
export type CreateTaskResult = { ok: true; task: Task } | { ok: false; error: "invalid_title" | "save_failed" };
export async function createTaskAction(input: { title: string; due_date: string }): Promise<CreateTaskResult>;
// due_date "" -> null; invalid title -> { ok:false, error:"invalid_title" } without any fetch;
// TaskApiError -> { ok:false, error:"save_failed" }

// app/_components/task-board.tsx  ("use client")
export function TaskBoard(props: { initialTasks: Task[] }): JSX.Element;

// app/page.tsx
export const dynamic = "force-dynamic";
export default async function HomePage(): Promise<JSX.Element>;
```

Failures are logged with `logger.warn("task api request failed", { op: "list" | "create", reason, status? })`; titles are not logged.

### Rendered page (what the acceptance tests select on)

| State | Markup |
|---|---|
| Always | one `<h1>` "Tasks" |
| Tasks exist (AC-001.1) | `<ul aria-label="Tasks">`, one `<li>` per task in API order; each holds the title and either `<time dateTime="YYYY-MM-DD">YYYY-MM-DD</time>` or the text "No due date" |
| No tasks (AC-001.2) | text "No tasks yet"; no `ul[aria-label=Tasks]` |
| Load failed (AC-001.5) | `<p role="alert">` "Tasks could not be loaded. Try again."; no list, no "No tasks yet", no form |
| Form (when loaded) | `<form aria-label="Create task" noValidate>`; text input labelled "Title" (`name="title"`, no `required`, no `maxLength`); `<input type="date">` labelled "Due date" (`name="due_date"`); submit button "Add task", disabled while saving |
| Invalid title (AC-001.4) | `<p id="title-error">` "Title must be 1 to 200 characters"; title input gets `aria-invalid="true"` and `aria-describedby="title-error"`; both inputs keep their values; no fetch happens |
| Save failed (AC-001.6) | `<p role="alert">` "Task could not be saved. Try again." inside the form; inputs keep their values; list unchanged |
| Saved (AC-001.3) | returned task appended at the end of the list (list appears if it was empty, "No tasks yet" disappears); both inputs cleared; any earlier error message removed |

### Testing against the stubbed API

Acceptance tests run in Vitest (jsdom): set `process.env.TASKBOARD_API_URL` (e.g. `http://task-api.test`) and stub `fetch` (`vi.stubGlobal`); render the page with `render(await HomePage())`. In Vitest the `"use server"` directive is inert, so submitting the form runs `createTaskAction` in-process against the same stubbed `fetch`. A stub that never answers sees the abort through the `signal` passed to `fetch`.
