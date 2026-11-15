---
spec_id: 001-web-task-board-on-the-start-page-that
title: Web task board on the start page that lists tasks and creates a task with an optional due date
status: done
priority: P1
shape: web-nextjs
parent: ika100-demo/taskboard17-gitops:001-persistent-tasks-and-web-task-board
---

# 001 — Web task board on the start page that lists tasks and creates a task with an optional due date

## Problem

The Task API keeps tasks in memory, so every restart or redeploy of the API loses all tasks, and several API instances would each see different tasks. The web component has no features yet, so the only way to see or create a task is to call the API by hand. People who want to use the task board today cannot rely on it to remember anything, and cannot use it without an HTTP client. With the API and the web component both deployed, this is the moment to make tasks durable and give people a page to work with them.

## System context

Slice of the system plan `001-persistent-tasks-and-web-task-board` in `ika100-demo/taskboard17-gitops` for `taskboard17-web` (web-nextjs). The system criteria and the contract below are binding: every criterion of this spec implements one of them and names it: `(system AC-<NNN>.<n>)`.

### System criteria

- **AC-001.3** Given tasks A, B and C exist (C without a due date), when a user opens the web task board, then the page lists exactly A, B and C in creation order, oldest first, each showing its title and its due date as `YYYY-MM-DD`, with C showing "No due date".
- **AC-001.4** Given no task exists, when a user opens the web task board, then the page shows the message "No tasks yet" and the create form.
- **AC-001.5** Given the web task board is open, when the user enters the title "Buy milk" and the due date 2026-12-01 (or leaves the due date empty) and submits the form, then the new task appears at the end of the list without the user reloading the page, the form is cleared, and `GET /tasks` lists the task with `title` `"Buy milk"` and `due_date` `"2026-12-01"` (or `null`).
- **AC-001.6** Given the web task board is open, when the user submits a title that is empty, only whitespace or longer than 200 characters, then the page shows "Title must be 1 to 200 characters" next to the title field, keeps the entered values, and no task is created.
- **AC-001.8** Given the API cannot list or save tasks (it is unreachable or answers an error), when a user opens the web task board or submits the create form, then the page shows "Tasks could not be loaded. Try again." or "Task could not be saved. Try again." respectively, keeps the entered form values, and shows no partial or stale list as if it were current.

### Contract

