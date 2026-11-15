import { logger } from "@/lib/logger";

export type Task = { id: string; title: string; due_date: string | null };

export const TASK_API_TIMEOUT_MS = 5000;

/** Any Task API failure: connection, timeout, status, body or configuration. */
export class TaskApiError extends Error {}

type Op = "list" | "create";

function isTask(value: unknown): value is Task {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.title === "string" &&
    (typeof v.due_date === "string" || v.due_date === null)
  );
}

function fail(op: Op, reason: string, status?: number): never {
  logger.warn("task api request failed", { op, reason, status });
  throw new TaskApiError(reason);
}

async function request(op: Op, path: string, init: RequestInit, expected: number): Promise<unknown> {
  const base = process.env.TASKBOARD_API_URL?.replace(/\/+$/, "");
  if (!base) {
    return fail(op, "TASKBOARD_API_URL is not set");
  }
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(TASK_API_TIMEOUT_MS),
    });
  } catch (err) {
    return fail(op, err instanceof Error && err.name === "TimeoutError" ? "timeout" : "network error");
  }
  if (response.status !== expected) {
    return fail(op, "unexpected status", response.status);
  }
  try {
    return await response.json();
  } catch {
    return fail(op, "invalid json", response.status);
  }
}

export async function listTasks(): Promise<Task[]> {
  const body = await request("list", "/tasks", { method: "GET" }, 200);
  if (!Array.isArray(body) || !body.every(isTask)) {
    return fail("list", "unexpected response shape", 200);
  }
  return body;
}

export async function createTask(input: { title: string; due_date: string | null }): Promise<Task> {
  const body = await request(
    "create",
    "/tasks",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: input.title, due_date: input.due_date }),
    },
    201,
  );
  if (!isTask(body)) {
    return fail("create", "unexpected response shape", 201);
  }
  return body;
}
