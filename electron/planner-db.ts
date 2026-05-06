import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'node:path'
import {
  sampleCategories,
  sampleTasks,
  sampleTimeBlocks,
} from '../src/data/sampleData'
import type { Category, Task, TimeBlock } from '../src/types/domain'

export type PlannerSnapshot = {
  categories: Category[]
  tasks: Task[]
  timeBlocks: TimeBlock[]
}

export type CreateCategoryInput = Omit<
  Category,
  'id' | 'defaultBlockKind' | 'hiddenFromCalendar' | 'includeInStatsByDefault'
> &
  Partial<
    Pick<
      Category,
      'defaultBlockKind' | 'hiddenFromCalendar' | 'includeInStatsByDefault'
    >
  >

export type CreateTaskInput = Omit<Task, 'id'>

export type CreateTimeBlockInput = Omit<
  TimeBlock,
  'id' | 'outcome' | 'status' | 'kind' | 'source'
> & {
  id?: string
  outcome?: TimeBlock['outcome']
  kind?: TimeBlock['kind']
  source?: TimeBlock['source']
}

export type UpdateCategoryInput = Category

export type UpdateTaskInput = Task

export type UpdateTimeBlockInput = TimeBlock

export type RecurringUpdateScope = 'all' | 'this' | 'future'

export type UpdateRecurringTimeBlockInput = {
  occurrence: TimeBlock
  updatedBlock: TimeBlock
  scope: RecurringUpdateScope
}

type CategoryRow = {
  id: string
  name: string
  color: Category['color']
  description: string
  default_block_kind: Category['defaultBlockKind'] | null
  hidden_from_calendar: 0 | 1 | null
  include_in_stats_by_default: 0 | 1 | null
}

type TaskRow = {
  id: string
  title: string
  notes: string
  category_id: string
  status: Task['status']
  priority: Task['priority']
  due_date: string | null
  planned_time_block_id: string | null
}

type SubtaskRow = {
  id: string
  task_id: string
  title: string
  completed: 0 | 1
}

type TimeBlockRow = {
  id: string
  title: string
  notes: string
  category_id: string
  task_id: string | null
  starts_at: string
  ends_at: string
  status: TimeBlock['status'] | null
  outcome: TimeBlock['outcome'] | null
  kind: TimeBlock['kind'] | null
  source: TimeBlock['source'] | null
  is_all_day: 0 | 1
  recurrence_frequency: TimeBlock['recurrenceFrequency'] | null
  recurrence_interval: number | null
  recurrence_weekdays: string | null
  recurrence_end_mode: TimeBlock['recurrenceEndMode'] | null
  recurrence_end_date: string | null
  recurrence_count: number | null
  recurrence_exceptions: string | null
}

let db: Database.Database | undefined

