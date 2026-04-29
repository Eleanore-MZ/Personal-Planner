import { app, ipcMain, BrowserWindow } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import Database from "better-sqlite3";
function addDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}
function atTime(date, hour, minute = 0) {
  const nextDate = new Date(date);
  nextDate.setHours(hour, minute, 0, 0);
  return nextDate;
}
const today = /* @__PURE__ */ new Date();
today.setHours(0, 0, 0, 0);
const toIso = (date) => date.toISOString();
const sampleCategories = [
  {
    id: "cat-work",
    name: "Work",
    color: "cyan",
    description: "Focused project work and meetings."
  },
  {
    id: "cat-personal",
    name: "Personal",
    color: "green",
    description: "Home, errands, and life admin."
  },
  {
    id: "cat-health",
    name: "Health",
    color: "pink",
    description: "Exercise, meals, and recovery routines."
  },
  {
    id: "cat-learning",
    name: "Learning",
    color: "purple",
    description: "Classes, reading, and skill practice."
  },
  {
    id: "cat-finance",
    name: "Finance",
    color: "yellow",
    description: "Bills, budgets, and planning."
  }
];
const sampleTaskLists = [
  {
    id: "list-projects",
    name: "Projects",
    description: "Planned work for active projects.",
    categoryId: "cat-work"
  },
  {
    id: "list-personal",
    name: "Personal Admin",
    description: "Small but important life tasks.",
    categoryId: "cat-personal"
  },
  {
    id: "list-learning",
    name: "Learning Queue",
    description: "Study sessions and course follow-ups.",
    categoryId: "cat-learning"
  }
];
const sampleTimeBlocks = [
  {
    id: "block-week-planning",
    title: "Weekly planning pass",
    notes: "Sketch priorities and choose focus blocks.",
    categoryId: "cat-work",
    taskId: "task-plan-week",
    startsAt: toIso(atTime(today, 9)),
    endsAt: toIso(atTime(today, 10))
  },
  {
    id: "block-email",
    title: "Inbox triage",
    notes: "Clear urgent replies and archive stale threads.",
    categoryId: "cat-work",
    taskId: "task-send-proposal",
    startsAt: toIso(atTime(today, 10, 30)),
    endsAt: toIso(atTime(today, 11))
  },
  {
    id: "block-design-review",
    title: "Design review prep",
    notes: "Prepare notes for the upcoming app shell review.",
    categoryId: "cat-work",
    taskId: "task-review-shell",
    startsAt: toIso(atTime(addDays(today, 1), 13)),
    endsAt: toIso(atTime(addDays(today, 1), 14, 30))
  },
  {
    id: "block-grocery",
    title: "Grocery run",
    notes: "Pick up ingredients and pantry basics.",
    categoryId: "cat-personal",
    taskId: "task-grocery-list",
    startsAt: toIso(atTime(addDays(today, 1), 17, 30)),
    endsAt: toIso(atTime(addDays(today, 1), 18, 15))
  },
  {
    id: "block-workout",
    title: "Workout",
    notes: "Light cardio and mobility.",
    categoryId: "cat-health",
    startsAt: toIso(atTime(addDays(today, 2), 7)),
    endsAt: toIso(atTime(addDays(today, 2), 7, 45))
  },
  {
    id: "block-reading",
    title: "Read TypeScript notes",
    notes: "Review stricter domain modeling patterns.",
    categoryId: "cat-learning",
    taskId: "task-read-typescript",
    startsAt: toIso(atTime(addDays(today, 3), 19)),
    endsAt: toIso(atTime(addDays(today, 3), 20))
  },
  {
    id: "block-budget",
    title: "Monthly budget review",
    notes: "Check recurring costs and savings targets.",
    categoryId: "cat-finance",
    taskId: "task-budget-review",
    startsAt: toIso(atTime(addDays(today, 5), 11)),
    endsAt: toIso(atTime(addDays(today, 5), 12))
  },
  {
    id: "block-catchup",
    title: "Open planning buffer",
    notes: "Flexible time for overflow items.",
    categoryId: "cat-personal",
    startsAt: toIso(atTime(addDays(today, 6), 15)),
    endsAt: toIso(atTime(addDays(today, 6), 16))
  }
];
const sampleTasks = [
  {
    id: "task-renew-license",
    title: "Renew software license",
    notes: "Overdue administrative item for the project toolkit.",
    listId: "list-projects",
    categoryId: "cat-work",
    status: "todo",
    priority: "high",
    estimatedMinutes: 45,
    dueDate: toIso(addDays(today, -2))
  },
  {
    id: "task-plan-week",
    title: "Plan the week",
    notes: "Due today and linked to the first planned block.",
    listId: "list-projects",
    categoryId: "cat-work",
    status: "in-progress",
    priority: "high",
    estimatedMinutes: 120,
    dueDate: toIso(today),
    plannedTimeBlockId: "block-week-planning",
    subtasks: [
      { id: "subtask-review-calendar", title: "Review calendar", completed: true },
      { id: "subtask-pick-focus", title: "Pick three focus items", completed: false },
      { id: "subtask-block-time", title: "Block deep work time", completed: false }
    ]
  },
  {
    id: "task-grocery-list",
    title: "Make grocery list",
    notes: "Capture ingredients before the planned store run.",
    listId: "list-personal",
    categoryId: "cat-personal",
    status: "todo",
    priority: "medium",
    estimatedMinutes: 45,
    dueDate: toIso(addDays(today, 1)),
    plannedTimeBlockId: "block-grocery",
    subtasks: [
      { id: "subtask-check-pantry", title: "Check pantry staples", completed: false }
    ]
  },
  {
    id: "task-review-shell",
    title: "Review app shell notes",
    notes: "Due in a few days as preparation for the next UI phase.",
    listId: "list-projects",
    categoryId: "cat-work",
    status: "todo",
    priority: "medium",
    estimatedMinutes: 90,
    dueDate: toIso(addDays(today, 3)),
    plannedTimeBlockId: "block-design-review"
  },
  {
    id: "task-read-typescript",
    title: "Read TypeScript domain modeling chapter",
    notes: "Learning task tied to a reading block.",
    listId: "list-learning",
    categoryId: "cat-learning",
    status: "todo",
    priority: "low",
    estimatedMinutes: 60,
    dueDate: toIso(addDays(today, 4)),
    plannedTimeBlockId: "block-reading"
  },
  {
    id: "task-budget-review",
    title: "Review monthly budget",
    notes: "Finance check-in due later this week.",
    listId: "list-personal",
    categoryId: "cat-finance",
    status: "todo",
    priority: "medium",
    estimatedMinutes: 60,
    dueDate: toIso(addDays(today, 7)),
    plannedTimeBlockId: "block-budget"
  },
  {
    id: "task-send-proposal",
    title: "Send proposal follow-up",
    notes: "Short email follow-up after inbox triage.",
    listId: "list-projects",
    categoryId: "cat-work",
    status: "todo",
    priority: "high",
    estimatedMinutes: 30,
    dueDate: toIso(addDays(today, 2)),
    plannedTimeBlockId: "block-email"
  },
  {
    id: "task-backup-files",
    title: "Back up planner notes",
    notes: "Later task for a local data hygiene pass.",
    listId: "list-personal",
    categoryId: "cat-personal",
    status: "todo",
    priority: "low",
    estimatedMinutes: 75,
    dueDate: toIso(addDays(today, 14))
  },
  {
    id: "task-capture-ideas",
    title: "Capture planner improvement ideas",
    notes: "Unscheduled ideas for future planner iterations.",
    listId: "list-personal",
    categoryId: "cat-personal",
    status: "todo",
    priority: "low",
    estimatedMinutes: 30
  }
];
let db;
const createId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const parseRecurrenceWeekdays = (value) => {
  if (!value) {
    return void 0;
  }
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed) && parsed.every((weekday) => Number.isInteger(weekday) && weekday >= 0 && weekday <= 6)) {
      return parsed;
    }
  } catch {
    return void 0;
  }
  return void 0;
};
const serializeRecurrenceWeekdays = (weekdays) => weekdays && weekdays.length > 0 ? JSON.stringify(weekdays) : null;
const parseRecurrenceExceptions = (value) => {
  if (!value) {
    return void 0;
  }
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed) && parsed.every((date) => typeof date === "string")) {
      return parsed;
    }
  } catch {
    return void 0;
  }
  return void 0;
};
const serializeRecurrenceExceptions = (exceptions) => exceptions && exceptions.length > 0 ? JSON.stringify([...new Set(exceptions)].sort()) : null;
const normalizeRecurrenceEndMode = (mode, endDate) => mode === "never" && endDate ? "on" : mode ?? (endDate ? "on" : "never");
function initializePlannerDatabase() {
  const databasePath = path.join(app.getPath("userData"), "planner.sqlite3");
  db = new Database(databasePath);
  db.pragma("journal_mode = WAL");
  createSchema(db);
  seedDefaults(db);
}
function getDb() {
  if (!db) {
    throw new Error("Planner database has not been initialized");
  }
  return db;
}
function createSchema(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS task_lists (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      category_id TEXT NOT NULL,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      list_id TEXT NOT NULL,
      category_id TEXT NOT NULL,
      status TEXT NOT NULL,
      priority TEXT NOT NULL,
      estimated_minutes INTEGER NOT NULL DEFAULT 60,
      due_date TEXT,
      planned_time_block_id TEXT,
      FOREIGN KEY (list_id) REFERENCES task_lists(id),
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS subtasks (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      title TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS time_blocks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      category_id TEXT NOT NULL,
      task_id TEXT,
      starts_at TEXT NOT NULL,
      ends_at TEXT NOT NULL,
      recurrence_frequency TEXT NOT NULL DEFAULT 'none',
      recurrence_interval INTEGER NOT NULL DEFAULT 1,
      recurrence_weekdays TEXT,
      recurrence_end_mode TEXT NOT NULL DEFAULT 'never',
      recurrence_end_date TEXT,
      recurrence_count INTEGER,
      recurrence_exceptions TEXT,
      FOREIGN KEY (category_id) REFERENCES categories(id),
      FOREIGN KEY (task_id) REFERENCES tasks(id)
    );
  `);
  const timeBlockColumns = database.prepare("PRAGMA table_info(time_blocks)").all();
  const columnNames = new Set(timeBlockColumns.map((column) => column.name));
  if (!columnNames.has("recurrence_frequency")) {
    database.prepare(
      "ALTER TABLE time_blocks ADD COLUMN recurrence_frequency TEXT NOT NULL DEFAULT 'none'"
    ).run();
  }
  if (!columnNames.has("recurrence_end_date")) {
    database.prepare("ALTER TABLE time_blocks ADD COLUMN recurrence_end_date TEXT").run();
  }
  if (!columnNames.has("recurrence_interval")) {
    database.prepare("ALTER TABLE time_blocks ADD COLUMN recurrence_interval INTEGER NOT NULL DEFAULT 1").run();
  }
  if (!columnNames.has("recurrence_weekdays")) {
    database.prepare("ALTER TABLE time_blocks ADD COLUMN recurrence_weekdays TEXT").run();
  }
  if (!columnNames.has("recurrence_end_mode")) {
    database.prepare("ALTER TABLE time_blocks ADD COLUMN recurrence_end_mode TEXT NOT NULL DEFAULT 'never'").run();
  }
  if (!columnNames.has("recurrence_count")) {
    database.prepare("ALTER TABLE time_blocks ADD COLUMN recurrence_count INTEGER").run();
  }
  if (!columnNames.has("recurrence_exceptions")) {
    database.prepare("ALTER TABLE time_blocks ADD COLUMN recurrence_exceptions TEXT").run();
  }
}
function seedDefaults(database) {
  const categoryCount = database.prepare("SELECT COUNT(*) AS count FROM categories").get();
  if (categoryCount.count > 0) {
    return;
  }
  const insertCategory = database.prepare(`
    INSERT INTO categories (id, name, color, description)
    VALUES (@id, @name, @color, @description)
  `);
  const insertTaskList = database.prepare(`
    INSERT INTO task_lists (id, name, description, category_id)
    VALUES (@id, @name, @description, @categoryId)
  `);
  const insertTask = database.prepare(`
    INSERT INTO tasks (
      id, title, notes, list_id, category_id, status, priority,
      estimated_minutes, due_date, planned_time_block_id
    )
    VALUES (
      @id, @title, @notes, @listId, @categoryId, @status, @priority,
      @estimatedMinutes, @dueDate, @plannedTimeBlockId
    )
  `);
  const insertSubtask = database.prepare(`
    INSERT INTO subtasks (id, task_id, title, completed)
    VALUES (@id, @taskId, @title, @completed)
  `);
  const insertTimeBlock = database.prepare(`
    INSERT INTO time_blocks (
      id, title, notes, category_id, task_id, starts_at, ends_at,
      recurrence_frequency, recurrence_interval, recurrence_weekdays,
      recurrence_end_mode, recurrence_end_date, recurrence_count,
      recurrence_exceptions
    )
    VALUES (
      @id, @title, @notes, @categoryId, @taskId, @startsAt, @endsAt,
      @recurrenceFrequency, @recurrenceInterval, @recurrenceWeekdays,
      @recurrenceEndMode, @recurrenceEndDate, @recurrenceCount,
      @recurrenceExceptions
    )
  `);
  const seed = database.transaction(() => {
    sampleCategories.forEach((category) => insertCategory.run(category));
    sampleTaskLists.forEach((taskList) => insertTaskList.run(taskList));
    sampleTasks.forEach((task) => {
      var _a;
      insertTask.run({
        ...task,
        dueDate: task.dueDate ?? null,
        plannedTimeBlockId: task.plannedTimeBlockId ?? null
      });
      (_a = task.subtasks) == null ? void 0 : _a.forEach(
        (subtask) => insertSubtask.run({
          ...subtask,
          taskId: task.id,
          completed: subtask.completed ? 1 : 0
        })
      );
    });
    sampleTimeBlocks.forEach(
      (block) => insertTimeBlock.run({
        ...block,
        taskId: block.taskId ?? null,
        recurrenceFrequency: block.recurrenceFrequency ?? "none",
        recurrenceInterval: block.recurrenceInterval ?? 1,
        recurrenceWeekdays: serializeRecurrenceWeekdays(block.recurrenceWeekdays),
        recurrenceEndMode: block.recurrenceEndMode ?? (block.recurrenceEndDate ? "on" : "never"),
        recurrenceEndDate: block.recurrenceEndDate ?? null,
        recurrenceCount: block.recurrenceCount ?? null,
        recurrenceExceptions: serializeRecurrenceExceptions(block.recurrenceExceptions)
      })
    );
  });
  seed();
}
function getPlannerSnapshot() {
  return {
    categories: getCategories(),
    taskLists: getTaskLists(),
    tasks: getTasks(),
    timeBlocks: getTimeBlocks()
  };
}
function getCategories() {
  const rows = getDb().prepare("SELECT * FROM categories ORDER BY name").all();
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    color: row.color,
    description: row.description
  }));
}
function createCategory(input) {
  const category = {
    id: createId("cat"),
    ...input
  };
  getDb().prepare(
    "INSERT INTO categories (id, name, color, description) VALUES (@id, @name, @color, @description)"
  ).run(category);
  return category;
}
function updateCategory(input) {
  getDb().prepare(
    "UPDATE categories SET name = @name, color = @color, description = @description WHERE id = @id"
  ).run(input);
  return input;
}
function deleteCategory(categoryId) {
  const database = getDb();
  const fallbackCategory = database.prepare("SELECT id FROM categories WHERE id != @categoryId ORDER BY name LIMIT 1").get({ categoryId });
  if (!fallbackCategory) {
    throw new Error("Cannot delete the only category. Create another category first.");
  }
  const remove = database.transaction(() => {
    database.prepare(
      "UPDATE task_lists SET category_id = @fallbackCategoryId WHERE category_id = @categoryId"
    ).run({ categoryId, fallbackCategoryId: fallbackCategory.id });
    database.prepare(
      "UPDATE tasks SET category_id = @fallbackCategoryId WHERE category_id = @categoryId"
    ).run({ categoryId, fallbackCategoryId: fallbackCategory.id });
    database.prepare(
      "UPDATE time_blocks SET category_id = @fallbackCategoryId WHERE category_id = @categoryId"
    ).run({ categoryId, fallbackCategoryId: fallbackCategory.id });
    database.prepare("DELETE FROM categories WHERE id = @categoryId").run({ categoryId });
  });
  remove();
  return categoryId;
}
function getTaskLists() {
  const rows = getDb().prepare("SELECT * FROM task_lists ORDER BY name").all();
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    categoryId: row.category_id
  }));
}
function getTasks() {
  const taskRows = getDb().prepare("SELECT * FROM tasks ORDER BY due_date IS NULL, due_date, title").all();
  const subtaskRows = getDb().prepare("SELECT * FROM subtasks ORDER BY title").all();
  return taskRows.map((row) => {
    const subtasks = subtaskRows.filter((subtask) => subtask.task_id === row.id).map((subtask) => ({
      id: subtask.id,
      title: subtask.title,
      completed: subtask.completed === 1
    }));
    return {
      id: row.id,
      title: row.title,
      notes: row.notes,
      listId: row.list_id,
      categoryId: row.category_id,
      status: row.status,
      priority: row.priority,
      estimatedMinutes: row.estimated_minutes,
      dueDate: row.due_date ?? void 0,
      plannedTimeBlockId: row.planned_time_block_id ?? void 0,
      subtasks: subtasks.length > 0 ? subtasks : void 0
    };
  });
}
function createTask(input) {
  const task = {
    id: createId("task"),
    ...input
  };
  const database = getDb();
  const insert = database.transaction(() => {
    var _a;
    database.prepare(`
        INSERT INTO tasks (
          id, title, notes, list_id, category_id, status, priority,
          estimated_minutes, due_date, planned_time_block_id
        )
        VALUES (
          @id, @title, @notes, @listId, @categoryId, @status, @priority,
          @estimatedMinutes, @dueDate, @plannedTimeBlockId
        )
      `).run({
      ...task,
      dueDate: task.dueDate ?? null,
      plannedTimeBlockId: task.plannedTimeBlockId ?? null
    });
    (_a = task.subtasks) == null ? void 0 : _a.forEach((subtask) => {
      database.prepare(
        "INSERT INTO subtasks (id, task_id, title, completed) VALUES (@id, @taskId, @title, @completed)"
      ).run({
        ...subtask,
        taskId: task.id,
        completed: subtask.completed ? 1 : 0
      });
    });
  });
  insert();
  return task;
}
function updateTask(input) {
  const database = getDb();
  const update = database.transaction(() => {
    var _a;
    database.prepare(`
        UPDATE tasks
        SET title = @title,
            notes = @notes,
            list_id = @listId,
            category_id = @categoryId,
            status = @status,
            priority = @priority,
            estimated_minutes = @estimatedMinutes,
            due_date = @dueDate,
            planned_time_block_id = @plannedTimeBlockId
        WHERE id = @id
      `).run({
      ...input,
      dueDate: input.dueDate ?? null,
      plannedTimeBlockId: input.plannedTimeBlockId ?? null
    });
    database.prepare("DELETE FROM subtasks WHERE task_id = @taskId").run({ taskId: input.id });
    (_a = input.subtasks) == null ? void 0 : _a.forEach((subtask) => {
      database.prepare(
        "INSERT INTO subtasks (id, task_id, title, completed) VALUES (@id, @taskId, @title, @completed)"
      ).run({
        ...subtask,
        taskId: input.id,
        completed: subtask.completed ? 1 : 0
      });
    });
  });
  update();
  return getTasks().find((task) => task.id === input.id) ?? input;
}
function deleteTask(taskId) {
  const database = getDb();
  const remove = database.transaction(() => {
    database.prepare("UPDATE time_blocks SET task_id = NULL WHERE task_id = @taskId").run({ taskId });
    database.prepare("DELETE FROM subtasks WHERE task_id = @taskId").run({ taskId });
    database.prepare("DELETE FROM tasks WHERE id = @taskId").run({ taskId });
  });
  remove();
  return taskId;
}
function updateTaskStatus(taskId, status) {
  getDb().prepare("UPDATE tasks SET status = @status WHERE id = @taskId").run({ taskId, status });
  return getTasks().find((task) => task.id === taskId);
}
function getTimeBlocks() {
  const rows = getDb().prepare("SELECT * FROM time_blocks ORDER BY starts_at").all();
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    notes: row.notes,
    categoryId: row.category_id,
    taskId: row.task_id ?? void 0,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    recurrenceFrequency: row.recurrence_frequency ?? "none",
    recurrenceInterval: row.recurrence_interval ?? 1,
    recurrenceWeekdays: parseRecurrenceWeekdays(row.recurrence_weekdays),
    recurrenceEndMode: normalizeRecurrenceEndMode(
      row.recurrence_end_mode,
      row.recurrence_end_date
    ),
    recurrenceEndDate: row.recurrence_end_date ?? void 0,
    recurrenceCount: row.recurrence_count ?? void 0,
    recurrenceExceptions: parseRecurrenceExceptions(row.recurrence_exceptions)
  }));
}
function createTimeBlock(input) {
  const timeBlock = {
    id: input.id ?? createId("block"),
    title: input.title,
    notes: input.notes,
    categoryId: input.categoryId,
    taskId: input.taskId,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    recurrenceFrequency: input.recurrenceFrequency ?? "none",
    recurrenceInterval: input.recurrenceInterval ?? 1,
    recurrenceWeekdays: input.recurrenceWeekdays,
    recurrenceEndMode: input.recurrenceEndMode ?? (input.recurrenceEndDate ? "on" : "never"),
    recurrenceEndDate: input.recurrenceEndDate,
    recurrenceCount: input.recurrenceCount,
    recurrenceExceptions: input.recurrenceExceptions
  };
  getDb().prepare(`
      INSERT INTO time_blocks (
        id, title, notes, category_id, task_id, starts_at, ends_at,
        recurrence_frequency, recurrence_interval, recurrence_weekdays,
        recurrence_end_mode, recurrence_end_date, recurrence_count,
        recurrence_exceptions
      )
      VALUES (
        @id, @title, @notes, @categoryId, @taskId, @startsAt, @endsAt,
        @recurrenceFrequency, @recurrenceInterval, @recurrenceWeekdays,
        @recurrenceEndMode, @recurrenceEndDate, @recurrenceCount,
        @recurrenceExceptions
      )
    `).run({
    ...timeBlock,
    taskId: timeBlock.taskId ?? null,
    recurrenceFrequency: timeBlock.recurrenceFrequency ?? "none",
    recurrenceInterval: timeBlock.recurrenceInterval ?? 1,
    recurrenceWeekdays: serializeRecurrenceWeekdays(timeBlock.recurrenceWeekdays),
    recurrenceEndMode: timeBlock.recurrenceEndMode ?? "never",
    recurrenceEndDate: timeBlock.recurrenceEndDate ?? null,
    recurrenceCount: timeBlock.recurrenceCount ?? null,
    recurrenceExceptions: serializeRecurrenceExceptions(timeBlock.recurrenceExceptions)
  });
  return timeBlock;
}
function updateTimeBlock(input) {
  getDb().prepare(`
      UPDATE time_blocks
      SET title = @title,
          notes = @notes,
          category_id = @categoryId,
          task_id = @taskId,
          starts_at = @startsAt,
          ends_at = @endsAt,
          recurrence_frequency = @recurrenceFrequency,
          recurrence_interval = @recurrenceInterval,
          recurrence_weekdays = @recurrenceWeekdays,
          recurrence_end_mode = @recurrenceEndMode,
          recurrence_end_date = @recurrenceEndDate,
          recurrence_count = @recurrenceCount,
          recurrence_exceptions = @recurrenceExceptions
      WHERE id = @id
    `).run({
    ...input,
    taskId: input.taskId ?? null,
    recurrenceFrequency: input.recurrenceFrequency ?? "none",
    recurrenceInterval: input.recurrenceInterval ?? 1,
    recurrenceWeekdays: serializeRecurrenceWeekdays(input.recurrenceWeekdays),
    recurrenceEndMode: input.recurrenceEndMode ?? "never",
    recurrenceEndDate: input.recurrenceEndDate ?? null,
    recurrenceCount: input.recurrenceCount ?? null,
    recurrenceExceptions: serializeRecurrenceExceptions(input.recurrenceExceptions)
  });
  return input;
}
const addMs = (date, deltaMs) => new Date(new Date(date).getTime() + deltaMs).toISOString();
const getSeriesUpdate = (seriesBlock, occurrence, updatedBlock) => {
  const startDelta = new Date(updatedBlock.startsAt).getTime() - new Date(occurrence.startsAt).getTime();
  const endDelta = new Date(updatedBlock.endsAt).getTime() - new Date(occurrence.endsAt).getTime();
  return {
    ...seriesBlock,
    title: updatedBlock.title,
    notes: updatedBlock.notes,
    categoryId: updatedBlock.categoryId,
    taskId: updatedBlock.taskId,
    startsAt: addMs(seriesBlock.startsAt, startDelta),
    endsAt: addMs(seriesBlock.endsAt, endDelta),
    recurrenceFrequency: updatedBlock.recurrenceFrequency ?? seriesBlock.recurrenceFrequency,
    recurrenceInterval: updatedBlock.recurrenceInterval ?? seriesBlock.recurrenceInterval,
    recurrenceWeekdays: updatedBlock.recurrenceWeekdays ?? seriesBlock.recurrenceWeekdays,
    recurrenceEndMode: updatedBlock.recurrenceEndMode ?? seriesBlock.recurrenceEndMode,
    recurrenceEndDate: updatedBlock.recurrenceEndDate,
    recurrenceCount: updatedBlock.recurrenceCount,
    recurrenceExceptions: seriesBlock.recurrenceExceptions
  };
};
const getSingleOccurrenceBlock = (updatedBlock) => ({
  ...updatedBlock,
  id: createId("block"),
  recurrenceFrequency: "none",
  recurrenceInterval: void 0,
  recurrenceWeekdays: void 0,
  recurrenceEndMode: "never",
  recurrenceEndDate: void 0,
  recurrenceCount: void 0,
  recurrenceExceptions: void 0,
  recurringTimeBlockId: void 0
});
const getFutureSeriesBlock = (updatedBlock) => ({
  ...updatedBlock,
  id: createId("block"),
  recurringTimeBlockId: void 0,
  recurrenceExceptions: void 0
});
const getTruncatedSeriesBlock = (seriesBlock, occurrence) => ({
  ...seriesBlock,
  recurrenceEndMode: "on",
  recurrenceEndDate: new Date(
    new Date(occurrence.startsAt).getTime() - 1e3
  ).toISOString(),
  recurrenceCount: void 0
});
function updateRecurringTimeBlock(input) {
  const seriesId = input.occurrence.recurringTimeBlockId ?? input.occurrence.id;
  const seriesBlock = getTimeBlocks().find((block) => block.id === seriesId);
  if (!seriesBlock) {
    throw new Error("Recurring series was not found");
  }
  if (input.scope === "all") {
    updateTimeBlock(getSeriesUpdate(seriesBlock, input.occurrence, input.updatedBlock));
    return getPlannerSnapshot();
  }
  const database = getDb();
  const update = database.transaction(() => {
    if (input.scope === "this") {
      updateTimeBlock({
        ...seriesBlock,
        recurrenceExceptions: [
          ...seriesBlock.recurrenceExceptions ?? [],
          input.occurrence.startsAt
        ]
      });
      createTimeBlock(getSingleOccurrenceBlock(input.updatedBlock));
      return;
    }
    if (new Date(input.occurrence.startsAt).getTime() <= new Date(seriesBlock.startsAt).getTime()) {
      updateTimeBlock(getSeriesUpdate(seriesBlock, input.occurrence, input.updatedBlock));
      return;
    }
    updateTimeBlock(getTruncatedSeriesBlock(seriesBlock, input.occurrence));
    createTimeBlock(getFutureSeriesBlock(input.updatedBlock));
  });
  update();
  return getPlannerSnapshot();
}
function deleteTimeBlock(timeBlockId) {
  getDb().prepare("DELETE FROM time_blocks WHERE id = @timeBlockId").run({ timeBlockId });
  return timeBlockId;
}
function registerPlannerIpcHandlers() {
  ipcMain.handle("planner:getSnapshot", () => getPlannerSnapshot());
  ipcMain.handle(
    "planner:createCategory",
    (_event, input) => createCategory(input)
  );
  ipcMain.handle(
    "planner:updateCategory",
    (_event, input) => updateCategory(input)
  );
  ipcMain.handle(
    "planner:deleteCategory",
    (_event, categoryId) => deleteCategory(categoryId)
  );
  ipcMain.handle(
    "planner:createTask",
    (_event, input) => createTask(input)
  );
  ipcMain.handle(
    "planner:updateTask",
    (_event, input) => updateTask(input)
  );
  ipcMain.handle(
    "planner:deleteTask",
    (_event, taskId) => deleteTask(taskId)
  );
  ipcMain.handle(
    "planner:updateTaskStatus",
    (_event, taskId, status) => updateTaskStatus(taskId, status)
  );
  ipcMain.handle(
    "planner:createTimeBlock",
    (_event, input) => createTimeBlock(input)
  );
  ipcMain.handle(
    "planner:updateTimeBlock",
    (_event, input) => updateTimeBlock(input)
  );
  ipcMain.handle(
    "planner:updateRecurringTimeBlock",
    (_event, input) => updateRecurringTimeBlock(input)
  );
  ipcMain.handle(
    "planner:deleteTimeBlock",
    (_event, timeBlockId) => deleteTimeBlock(timeBlockId)
  );
}
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: path.join(__dirname$1, "preload.mjs")
    }
  });
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
app.whenReady().then(() => {
  initializePlannerDatabase();
  registerPlannerIpcHandlers();
  createWindow();
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
