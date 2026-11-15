"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { createTaskAction } from "@/app/actions";
import { TITLE_ERROR, validateTitle } from "@/lib/task-title";
import type { Task } from "@/lib/tasks-api";

export type TaskBoardProps = { initialTasks: Task[] };

export function TaskBoard({ initialTasks }: TaskBoardProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [titleError, setTitleError] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTitleError(false);
    setSaveError(false);
    if (!validateTitle(title).ok) {
      setTitleError(true);
      return;
    }
    setPending(true);
    try {
      const result = await createTaskAction({ title, due_date: dueDate });
      if (result.ok) {
        setTasks((prev) => [...prev, result.task]);
        setTitle("");
        setDueDate("");
      } else if (result.error === "invalid_title") {
        setTitleError(true);
      } else {
        setSaveError(true);
      }
    } catch {
      setSaveError(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {tasks.length > 0 ? (
        <ul aria-label="Tasks">
          {tasks.map((task) => (
            <li key={task.id}>
              <span>{task.title}</span>{" "}
              {task.due_date ? <time dateTime={task.due_date}>{task.due_date}</time> : <span>No due date</span>}
            </li>
          ))}
        </ul>
      ) : (
        <p>No tasks yet</p>
      )}
      <form aria-label="Create task" noValidate onSubmit={onSubmit}>
        <div>
          <label htmlFor="task-title">Title</label>
          <input
            id="task-title"
            name="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-invalid={titleError ? "true" : undefined}
            aria-describedby={titleError ? "title-error" : undefined}
          />
          {titleError ? <p id="title-error">{TITLE_ERROR}</p> : null}
        </div>
        <div>
          <label htmlFor="task-due-date">Due date</label>
          <input
            id="task-due-date"
            name="due_date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
        {saveError ? <p role="alert">Task could not be saved. Try again.</p> : null}
        <button type="submit" disabled={pending}>
          Add task
        </button>
      </form>
    </>
  );
}