const createId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`

const parseRecurrenceWeekdays = (value: string | null) => {
  if (!value) {
    return undefined
  }

  try {
    const parsed = JSON.parse(value) as unknown
    if (
      Array.isArray(parsed) &&
      parsed.every((weekday) => Number.isInteger(weekday) && weekday >= 0 && weekday <= 6)
    ) {
      return parsed as number[]
    }
  } catch {
    return undefined
  }

  return undefined
}

const serializeRecurrenceWeekdays = (weekdays?: number[]) =>
  weekdays && weekdays.length > 0 ? JSON.stringify(weekdays) : null

const parseRecurrenceExceptions = (value: string | null) => {
  if (!value) {
    return undefined
  }

  try {
    const parsed = JSON.parse(value) as unknown
    if (Array.isArray(parsed) && parsed.every((date) => typeof date === 'string')) {
      return parsed as string[]
    }
  } catch {
    return undefined
  }

  return undefined
}

const serializeRecurrenceExceptions = (exceptions?: string[]) =>
  exceptions && exceptions.length > 0 ? JSON.stringify([...new Set(exceptions)].sort()) : null

const normalizeRecurrenceEndMode = (mode: TimeBlock['recurrenceEndMode'] | null, endDate: string | null) =>
  mode === 'never' && endDate ? 'on' : mode ?? (endDate ? 'on' : 'never')

const timeBlockOutcomes: TimeBlock['outcome'][] = ['active', 'abandoned']
const timeBlockKinds: TimeBlock['kind'][] = ['event', 'task-session', 'habit', 'routine']
const timeBlockSources: TimeBlock['source'][] = ['manual', 'pomodoro', 'generated', 'imported']

const mapStatusToOutcome = (status?: TimeBlock['status'] | null): TimeBlock['outcome'] => {
  if (status === 'skipped' || status === 'canceled') {
    return 'abandoned'
  }

  return 'active'
}

const mapOutcomeToStatus = (outcome?: TimeBlock['outcome'] | null): NonNullable<TimeBlock['status']> => {
  if (outcome === 'abandoned') {
    return 'skipped'
  }

  return 'planned'
}

const normalizeTimeBlockOutcome = (
  outcome?: TimeBlock['outcome'] | null,
  legacyStatus?: TimeBlock['status'] | null,
): TimeBlock['outcome'] =>
  outcome && timeBlockOutcomes.includes(outcome)
    ? outcome
    : mapStatusToOutcome(legacyStatus)

const normalizeTimeBlockKind = (
  kind?: TimeBlock['kind'] | Category['defaultBlockKind'] | null,
): TimeBlock['kind'] => (kind && timeBlockKinds.includes(kind) ? kind : 'event')

const normalizeTimeBlockSource = (
  source?: TimeBlock['source'] | null,
): TimeBlock['source'] =>
  source && timeBlockSources.includes(source) ? source : 'manual'

export function initializePlannerDatabase() {
  const databasePath = path.join(app.getPath('userData'), 'planner.sqlite3')
  db = new Database(databasePath)
  db.pragma('journal_mode = WAL')
  createSchema(db)
  seedDefaults(db)
}

function getDb() {
  if (!db) {
    throw new Error('Planner database has not been initialized')
  }

  return db
}

function createSchema(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      default_block_kind TEXT NOT NULL DEFAULT 'event',
      hidden_from_calendar INTEGER NOT NULL DEFAULT 0,
      include_in_stats_by_default INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      category_id TEXT NOT NULL,
      status TEXT NOT NULL,
      priority TEXT NOT NULL,
      due_date TEXT,
      planned_time_block_id TEXT,
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
      status TEXT NOT NULL DEFAULT 'planned',
      outcome TEXT NOT NULL DEFAULT 'active',
      kind TEXT NOT NULL DEFAULT 'event',
      source TEXT NOT NULL DEFAULT 'manual',
      is_all_day INTEGER NOT NULL DEFAULT 0,
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
  `)

  const categoryColumns = database
    .prepare('PRAGMA table_info(categories)')
    .all() as Array<{ name: string }>
  const categoryColumnNames = new Set(categoryColumns.map((column) => column.name))
  if (!categoryColumnNames.has('default_block_kind')) {
    database
      .prepare("ALTER TABLE categories ADD COLUMN default_block_kind TEXT NOT NULL DEFAULT 'event'")
      .run()
  }
  if (!categoryColumnNames.has('hidden_from_calendar')) {
    database
      .prepare('ALTER TABLE categories ADD COLUMN hidden_from_calendar INTEGER NOT NULL DEFAULT 0')
      .run()
  }
  if (!categoryColumnNames.has('include_in_stats_by_default')) {
    database
      .prepare(
        'ALTER TABLE categories ADD COLUMN include_in_stats_by_default INTEGER NOT NULL DEFAULT 1',
      )
      .run()
  }

  const taskColumns = database
    .prepare('PRAGMA table_info(tasks)')
    .all() as Array<{ name: string }>
  const taskColumnNames = new Set(taskColumns.map((column) => column.name))
  database.exec('DROP TABLE IF EXISTS tasks_without_lists')
  database.exec('DROP TABLE IF EXISTS tasks_without_estimates')
  if (taskColumnNames.has('list_id') || taskColumnNames.has('estimated_minutes')) {
    database.exec(`
      PRAGMA foreign_keys = OFF;

      CREATE TABLE tasks_without_estimates (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        notes TEXT NOT NULL DEFAULT '',
        category_id TEXT NOT NULL,
        status TEXT NOT NULL,
        priority TEXT NOT NULL,
        due_date TEXT,
        planned_time_block_id TEXT,
        FOREIGN KEY (category_id) REFERENCES categories(id)
      );

      INSERT INTO tasks_without_estimates (
        id, title, notes, category_id, status, priority,
        due_date, planned_time_block_id
      )
      SELECT
        id, title, notes, category_id, status, priority,
        due_date, planned_time_block_id
      FROM tasks;

      DROP TABLE tasks;
      ALTER TABLE tasks_without_estimates RENAME TO tasks;

      PRAGMA foreign_keys = ON;
    `)
  }

  database.exec('DROP TABLE IF EXISTS task_lists')

  const timeBlockColumns = database
    .prepare('PRAGMA table_info(time_blocks)')
    .all() as Array<{ name: string }>
  const timeBlockColumnNames = new Set(timeBlockColumns.map((column) => column.name))
  if (!timeBlockColumnNames.has('status')) {
    database
      .prepare("ALTER TABLE time_blocks ADD COLUMN status TEXT NOT NULL DEFAULT 'planned'")
      .run()
  }
  if (!timeBlockColumnNames.has('outcome')) {
    database
      .prepare("ALTER TABLE time_blocks ADD COLUMN outcome TEXT NOT NULL DEFAULT 'active'")
      .run()
    database
      .prepare(
        `UPDATE time_blocks
         SET outcome = CASE status
           WHEN 'skipped' THEN 'abandoned'
           WHEN 'canceled' THEN 'abandoned'
           ELSE 'active'
         END`,
      )
      .run()
  } else {
    database
      .prepare(
        `UPDATE time_blocks
         SET outcome = CASE status
           WHEN 'skipped' THEN 'abandoned'
           WHEN 'canceled' THEN 'abandoned'
           ELSE 'active'
         END
         WHERE outcome IS NULL
            OR outcome NOT IN ('active', 'abandoned')`,
      )
      .run()
  }
  database
    .prepare(
      `UPDATE time_blocks
       SET outcome = 'active'
       WHERE outcome IN ('scheduled', 'recorded')`,
    )
    .run()
  if (!timeBlockColumnNames.has('kind')) {
    database
      .prepare("ALTER TABLE time_blocks ADD COLUMN kind TEXT NOT NULL DEFAULT 'event'")
      .run()
  }
  if (!timeBlockColumnNames.has('source')) {
    database
      .prepare("ALTER TABLE time_blocks ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'")
      .run()
  }
  if (!timeBlockColumnNames.has('recurrence_frequency')) {
    database
      .prepare(
        "ALTER TABLE time_blocks ADD COLUMN recurrence_frequency TEXT NOT NULL DEFAULT 'none'",
      )
      .run()
  }
  if (!timeBlockColumnNames.has('is_all_day')) {
    database
      .prepare("ALTER TABLE time_blocks ADD COLUMN is_all_day INTEGER NOT NULL DEFAULT 0")
      .run()
  }
  if (!timeBlockColumnNames.has('recurrence_end_date')) {
    database
      .prepare('ALTER TABLE time_blocks ADD COLUMN recurrence_end_date TEXT')
      .run()
  }
  if (!timeBlockColumnNames.has('recurrence_interval')) {
    database
      .prepare("ALTER TABLE time_blocks ADD COLUMN recurrence_interval INTEGER NOT NULL DEFAULT 1")
      .run()
  }
  if (!timeBlockColumnNames.has('recurrence_weekdays')) {
    database
      .prepare('ALTER TABLE time_blocks ADD COLUMN recurrence_weekdays TEXT')
      .run()
  }
  if (!timeBlockColumnNames.has('recurrence_end_mode')) {
    database
      .prepare("ALTER TABLE time_blocks ADD COLUMN recurrence_end_mode TEXT NOT NULL DEFAULT 'never'")
      .run()
  }
  if (!timeBlockColumnNames.has('recurrence_count')) {
    database
      .prepare('ALTER TABLE time_blocks ADD COLUMN recurrence_count INTEGER')
      .run()
  }
  if (!timeBlockColumnNames.has('recurrence_exceptions')) {
    database
      .prepare('ALTER TABLE time_blocks ADD COLUMN recurrence_exceptions TEXT')
      .run()
  }
}

