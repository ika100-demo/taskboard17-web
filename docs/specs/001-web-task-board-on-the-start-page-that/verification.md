# Verification — 001 Web task board on the start page

**Result:** pass
**Commit:** 23d6968 · **Base:** 1510114 · **Trace:** 7/7 criteria named by tests (`tests/task-board.test.tsx`) · **Cycle:** 2

| Criterion | Verdict | Tests | Implementation | Notes |
|---|---|---|---|---|
| AC-001.1 | met | `tests/task-board.test.tsx::AC-001.1 lists tasks in API order with title and YYYY-MM-DD due date, 'No due date' for null` | `app/page.tsx:10`, `app/page.tsx:27`, `app/_components/task-board.tsx:48-56` | Asserts exactly 3 items in API order, `<time dateTime>` text `YYYY-MM-DD`, "No due date" for null. |
| AC-001.2 | met | `tests/task-board.test.tsx::AC-001.2 shows 'No tasks yet' and the create form when there are no tasks` | `app/_components/task-board.tsx:57-59`, `app/_components/task-board.tsx:60-88` | Asserts the message, no list, a form with a Title field and a `type="date"` input. |
| AC-001.3 | met | `tests/task-board.test.tsx::AC-001.3 posts the trimmed title and due date and appends the returned task without reload`, `::AC-001.3 sends due_date null when the date is left empty and appends at the end of the list` | `app/_components/task-board.tsx:27-33`, `app/actions.ts:19-22`, `lib/tasks-api.ts:62-72` | Asserts POST URL, `Content-Type`, parsed body (`due_date` string and `null`), append at the end, "No tasks yet" gone, both inputs cleared, in the same render (no reload). |
| AC-001.4 | met | `tests/task-board.test.tsx::AC-001.4 rejects a title that is %s without calling the Task API` (empty, whitespace, 201, 201 after trimming), `::AC-001.4 accepts a title of exactly 200 characters` | `app/_components/task-board.tsx:23-26`, `app/_components/task-board.tsx:69-72`, `lib/task-title.ts:6-12`, `app/actions.ts:15-18` | Asserts message `id="title-error"` linked via `aria-describedby` (next to the field), values kept, zero fetch calls; 200 accepted. |
| AC-001.5 | met | `tests/task-board.test.tsx::AC-001.5 shows the load error when the Task API is unreachable`, `::AC-001.5 shows the load error on %s` (500, 404, object, non-JSON), `::AC-001.5 shows the load error when the Task API gives no answer within 5 s` | `app/page.tsx:9-22`, `lib/tasks-api.ts:5`, `lib/tasks-api.ts:36-58` | Cycle 1 TEST LOOSER fixed: on a fake clock the page has not settled at 4.9 s and shows the load error at 5.0 s, so the bound is pinned to (4.9 s, 5.0 s]. No list and no "No tasks yet" asserted on every branch. |
| AC-001.6 | met | `tests/task-board.test.tsx::AC-001.6 shows the save error and keeps the input when the API %s` (500, 200, 422, unreachable), `::AC-001.6 shows the save error when the API gives no answer within 5 s` | `app/actions.ts:20-27`, `app/_components/task-board.tsx:36-41`, `app/_components/task-board.tsx:84`, `lib/tasks-api.ts:36-45` | Cycle 1 TEST LOOSER fixed: no alert at 4.9 s, the save error at 5.0 s (fake clock). Kept title and date, and an unchanged list, asserted. |
| AC-001.7 | met | `tests/task-board.test.tsx::AC-001.7 is rendered per request and fetches the list with cache no-store`, `::AC-001.7 shows what GET /tasks returns at the moment of each render` | `app/page.tsx:5`, `lib/tasks-api.ts:38` | Asserts `dynamic === "force-dynamic"`, `cache: "no-store"`, and that a second render shows the changed API answer. |

## Tightened acceptance tests

| File | Reason | Asserts the criterion as written |
|---|---|---|
| `tests/task-board.test.tsx` (AC-001.5, AC-001.6 timeout tests, commit `23d6968`) | cycle 1 found them TEST LOOSER: they waited up to 15 s / 9 s, so any timeout up to that limit passed | yes: `useFakeClockForTimeout` (`:32-39`) replaces `AbortSignal.timeout` with a fake-clock abort. The tests assert nothing at 4.9 s and the error at 5.0 s (`:223-235`, `:273-278`). Without a timeout, or with one shorter or longer than 5 s, they fail. The other assertions are unchanged. Cleanup restores real timers and mocks (`:70-71`). |

## Non-goals

The spec lists none. No template-owned layout changes: `app/layout.tsx` (header, footer, navigation) is untouched, and the `globals.css` additions are scoped to `.board`. The e2e header check asserts the existing "Health" nav link and adds none. ✔

## Deviations from the plan

- `app/_components/feature-card.tsx` and `app/_components/icons.tsx` were deleted, and neither is in any task's `files`. Acceptable: only the skeleton hero/cards used them, and design.md removes those.
- `docs/backlog.md` changed, in no task's `files`. Acceptable: `cplat spec index` generates it.
- `tests/task-board.test.tsx` is in no task's `files`. Acceptable: these are the acceptance tests, written before t1 as the plan says, and tightened only in `23d6968` (above).
- Tasks t1–t3 are all `done: true`.
- Minor: the skeleton's unused hero/card CSS is still in `app/globals.css`, and `className="alert"` has no rule. Acceptable, cosmetic.

## Contract

Matches `design.md`:
- Module signatures as specified.
- Every failure becomes a `TaskApiError`: status, JSON, shape, network, timeout, unset URL.
- Each fetch uses `no-store` and `AbortSignal.timeout(5000)`, with no retry.
- The POST sends the trimmed title, and `due_date: null` when the date is empty.
- Rendered markup matches the table.
- `TASKBOARD_API_URL` is documented as server-only in `docs/env-vars.md`.
- Failures go to `logger.warn` without titles.

✔

**Result:** pass

## Mutation check (report only)

Skipped: no mutation check for shape web-nextjs yet.
