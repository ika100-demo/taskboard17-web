import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import HomePage from "@/app/page";

function stubFetch(impl: () => Promise<Response> | Response) {
  vi.stubGlobal("fetch", vi.fn(async () => impl()));
}

beforeEach(() => {
  process.env.TASKBOARD_API_URL = "http://task-api.test";
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.TASKBOARD_API_URL;
});

describe("start page", () => {
  it("renders the heading and the task list", async () => {
    stubFetch(() => Response.json([{ id: "1", title: "Task A", due_date: "2026-03-05" }]));
    render(await HomePage());
    expect(screen.getByRole("heading", { level: 1, name: "Tasks" })).toBeTruthy();
    expect(screen.getByRole("list", { name: "Tasks" })).toBeTruthy();
    expect(screen.getByText("Task A")).toBeTruthy();
  });

  it("renders the empty state and the form", async () => {
    stubFetch(() => Response.json([]));
    render(await HomePage());
    expect(screen.getByText("No tasks yet")).toBeTruthy();
    expect(screen.getByRole("form", { name: "Create task" })).toBeTruthy();
  });

  it("renders only the alert when loading fails", async () => {
    stubFetch(() => new Response("boom", { status: 500 }));
    render(await HomePage());
    expect(screen.getByRole("heading", { level: 1, name: "Tasks" })).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toBe("Tasks could not be loaded. Try again.");
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.queryByText("No tasks yet")).toBeNull();
    expect(screen.queryByRole("form")).toBeNull();
  });
});