function seedDefaults(database: Database.Database) {
  const categoryCount = database
    .prepare('SELECT COUNT(*) AS count FROM categories')
    .get() as { count: number }

  if (categoryCount.count > 0) {
    return
  }

  const insertCategory = database.prepare(`
    INSERT INTO categories (
      id, name, color, description, default_block_kind,
      hidden_from_calendar, include_in_stats_by_default
    )
    VALUES (
      @id, @name, @color, @description, @defaultBlockKind,
      @hiddenFromCalendar, @includeInStatsByDefault
    )
  `)
  const insertTask = database.prepare(`
    INSERT INTO tasks (
      id, title, notes, category_id, status, priority,
      due_date, planned_time_block_id
    )
    VALUES (
      @id, @title, @notes, @categoryId, @status, @priority,
      @dueDate, @plannedTimeBlockId
    )
  `)
  const insertSubtask = database.prepare(`
    INSERT INTO subtasks (id, task_id, title, completed)
    VALUES (@id, @taskId, @title, @completed)
  `)
  const insertTimeBlock = database.prepare(`
    INSERT INTO time_blocks (
      id, title, notes, category_id, task_id, starts_at, ends_at,
      status, outcome, kind, source, is_all_day,
      recurrence_frequency, recurrence_interval, recurrence_weekdays,
      recurrence_end_mode, recurrence_end_date, recurrence_count,
      recurrence_exceptions
    )
    VALUES (
      @id, @title, @notes, @categoryId, @taskId, @startsAt, @endsAt,
      @status, @outcome, @kind, @source, @isAllDay,
      @recurrenceFrequency, @recurrenceInterval, @recurrenceWeekdays,
      @recurrenceEndMode, @recurrenceEndDate, @recurrenceCount,
      @recurrenceExceptions
    )
  `)

  const seed = database.transaction(() => {
    sampleCategories.forEach((category) =>
      insertCategory.run({
        ...category,
        defaultBlockKind: normalizeTimeBlockKind(category.defaultBlockKind),
        hiddenFromCalendar: category.hiddenFromCalendar ? 1 : 0,
        includeInStatsByDefault: category.includeInStatsByDefault ? 1 : 0,
      }),
    )
    sampleTasks.forEach((task) => {
      insertTask.run({
        ...task,
        dueDate: task.dueDate ?? null,
        plannedTimeBlockId: task.plannedTimeBlockId ?? null,
      })
      task.subtasks?.forEach((subtask) =>
        insertSubtask.run({
          ...subtask,
          taskId: task.id,
          completed: subtask.completed ? 1 : 0,
        }),
      )
    })
    sampleTimeBlocks.forEach((block) =>
      insertTimeBlock.run({
        ...block,
        taskId: block.taskId ?? null,
        outcome: normalizeTimeBlockOutcome(block.outcome, block.status),
        status: mapOutcomeToStatus(normalizeTimeBlockOutcome(block.outcome, block.status)),
        kind: normalizeTimeBlockKind(block.kind),
        source: normalizeTimeBlockSource(block.source),
        isAllDay: block.isAllDay ? 1 : 0,
        recurrenceFrequency: block.recurrenceFrequency ?? 'none',
        recurrenceInterval: block.recurrenceInterval ?? 1,
        recurrenceWeekdays: serializeRecurrenceWeekdays(block.recurrenceWeekdays),
        recurrenceEndMode: block.recurrenceEndMode ?? (block.recurrenceEndDate ? 'on' : 'never'),
        recurrenceEndDate: block.recurrenceEndDate ?? null,
        recurrenceCount: block.recurrenceCount ?? null,
        recurrenceExceptions: serializeRecurrenceExceptions(block.recurrenceExceptions),
      }),
    )
  })

  seed()
}

