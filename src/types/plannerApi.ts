import type { Category, Task, TimeBlock } from "./domain";

export type PlannerSnapshot = {
  categories: Category[];
  taskLists: import("./domain").TaskList[];
  tasks: Task[];
  timeBlocks: TimeBlock[];
};

export type CreateCategoryInput = Omit<Category, "id">;

export type CreateTaskInput = Omit<Task, "id">;

export type CreateTimeBlockInput = Omit<TimeBlock, "id"> & { id?: string };

export type UpdateCategoryInput = Category;

export type UpdateTaskInput = Task;

export type UpdateTimeBlockInput = TimeBlock;
export type RecurringUpdateScope = "all" | "this" | "future";

export type UpdateRecurringTimeBlockInput = {
  occurrence: TimeBlock;
  updatedBlock: TimeBlock;
  scope: RecurringUpdateScope;
};

export type PlannerAPI = {
  getSnapshot: () => Promise<PlannerSnapshot>;
  createCategory: (input: CreateCategoryInput) => Promise<Category>;
  updateCategory: (input: UpdateCategoryInput) => Promise<Category>;
  deleteCategory: (categoryId: string) => Promise<string>;
  createTask: (input: CreateTaskInput) => Promise<Task>;
  updateTask: (input: UpdateTaskInput) => Promise<Task>;
  deleteTask: (taskId: string) => Promise<string>;
  updateTaskStatus: (
    taskId: string,
    status: Task["status"],
  ) => Promise<Task | undefined>;
  createTimeBlock: (input: CreateTimeBlockInput) => Promise<TimeBlock>;
  updateTimeBlock: (input: UpdateTimeBlockInput) => Promise<TimeBlock>;
  updateRecurringTimeBlock: (
    input: UpdateRecurringTimeBlockInput,
  ) => Promise<PlannerSnapshot>;
  deleteTimeBlock: (timeBlockId: string) => Promise<string>;
};