Caller: `taskboard17-web` (server side only). Provider: `taskboard17-api`, base URL `TASKBOARD_API_URL` (`http://taskboard17-api` in-cluster). JSON over HTTP, `Content-Type: application/json`. No authentication (open access in dev, see the spec's non-goals). Unknown extra fields in requests are ignored; callers ignore unknown extra fields in responses.

**Task object:** `{"id": string, "title": string, "due_date": string | null}`. `id` is server generated and opaque (do not parse it); `title` is stored trimmed, 1 to 200 characters; `due_date` is a calendar date `YYYY-MM-DD` or `null`. No other fields.

**`GET /tasks`** — list every task.
- `200`: JSON array of task objects, all tasks, in creation order, oldest first, no paging. `[]` when none.
- `503`: database unavailable (body below).

**`POST /tasks`** — create a task.
- Request: `{"title": string, "due_date": string | null}`; `due_date` may be omitted (same as `null`). The web sends `due_date: null` when the date field is empty, and the trimmed title it validated (1 to 200 characters).
- `201`: the created task object.
- `422`: validation error (title missing, not a string, empty or whitespace only, longer than 200 after trimming; `due_date` not a `YYYY-MM-DD` calendar date). No task is created.
- `503`: database unavailable. No task is created.

**`GET /ready`** (platform readiness probe): `200 {"status": "ready"}` when the database answers; `503 {"status": "not ready"}` otherwise. **`GET /health`** (liveness): always `200 {"status": "ok"}` while the process runs, never checks the database.

### Errors

- `422` uses FastAPI's standard body: `{"detail": [{"loc": ["body", "<field>"], "msg": string, "type": string, ...}]}`; the field is named by the last element of `loc` (`title` or `due_date`).
- `503` body: `{"detail": "Database unavailable"}`.
- The web treats every response other than `200` with a JSON array (for `GET /tasks`) or `201` with a task object (for `POST /tasks`) as a failure, including `422`, `503`, any other status, a non-JSON body and a connection error: it shows "Tasks could not be loaded. Try again." or "Task could not be saved. Try again.", keeps the form values and never renders a partial or stale list as current. (A `422` cannot normally happen, because the web checks the title rule itself and the date input only yields real dates.)
- The web never retries `POST /tasks` automatically (it is not idempotent); the user resubmits.

### Timeouts

- Web → API, `GET /tasks` and `POST /tasks`: 5 s total per call (connect + response), no automatic retry. On timeout the web shows the error message of that action.
- API → Postgres: connect timeout 2 s, query (statement) timeout 2 s; on either, or when no connection can be had, the task route answers `503` (well inside the web's 5 s).
- `GET /ready`: database check bounded to 500 ms so it answers within the probe's 1 s timeout; a slow or down database means `503` and the platform stops routing to that instance until it answers again. `GET /health` does not touch the database.

### Provided by the system

The gitops part of this plan wires these for this repo; rely on them, do not ask for them again:

- env `TASKBOARD_API_URL=http://taskboard17-api`

### Notes for this repo

The Task API base URL is the server-only env var TASKBOARD_API_URL (set by the gitops entry; document it in
docs/env-vars.md, never NEXT_PUBLIC_). The browser never calls the Task API directly: the start page loads the
list on the server and the create form submits through a Server Action (or a route handler of this app) that
calls `POST /tasks`. No polling (spec A9). Tests stub the Task API at TASKBOARD_API_URL.
In dev, smoke tests of both repos leave tasks in the database, so a deployed "No tasks yet" check cannot be a smoke test;
keep a read-only smoke check that `/` loads and shows either the list or "No tasks yet".

## Stories

<!-- As a <persona>, I want <goal>, so that <benefit>. -->

## Acceptance criteria

- **AC-001.1** Given the Task API's `GET /tasks` returns tasks A, B and C in that order (C with `due_date` `null`), when a user opens the start page `/`, then the page lists exactly A, B and C in that order, each with its title and its due date as `YYYY-MM-DD`, and C shows "No due date" (system AC-001.3)
- **AC-001.2** Given the Task API's `GET /tasks` returns `[]`, when a user opens `/`, then the page shows "No tasks yet" and the create form with a title field and a date input for the due date (system AC-001.4)
- **AC-001.3** Given the board is open, when the user enters the title "Buy milk" and the due date 2026-12-01 (or leaves the due date empty) and submits, then the web sends `POST /tasks` with `{"title": "Buy milk", "due_date": "2026-12-01"}` (or `"due_date": null`), and on `201` the returned task appears at the end of the list without a page reload, the "No tasks yet" message is gone and the form is cleared (system AC-001.5)
- **AC-001.4** Given the board is open, when the user submits a title that is empty, only whitespace, or longer than 200 characters after trimming, then the page shows "Title must be 1 to 200 characters" next to the title field, keeps the entered title and due date, and sends no request to the Task API (system AC-001.6)
- **AC-001.5** Given the Task API is unreachable, does not answer within 5 seconds, or answers `GET /tasks` with anything but `200` and a JSON array, when a user opens `/`, then the page shows "Tasks could not be loaded. Try again." and shows neither a task list nor "No tasks yet" (system AC-001.8)
- **AC-001.6** Given the board is open, when the user submits a valid form and the Task API is unreachable, does not answer within 5 seconds, or answers anything but `201`, then the page shows "Task could not be saved. Try again.", keeps the entered title and due date, and the list does not show the unsaved task (system AC-001.8)
- **AC-001.7** Given the user opens or reloads `/`, when tasks were created elsewhere since the last load, then the page shows the list as `GET /tasks` returns it at that moment, never a list cached at build time or from an earlier request (system AC-001.3, AC-001.8)

## Non-goals

## Assumptions

<!-- Spec 149: decisions taken by default, approved with the spec. One bullet each: - **A1** <the decision> (other option: <…>; affects AC-…). A revised one is struck through (~~…~~), never deleted. -->

## Open questions

<!-- Only what may not be decided by default (spec 149): security or access, money, destroying or migrating data, or a request too ambiguous to build. Approval is refused while any is open. Strike answered ones (~~…~~) and fold the answer into the criteria. -->

## Changelog

- 2026-11-15 created from the system plan, with its criteria (spec 147)
- 2026-11-15 approved
- 2026-11-15 building
- 2026-11-15 done