export function getPlannerSnapshot(): PlannerSnapshot {
  return {
    categories: getCategories(),
    tasks: getTasks(),
    timeBlocks: getTimeBlocks(),
  }
}

export function getCategories(): Category[] {
  const rows = getDb().prepare('SELECT * FROM categories ORDER BY name').all() as CategoryRow[]
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    color: row.color,
    description: row.description,
    defaultBlockKind: normalizeTimeBlockKind(row.default_block_kind),
    hiddenFromCalendar: Boolean(row.hidden_from_calendar),
    includeInStatsByDefault: row.include_in_stats_by_default !== 0,
  }))
}

export function createCategory(input: CreateCategoryInput): Category {
  const category: Category = {
    id: createId('cat'),
    name: input.name,
    color: input.color,
    description: input.description,
    defaultBlockKind: normalizeTimeBlockKind(input.defaultBlockKind),
    hiddenFromCalendar: input.hiddenFromCalendar ?? false,
    includeInStatsByDefault: input.includeInStatsByDefault ?? true,
  }

  getDb()
    .prepare(
      `INSERT INTO categories (
        id, name, color, description, default_block_kind,
        hidden_from_calendar, include_in_stats_by_default
      )
      VALUES (
        @id, @name, @color, @description, @defaultBlockKind,
        @hiddenFromCalendar, @includeInStatsByDefault
      )`,
    )
    .run({
      ...category,
      hiddenFromCalendar: category.hiddenFromCalendar ? 1 : 0,
      includeInStatsByDefault: category.includeInStatsByDefault ? 1 : 0,
    })

  return category
}

