import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import HomePage, { dynamic } from "@/app/page";

type Task = { id: string; title: string; due_date: string | null };

const A: Task = { id: "1", title: "Task A", due_date: "2026-03-05" };
const B: Task = { id: "2", title: "Task B", due_date: "2026-01-31" };
const C: Task = { id: "3", title: "Task C", due_date: null };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/** A fetch that never answers and rejects when the passed signal aborts. */
function hangingFetch(): typeof fetch {
  return ((_url: unknown, init?: RequestInit) =>
    new Promise((_resolve, reject) => {
      const signal = init?.signal;
      if (!signal) return; // never settles without a signal
      const fail = () => reject(new DOMException("aborted", "AbortError"));
      if (signal.aborted) fail();
      else signal.addEventListener("abort", fail);
    })) as typeof fetch;
}

function method(init?: RequestInit): string {
  return (init?.method ?? "GET").toUpperCase();
}

let fetchMock: ReturnType<typeof vi.fn>;

function stubFetch(impl: (url: string, init?: RequestInit) => Promise<Response> | Response) {
  fetchMock = vi.fn(async (input: unknown, init?: RequestInit) => impl(String(input), init));
  vi.stubGlobal("fetch", fetchMock);
}

function postCalls() {
  return fetchMock.mock.calls.filter(([, init]) => method(init as RequestInit | undefined) === "POST");
}

function fillForm(title: string, due?: string) {
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: title } });
  if (due !== undefined) fireEvent.change(screen.getByLabelText("Due date"), { target: { value: due } });
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: "Add task" }));
}

beforeEach(() => {
  process.env.TASKBOARD_API_URL = "http://task-api.test";
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.TASKBOARD_API_URL;
});

