export type Category = {
  id: string;
  name: string;
  color: string;
  description: string;
};

export type TaskList = {
  id: string;
  name: string;
  description: string;
  categoryId: string;
};

export type TaskStatus = "todo" | "in-progress" | "done";

export type TaskPriority = "low" | "medium" | "high";

export type Subtask = {
  id: string;
  title: string;
  completed: boolean;
};

export type Task = {
  id: string;
  title: string;
  notes: string;
  listId: string;
  categoryId: string;
  status: TaskStatus;
  priority: TaskPriority;
  estimatedMinutes: number;
  dueDate?: string;
  plannedTimeBlockId?: string;
  subtasks?: Subtask[];
};

export type RecurrenceFrequency = "none" | "daily" | "weekly" | "monthly";
export type RecurrenceEndMode = "never" | "on" | "after";

export type TimeBlock = {
  id: string;
  title: string;
  notes: string;
  categoryId: string;
  taskId?: string;
  startsAt: string;
  endsAt: string;
  recurrenceFrequency?: RecurrenceFrequency;
  recurrenceInterval?: number;
  recurrenceWeekdays?: number[];
  recurrenceEndMode?: RecurrenceEndMode;
  recurrenceEndDate?: string;
  recurrenceCount?: number;
  recurrenceExceptions?: string[];
  recurringTimeBlockId?: string;
};