export function updateCategory(input: UpdateCategoryInput): Category {
  const category: Category = {
    ...input,
    defaultBlockKind: normalizeTimeBlockKind(input.defaultBlockKind),
    hiddenFromCalendar: input.hiddenFromCalendar ?? false,
    includeInStatsByDefault: input.includeInStatsByDefault ?? true,
  }

  getDb()
    .prepare(
      `UPDATE categories
       SET name = @name,
           color = @color,
           description = @description,
           default_block_kind = @defaultBlockKind,
           hidden_from_calendar = @hiddenFromCalendar,
           include_in_stats_by_default = @includeInStatsByDefault
       WHERE id = @id`,
    )
    .run({
      ...category,
      hiddenFromCalendar: category.hiddenFromCalendar ? 1 : 0,
      includeInStatsByDefault: category.includeInStatsByDefault ? 1 : 0,
    })

  return category
}

export function deleteCategory(categoryId: string) {
  const database = getDb()
  const fallbackCategory = database
    .prepare('SELECT id FROM categories WHERE id != @categoryId ORDER BY name LIMIT 1')
    .get({ categoryId }) as { id: string } | undefined

  if (!fallbackCategory) {
    throw new Error('Cannot delete the only category. Create another category first.')
  }

  const remove = database.transaction(() => {
    database
      .prepare(
        'UPDATE tasks SET category_id = @fallbackCategoryId WHERE category_id = @categoryId',
      )
      .run({ categoryId, fallbackCategoryId: fallbackCategory.id })
    database
      .prepare(
        'UPDATE time_blocks SET category_id = @fallbackCategoryId WHERE category_id = @categoryId',
      )
      .run({ categoryId, fallbackCategoryId: fallbackCategory.id })
    database.prepare('DELETE FROM categories WHERE id = @categoryId').run({ categoryId })
  })

  remove()
  return categoryId
}

export function getTasks(): Task[] {
  const taskRows = getDb().prepare('SELECT * FROM tasks ORDER BY due_date IS NULL, due_date, title').all() as TaskRow[]
  const subtaskRows = getDb().prepare('SELECT * FROM subtasks ORDER BY title').all() as SubtaskRow[]

  return taskRows.map((row) => {
    const subtasks = subtaskRows
      .filter((subtask) => subtask.task_id === row.id)
      .map((subtask) => ({
        id: subtask.id,
        title: subtask.title,
        completed: subtask.completed === 1,
      }))

    return {
      id: row.id,
      title: row.title,
      notes: row.notes,
      categoryId: row.category_id,
      status: row.status,
      priority: row.priority,
      dueDate: row.due_date ?? undefined,
      plannedTimeBlockId: row.planned_time_block_id ?? undefined,
      subtasks: subtasks.length > 0 ? subtasks : undefined,
    }
  })
}

