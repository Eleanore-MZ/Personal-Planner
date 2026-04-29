import type { Category, Task, TimeBlock } from "../types/domain";
import { startOfDay, addCalendarDays } from "./calendar";
import { formatDate } from "./date";

export type DueGroupId =
  | "overdue"
  | "today"
  | "tomorrow"
  | "week"
  | "later"
  | "none";

export type DueTaskGroup = {
  id: DueGroupId;
  title: string;
  tasks: Task[];
};

const dueGroupOrder: Array<{ id: DueGroupId; title: string }> = [
  { id: "overdue", title: "Overdue" },
  { id: "today", title: "Due Today" },
  { id: "tomorrow", title: "Due Tomorrow" },
  { id: "week", title: "Due This Week" },
  { id: "later", title: "Due Later" },
  { id: "none", title: "No Due Date" },
];

export function isTaskComplete(task: Task) {
  return task.status === "done";
}

export function getTaskDueGroupId(task: Task, now = new Date()): DueGroupId {
  if (!task.dueDate) {
    return "none";
  }

  const dueDate = startOfDay(new Date(task.dueDate));
  const today = startOfDay(now);
  const tomorrow = addCalendarDays(today, 1);
  const weekEnd = addCalendarDays(today, 7);

  if (dueDate < today) {
    return "overdue";
  }

  if (dueDate.getTime() === today.getTime()) {
    return "today";
  }

  if (dueDate.getTime() === tomorrow.getTime()) {
    return "tomorrow";
  }

  if (dueDate <= weekEnd) {
    return "week";
  }

  return "later";
}

export function groupTasksByDueStatus(tasks: Task[], now = new Date()) {
  return dueGroupOrder.map<DueTaskGroup>((group) => ({
    ...group,
    tasks: tasks.filter((task) => getTaskDueGroupId(task, now) === group.id),
  }));
}

export function formatTaskDueDate(task: Task) {
  return task.dueDate ? formatDate(task.dueDate) : "No due date";
}

export function findTaskCategory(categories: Category[], categoryId: string) {
  return categories.find((category) => category.id === categoryId);
}

export function getTaskPlannedMinutes(task: Task, timeBlocks: TimeBlock[]) {
  return timeBlocks
    .filter(
      (block) => block.taskId === task.id || block.id === task.plannedTimeBlockId,
    )
    .reduce((totalMinutes, block) => {
      const startsAt = new Date(block.startsAt).getTime();
      const endsAt = new Date(block.endsAt).getTime();
      return totalMinutes + Math.max((endsAt - startsAt) / 60000, 0);
    }, 0);
}

export function formatMinutes(minutes: number) {
  if (minutes < 60) {
    return `${Math.round(minutes)}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes % 60);
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}
