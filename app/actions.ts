"use server";

import { validateTitle } from "@/lib/task-title";
import { createTask, TaskApiError } from "@/lib/tasks-api";
import type { Task } from "@/lib/tasks-api";

export type CreateTaskResult =
  | { ok: true; task: Task }
  | { ok: false; error: "invalid_title" | "save_failed" };

export async function createTaskAction(input: {
  title: string;
  due_date: string;
}): Promise<CreateTaskResult> {
  const validated = validateTitle(String(input?.title ?? ""));
  if (!validated.ok) {
    return { ok: false, error: "invalid_title" };
  }
  const due = typeof input.due_date === "string" && input.due_date !== "" ? input.due_date : null;
  try {
    const task = await createTask({ title: validated.title, due_date: due });
    return { ok: true, task };
  } catch (err) {
    if (err instanceof TaskApiError) {
      return { ok: false, error: "save_failed" };
    }
    throw err;
  }
}