export function createTask(input: CreateTaskInput): Task {
  const task: Task = {
    id: createId('task'),
    ...input,
  }

  const database = getDb()
  const insert = database.transaction(() => {
    database
      .prepare(`
        INSERT INTO tasks (
          id, title, notes, category_id, status, priority,
          due_date, planned_time_block_id
        )
        VALUES (
          @id, @title, @notes, @categoryId, @status, @priority,
          @dueDate, @plannedTimeBlockId
        )
      `)
      .run({
        ...task,
        dueDate: task.dueDate ?? null,
        plannedTimeBlockId: task.plannedTimeBlockId ?? null,
      })
    task.subtasks?.forEach((subtask) => {
      database
        .prepare(
          'INSERT INTO subtasks (id, task_id, title, completed) VALUES (@id, @taskId, @title, @completed)',
        )
        .run({
          ...subtask,
          taskId: task.id,
          completed: subtask.completed ? 1 : 0,
        })
    })
  })

  insert()
  return task
}

export function updateTask(input: UpdateTaskInput): Task {
  const database = getDb()
  const update = database.transaction(() => {
    database
      .prepare(`
        UPDATE tasks
        SET title = @title,
            notes = @notes,
            category_id = @categoryId,
            status = @status,
            priority = @priority,
            due_date = @dueDate,
            planned_time_block_id = @plannedTimeBlockId
        WHERE id = @id
      `)
      .run({
        ...input,
        dueDate: input.dueDate ?? null,
        plannedTimeBlockId: input.plannedTimeBlockId ?? null,
      })
    database.prepare('DELETE FROM subtasks WHERE task_id = @taskId').run({ taskId: input.id })
    input.subtasks?.forEach((subtask) => {
      database
        .prepare(
          'INSERT INTO subtasks (id, task_id, title, completed) VALUES (@id, @taskId, @title, @completed)',
        )
        .run({
          ...subtask,
          taskId: input.id,
          completed: subtask.completed ? 1 : 0,
        })
    })
  })

  update()
  return getTasks().find((task) => task.id === input.id) ?? input
}

export function deleteTask(taskId: string) {
  const database = getDb()
  const remove = database.transaction(() => {
    database
      .prepare('UPDATE time_blocks SET task_id = NULL WHERE task_id = @taskId')
      .run({ taskId })
    database.prepare('DELETE FROM subtasks WHERE task_id = @taskId').run({ taskId })
    database.prepare('DELETE FROM tasks WHERE id = @taskId').run({ taskId })
  })

  remove()
  return taskId
}

export function updateTaskStatus(taskId: string, status: Task['status']) {
  getDb()
    .prepare('UPDATE tasks SET status = @status WHERE id = @taskId')
    .run({ taskId, status })
  return getTasks().find((task) => task.id === taskId)
}

export function getTimeBlocks(): TimeBlock[] {
  const rows = getDb().prepare('SELECT * FROM time_blocks ORDER BY starts_at').all() as TimeBlockRow[]
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    notes: row.notes,
    categoryId: row.category_id,
    taskId: row.task_id ?? undefined,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    outcome: normalizeTimeBlockOutcome(row.outcome, row.status),
    kind: normalizeTimeBlockKind(row.kind),
    source: normalizeTimeBlockSource(row.source),
    isAllDay: Boolean(row.is_all_day),
    recurrenceFrequency: row.recurrence_frequency ?? 'none',
    recurrenceInterval: row.recurrence_interval ?? 1,
    recurrenceWeekdays: parseRecurrenceWeekdays(row.recurrence_weekdays),
    recurrenceEndMode: normalizeRecurrenceEndMode(
      row.recurrence_end_mode,
      row.recurrence_end_date,
    ),
    recurrenceEndDate: row.recurrence_end_date ?? undefined,
    recurrenceCount: row.recurrence_count ?? undefined,
    recurrenceExceptions: parseRecurrenceExceptions(row.recurrence_exceptions),
  }))
}

