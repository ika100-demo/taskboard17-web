import { listTasks, TaskApiError } from "@/lib/tasks-api";
import type { Task } from "@/lib/tasks-api";
import { TaskBoard } from "./_components/task-board";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let tasks: Task[];
  try {
    tasks = await listTasks();
  } catch (err) {
    if (!(err instanceof TaskApiError)) {
      throw err;
    }
    return (
      <section className="board">
        <h1>Tasks</h1>
        <p role="alert" className="alert">
          Tasks could not be loaded. Try again.
        </p>
      </section>
    );
  }
  return (
    <section className="board">
      <h1>Tasks</h1>
      <TaskBoard initialTasks={tasks} />
    </section>
  );
}