describe("start page: listing tasks", () => {
  it("AC-001.1 lists tasks in API order with title and YYYY-MM-DD due date, 'No due date' for null", async () => {
    stubFetch(() => json([A, B, C]));
    render(await HomePage());

    expect(screen.getByRole("heading", { level: 1, name: "Tasks" })).toBeInTheDocument();
    const items = within(screen.getByRole("list", { name: "Tasks" })).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("Task A");
    expect(items[1]).toHaveTextContent("Task B");
    expect(items[2]).toHaveTextContent("Task C");

    const timeA = items[0].querySelector("time");
    expect(timeA).toHaveTextContent("2026-03-05");
    expect(timeA).toHaveAttribute("datetime", "2026-03-05");
    expect(items[1].querySelector("time")).toHaveTextContent("2026-01-31");
    expect(items[2].querySelector("time")).toBeNull();
    expect(items[2]).toHaveTextContent("No due date");
    expect(items[0]).not.toHaveTextContent("No due date");
    expect(screen.queryByText("No tasks yet")).not.toBeInTheDocument();
  });

  it("AC-001.2 shows 'No tasks yet' and the create form when there are no tasks", async () => {
    stubFetch(() => json([]));
    render(await HomePage());

    expect(screen.getByText("No tasks yet")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Tasks" })).not.toBeInTheDocument();
    const form = screen.getByRole("form", { name: "Create task" });
    expect(within(form).getByLabelText("Title")).toBeInTheDocument();
    expect(within(form).getByLabelText("Due date")).toHaveAttribute("type", "date");
    expect(within(form).getByRole("button", { name: "Add task" })).toBeInTheDocument();
  });
});

describe("start page: creating tasks", () => {
  it("AC-001.3 posts the trimmed title and due date and appends the returned task without reload", async () => {
    const created: Task = { id: "9", title: "Buy milk", due_date: "2026-12-01" };
    stubFetch((_url, init) => (method(init) === "POST" ? json(created, 201) : json([])));
    render(await HomePage());

    fillForm("Buy milk", "2026-12-01");
    submit();

    const list = await screen.findByRole("list", { name: "Tasks" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
    expect(list).toHaveTextContent("Buy milk");
    expect(list.querySelector("time")).toHaveTextContent("2026-12-01");
    expect(screen.queryByText("No tasks yet")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toHaveValue("");
    expect(screen.getByLabelText("Due date")).toHaveValue("");

    expect(postCalls()).toHaveLength(1);
    const [url, init] = postCalls()[0] as [unknown, RequestInit];
    expect(String(url)).toBe("http://task-api.test/tasks");
    expect(new Headers(init.headers).get("Content-Type")).toBe("application/json");
    expect(JSON.parse(String(init.body))).toEqual({ title: "Buy milk", due_date: "2026-12-01" });
  });

  it("AC-001.3 sends due_date null when the date is left empty and appends at the end of the list", async () => {
    const created: Task = { id: "9", title: "Buy milk", due_date: null };
    stubFetch((_url, init) => (method(init) === "POST" ? json(created, 201) : json([A, B])));
    render(await HomePage());

    fillForm("Buy milk");
    submit();

    await waitFor(() => {
      expect(within(screen.getByRole("list", { name: "Tasks" })).getAllByRole("listitem")).toHaveLength(3);
    });
    const items = within(screen.getByRole("list", { name: "Tasks" })).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Task A");
    expect(items[1]).toHaveTextContent("Task B");
    expect(items[2]).toHaveTextContent("Buy milk");
    expect(items[2]).toHaveTextContent("No due date");
    expect(JSON.parse(String((postCalls()[0] as [unknown, RequestInit])[1].body))).toEqual({
      title: "Buy milk",
      due_date: null,
    });
  });

  it.each([
    ["empty", ""],
    ["whitespace only", "   \t "],
    ["longer than 200 characters", "x".repeat(201)],
    ["longer than 200 characters after trimming", ` ${"y".repeat(201)} `],
  ])("AC-001.4 rejects a title that is %s without calling the Task API", async (_label, title) => {
    stubFetch(() => json([A]));
    render(await HomePage());
    const callsBefore = fetchMock.mock.calls.length;

    fillForm(title, "2026-12-01");
    submit();

    const error = await screen.findByText("Title must be 1 to 200 characters");
    expect(error).toHaveAttribute("id", "title-error");
    expect(screen.getByLabelText("Title")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Title")).toHaveValue(title);
    expect(screen.getByLabelText("Due date")).toHaveValue("2026-12-01");
    expect(fetchMock.mock.calls.length).toBe(callsBefore);
    expect(postCalls()).toHaveLength(0);
  });

  it("AC-001.4 accepts a title of exactly 200 characters", async () => {
    const title = "z".repeat(200);
    stubFetch((_url, init) => (method(init) === "POST" ? json({ id: "9", title, due_date: null }, 201) : json([])));
    render(await HomePage());

    fillForm(title);
    submit();

    await screen.findByRole("list", { name: "Tasks" });
    expect(screen.queryByText("Title must be 1 to 200 characters")).not.toBeInTheDocument();
    expect(postCalls()).toHaveLength(1);
  });

  it.each([
    ["answers 500", () => json({ detail: "boom" }, 500)],
    ["answers 200 instead of 201", () => json({ id: "9", title: "Buy milk", due_date: null }, 200)],
    ["answers 422", () => json({ detail: "bad" }, 422)],
    ["is unreachable", () => Promise.reject(new TypeError("fetch failed"))],
  ])("AC-001.6 shows the save error and keeps the input when the API %s", async (_label, failure) => {
    stubFetch((_url, init) => (method(init) === "POST" ? failure() : json([A])));
    render(await HomePage());

    fillForm("Buy milk", "2026-12-01");
    submit();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Task could not be saved. Try again.");
    expect(screen.getByLabelText("Title")).toHaveValue("Buy milk");
    expect(screen.getByLabelText("Due date")).toHaveValue("2026-12-01");
    const items = within(screen.getByRole("list", { name: "Tasks" })).getAllByRole("listitem");
    expect(items).toHaveLength(1);
    expect(screen.getByRole("list", { name: "Tasks" })).not.toHaveTextContent("Buy milk");
  });

  it("AC-001.6 shows the save error when the API gives no answer within 5 s", async () => {
    const hanging = hangingFetch();
    stubFetch((url, init) => (method(init) === "POST" ? hanging(url, init) : json([])));
    render(await HomePage());

    fillForm("Buy milk", "2026-12-01");
    submit();

    const alert = await screen.findByRole("alert", {}, { timeout: 9000 });
    expect(alert).toHaveTextContent("Task could not be saved. Try again.");
    expect(screen.getByLabelText("Title")).toHaveValue("Buy milk");
    expect(screen.getByLabelText("Due date")).toHaveValue("2026-12-01");
    expect(screen.getByText("No tasks yet")).toBeInTheDocument();
  }, 15000);
});

describe("start page: load failures", () => {
  function expectLoadError() {
    expect(screen.getByRole("alert")).toHaveTextContent("Tasks could not be loaded. Try again.");
    expect(screen.queryByRole("list", { name: "Tasks" })).not.toBeInTheDocument();
    expect(screen.queryByText("No tasks yet")).not.toBeInTheDocument();
  }

  it("AC-001.5 shows the load error when the Task API is unreachable", async () => {
    stubFetch(() => Promise.reject(new TypeError("fetch failed")));
    render(await HomePage());
    expectLoadError();
  });

  it.each([
    ["500", () => json({ detail: "boom" }, 500)],
    ["404", () => json({}, 404)],
    ["200 with a JSON object", () => json({ tasks: [] }, 200)],
    ["200 with non-JSON", () => new Response("<html>oops</html>", { status: 200 })],
  ])("AC-001.5 shows the load error on %s", async (_label, response) => {
    stubFetch(response);
    render(await HomePage());
    expectLoadError();
  });

  it("AC-001.5 shows the load error when the Task API gives no answer within 5 s", async () => {
    vi.stubGlobal("fetch", hangingFetch());
    render(await HomePage());
    expectLoadError();
  }, 15000);
});

describe("start page: freshness", () => {
  it("AC-001.7 is rendered per request and fetches the list with cache no-store", async () => {
    expect(dynamic).toBe("force-dynamic");
    stubFetch(() => json([A]));
    render(await HomePage());

    const getCall = fetchMock.mock.calls.find(([, init]) => method(init as RequestInit | undefined) === "GET");
    expect(getCall).toBeDefined();
    expect(String(getCall?.[0])).toBe("http://task-api.test/tasks");
    expect((getCall?.[1] as RequestInit).cache).toBe("no-store");
  });

  it("AC-001.7 shows what GET /tasks returns at the moment of each render", async () => {
    let current: Task[] = [A];
    stubFetch(() => json(current));

    const first = render(await HomePage());
    expect(screen.getByRole("list", { name: "Tasks" })).toHaveTextContent("Task A");
    first.unmount();

    current = [B, C];
    render(await HomePage());
    const items = within(screen.getByRole("list", { name: "Tasks" })).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Task B");
    expect(items[1]).toHaveTextContent("Task C");
    expect(screen.queryByText("Task A")).not.toBeInTheDocument();
  });
});