export function createTimeBlock(input: CreateTimeBlockInput): TimeBlock {
  const timeBlock: TimeBlock = {
    id: input.id ?? createId('block'),
    title: input.title,
    notes: input.notes,
    categoryId: input.categoryId,
    taskId: input.taskId,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    outcome: normalizeTimeBlockOutcome(input.outcome),
    kind: normalizeTimeBlockKind(input.kind),
    source: normalizeTimeBlockSource(input.source),
    isAllDay: input.isAllDay,
    recurrenceFrequency: input.recurrenceFrequency ?? 'none',
    recurrenceInterval: input.recurrenceInterval ?? 1,
    recurrenceWeekdays: input.recurrenceWeekdays,
    recurrenceEndMode: input.recurrenceEndMode ?? (input.recurrenceEndDate ? 'on' : 'never'),
    recurrenceEndDate: input.recurrenceEndDate,
    recurrenceCount: input.recurrenceCount,
    recurrenceExceptions: input.recurrenceExceptions,
  }

  getDb()
    .prepare(`
      INSERT INTO time_blocks (
        id, title, notes, category_id, task_id, starts_at, ends_at,
        status, outcome, kind, source, is_all_day,
        recurrence_frequency, recurrence_interval, recurrence_weekdays,
        recurrence_end_mode, recurrence_end_date, recurrence_count,
        recurrence_exceptions
      )
      VALUES (
        @id, @title, @notes, @categoryId, @taskId, @startsAt, @endsAt,
        @status, @outcome, @kind, @source, @isAllDay,
        @recurrenceFrequency, @recurrenceInterval, @recurrenceWeekdays,
        @recurrenceEndMode, @recurrenceEndDate, @recurrenceCount,
        @recurrenceExceptions
      )
    `)
    .run({
      ...timeBlock,
      taskId: timeBlock.taskId ?? null,
      status: mapOutcomeToStatus(timeBlock.outcome),
      isAllDay: timeBlock.isAllDay ? 1 : 0,
      recurrenceFrequency: timeBlock.recurrenceFrequency ?? 'none',
      recurrenceInterval: timeBlock.recurrenceInterval ?? 1,
      recurrenceWeekdays: serializeRecurrenceWeekdays(timeBlock.recurrenceWeekdays),
      recurrenceEndMode: timeBlock.recurrenceEndMode ?? 'never',
      recurrenceEndDate: timeBlock.recurrenceEndDate ?? null,
      recurrenceCount: timeBlock.recurrenceCount ?? null,
      recurrenceExceptions: serializeRecurrenceExceptions(timeBlock.recurrenceExceptions),
    })

  return timeBlock
}

export function updateTimeBlock(input: UpdateTimeBlockInput): TimeBlock {
  getDb()
    .prepare(`
      UPDATE time_blocks
      SET title = @title,
          notes = @notes,
          category_id = @categoryId,
          task_id = @taskId,
          starts_at = @startsAt,
          ends_at = @endsAt,
          status = @status,
          outcome = @outcome,
          kind = @kind,
          source = @source,
          is_all_day = @isAllDay,
          recurrence_frequency = @recurrenceFrequency,
          recurrence_interval = @recurrenceInterval,
          recurrence_weekdays = @recurrenceWeekdays,
          recurrence_end_mode = @recurrenceEndMode,
          recurrence_end_date = @recurrenceEndDate,
          recurrence_count = @recurrenceCount,
          recurrence_exceptions = @recurrenceExceptions
      WHERE id = @id
    `)
    .run({
      ...input,
      taskId: input.taskId ?? null,
      outcome: normalizeTimeBlockOutcome(input.outcome, input.status),
      status: mapOutcomeToStatus(normalizeTimeBlockOutcome(input.outcome, input.status)),
      kind: normalizeTimeBlockKind(input.kind),
      source: normalizeTimeBlockSource(input.source),
      isAllDay: input.isAllDay ? 1 : 0,
      recurrenceFrequency: input.recurrenceFrequency ?? 'none',
      recurrenceInterval: input.recurrenceInterval ?? 1,
      recurrenceWeekdays: serializeRecurrenceWeekdays(input.recurrenceWeekdays),
      recurrenceEndMode: input.recurrenceEndMode ?? 'never',
      recurrenceEndDate: input.recurrenceEndDate ?? null,
      recurrenceCount: input.recurrenceCount ?? null,
      recurrenceExceptions: serializeRecurrenceExceptions(input.recurrenceExceptions),
    })

  return {
    ...input,
    outcome: normalizeTimeBlockOutcome(input.outcome, input.status),
    kind: normalizeTimeBlockKind(input.kind),
    source: normalizeTimeBlockSource(input.source),
  }
}

const addMs = (date: string, deltaMs: number) =>
  new Date(new Date(date).getTime() + deltaMs).toISOString()

