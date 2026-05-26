export type Category = {
  id: string;
  name: string;
  color: string;
  description: string;
  defaultBlockKind: TimeBlockKind;
  hiddenFromCalendar: boolean;
  includeInStatsByDefault: boolean;
};

export type StatsGroup = {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  countsTowardProductiveTime: boolean;
  categoryIds: string[];
};

export type TaskStatus =
  | "todo"
  | "in-progress"
  | "blocked"
  | "done"
  | "canceled";

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
  categoryId: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string;
  plannedTimeBlockId?: string;
  subtasks?: Subtask[];
};

export type RecurrenceFrequency = "none" | "daily" | "weekly" | "monthly";
export type RecurrenceEndMode = "never" | "on" | "after";
export type LegacyTimeBlockStatus = "planned" | "done" | "skipped" | "canceled";
export type TimeBlockOutcome = "active" | "abandoned";
export type TimeBlockKind = "event" | "task-session" | "habit" | "routine";
export type TimeBlockSource =
  | "manual"
  | "pomodoro"
  | "timer"
  | "generated"
  | "imported";

export type TimeBlock = {
  id: string;
  title: string;
  notes: string;
  categoryId: string;
  taskId?: string;
  startsAt: string;
  endsAt: string;
  outcome: TimeBlockOutcome;
  /** Legacy database compatibility only. UI logic should use outcome. */
  status?: LegacyTimeBlockStatus;
  kind: TimeBlockKind;
  source: TimeBlockSource;
  isAllDay?: boolean;
  recurrenceFrequency?: RecurrenceFrequency;
  recurrenceInterval?: number;
  recurrenceWeekdays?: number[];
  recurrenceEndMode?: RecurrenceEndMode;
  recurrenceEndDate?: string;
  recurrenceCount?: number;
  recurrenceExceptions?: string[];
  recurringTimeBlockId?: string;
};