const getSeriesUpdate = (
  seriesBlock: TimeBlock,
  occurrence: TimeBlock,
  updatedBlock: TimeBlock,
): TimeBlock => {
  const startDelta =
    new Date(updatedBlock.startsAt).getTime() - new Date(occurrence.startsAt).getTime()
  const endDelta =
    new Date(updatedBlock.endsAt).getTime() - new Date(occurrence.endsAt).getTime()

  return {
    ...seriesBlock,
    title: updatedBlock.title,
    notes: updatedBlock.notes,
    categoryId: updatedBlock.categoryId,
    taskId: updatedBlock.taskId,
    startsAt: addMs(seriesBlock.startsAt, startDelta),
    endsAt: addMs(seriesBlock.endsAt, endDelta),
    outcome: updatedBlock.outcome,
    kind: updatedBlock.kind,
    source: updatedBlock.source,
    isAllDay: updatedBlock.isAllDay,
    recurrenceFrequency: updatedBlock.recurrenceFrequency ?? seriesBlock.recurrenceFrequency,
    recurrenceInterval: updatedBlock.recurrenceInterval ?? seriesBlock.recurrenceInterval,
    recurrenceWeekdays: updatedBlock.recurrenceWeekdays ?? seriesBlock.recurrenceWeekdays,
    recurrenceEndMode: updatedBlock.recurrenceEndMode ?? seriesBlock.recurrenceEndMode,
    recurrenceEndDate: updatedBlock.recurrenceEndDate,
    recurrenceCount: updatedBlock.recurrenceCount,
    recurrenceExceptions: seriesBlock.recurrenceExceptions,
  }
}

const getSingleOccurrenceBlock = (updatedBlock: TimeBlock): TimeBlock => ({
  ...updatedBlock,
  id: createId('block'),
  recurrenceFrequency: 'none',
  recurrenceInterval: undefined,
  recurrenceWeekdays: undefined,
  recurrenceEndMode: 'never',
  recurrenceEndDate: undefined,
  recurrenceCount: undefined,
  recurrenceExceptions: undefined,
  recurringTimeBlockId: undefined,
})

const getFutureSeriesBlock = (updatedBlock: TimeBlock): TimeBlock => ({
  ...updatedBlock,
  id: createId('block'),
  recurringTimeBlockId: undefined,
  recurrenceExceptions: undefined,
})

const getTruncatedSeriesBlock = (
  seriesBlock: TimeBlock,
  occurrence: TimeBlock,
): TimeBlock => ({
  ...seriesBlock,
  recurrenceEndMode: 'on',
  recurrenceEndDate: new Date(
    new Date(occurrence.startsAt).getTime() - 1000,
  ).toISOString(),
  recurrenceCount: undefined,
})

export function updateRecurringTimeBlock(
  input: UpdateRecurringTimeBlockInput,
): PlannerSnapshot {
  const seriesId = input.occurrence.recurringTimeBlockId ?? input.occurrence.id
  const seriesBlock = getTimeBlocks().find((block) => block.id === seriesId)
  if (!seriesBlock) {
    throw new Error('Recurring series was not found')
  }

  if (input.scope === 'all') {
    updateTimeBlock(getSeriesUpdate(seriesBlock, input.occurrence, input.updatedBlock))
    return getPlannerSnapshot()
  }

  const database = getDb()
  const update = database.transaction(() => {
    if (input.scope === 'this') {
      updateTimeBlock({
        ...seriesBlock,
        recurrenceExceptions: [
          ...(seriesBlock.recurrenceExceptions ?? []),
          input.occurrence.startsAt,
        ],
      })
      createTimeBlock(getSingleOccurrenceBlock(input.updatedBlock))
      return
    }

    if (new Date(input.occurrence.startsAt).getTime() <= new Date(seriesBlock.startsAt).getTime()) {
      updateTimeBlock(getSeriesUpdate(seriesBlock, input.occurrence, input.updatedBlock))
      return
    }

    updateTimeBlock(getTruncatedSeriesBlock(seriesBlock, input.occurrence))
    createTimeBlock(getFutureSeriesBlock(input.updatedBlock))
  })

  update()
  return getPlannerSnapshot()
}

export function deleteTimeBlock(timeBlockId: string) {
  getDb()
    .prepare('DELETE FROM time_blocks WHERE id = @timeBlockId')
    .run({ timeBlockId })
  return timeBlockId
}
