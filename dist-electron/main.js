import { app as N, ipcMain as m, BrowserWindow as w } from "electron";
import { fileURLToPath as x } from "node:url";
import _ from "node:path";
import H from "better-sqlite3";
function u(e, t) {
  const r = new Date(e);
  return r.setDate(r.getDate() + t), r;
}
function T(e, t, r = 0) {
  const c = new Date(e);
  return c.setHours(t, r, 0, 0), c;
}
const o = /* @__PURE__ */ new Date();
o.setHours(0, 0, 0, 0);
const s = (e) => e.toISOString(), K = [
  {
    id: "cat-work",
    name: "Work",
    color: "cyan",
    description: "Focused project work and meetings.",
    defaultBlockKind: "event",
    hiddenFromCalendar: !1,
    includeInStatsByDefault: !0
  },
  {
    id: "cat-personal",
    name: "Personal",
    color: "green",
    description: "Home, errands, and life admin.",
    defaultBlockKind: "event",
    hiddenFromCalendar: !1,
    includeInStatsByDefault: !0
  },
  {
    id: "cat-health",
    name: "Health",
    color: "pink",
    description: "Exercise, meals, and recovery routines.",
    defaultBlockKind: "event",
    hiddenFromCalendar: !1,
    includeInStatsByDefault: !0
  },
  {
    id: "cat-learning",
    name: "Learning",
    color: "purple",
    description: "Classes, reading, and skill practice.",
    defaultBlockKind: "event",
    hiddenFromCalendar: !1,
    includeInStatsByDefault: !0
  },
  {
    id: "cat-finance",
    name: "Finance",
    color: "yellow",
    description: "Bills, budgets, and planning.",
    defaultBlockKind: "event",
    hiddenFromCalendar: !1,
    includeInStatsByDefault: !0
  }
], Y = [
  {
    id: "block-week-planning",
    title: "Weekly planning pass",
    notes: "Sketch priorities and choose focus blocks.",
    categoryId: "cat-work",
    taskId: "task-plan-week",
    startsAt: s(T(o, 9)),
    endsAt: s(T(o, 10)),
    outcome: "active",
    kind: "event",
    source: "manual"
  },
  {
    id: "block-email",
    title: "Inbox triage",
    notes: "Clear urgent replies and archive stale threads.",
    categoryId: "cat-work",
    taskId: "task-send-proposal",
    startsAt: s(T(o, 10, 30)),
    endsAt: s(T(o, 11)),
    outcome: "active",
    kind: "event",
    source: "manual"
  },
  {
    id: "block-design-review",
    title: "Design review prep",
    notes: "Prepare notes for the upcoming app shell review.",
    categoryId: "cat-work",
    taskId: "task-review-shell",
    startsAt: s(T(u(o, 1), 13)),
    endsAt: s(T(u(o, 1), 14, 30)),
    outcome: "active",
    kind: "event",
    source: "manual"
  },
  {
    id: "block-grocery",
    title: "Grocery run",
    notes: "Pick up ingredients and pantry basics.",
    categoryId: "cat-personal",
    taskId: "task-grocery-list",
    startsAt: s(T(u(o, 1), 17, 30)),
    endsAt: s(T(u(o, 1), 18, 15)),
    outcome: "active",
    kind: "event",
    source: "manual"
  },
  {
    id: "block-workout",
    title: "Workout",
    notes: "Light cardio and mobility.",
    categoryId: "cat-health",
    startsAt: s(T(u(o, 2), 7)),
    endsAt: s(T(u(o, 2), 7, 45)),
    outcome: "active",
    kind: "event",
    source: "manual"
  },
  {
    id: "block-reading",
    title: "Read TypeScript notes",
    notes: "Review stricter domain modeling patterns.",
    categoryId: "cat-learning",
    taskId: "task-read-typescript",
    startsAt: s(T(u(o, 3), 19)),
    endsAt: s(T(u(o, 3), 20)),
    outcome: "active",
    kind: "event",
    source: "manual"
  },
  {
    id: "block-budget",
    title: "Monthly budget review",
    notes: "Check recurring costs and savings targets.",
    categoryId: "cat-finance",
    taskId: "task-budget-review",
    startsAt: s(T(u(o, 5), 11)),
    endsAt: s(T(u(o, 5), 12)),
    outcome: "active",
    kind: "event",
    source: "manual"
  },
  {
    id: "block-catchup",
    title: "Open planning buffer",
    notes: "Flexible time for overflow items.",
    categoryId: "cat-personal",
    startsAt: s(T(u(o, 6), 15)),
    endsAt: s(T(u(o, 6), 16)),
    outcome: "active",
    kind: "event",
    source: "manual"
  }
], q = [
  {
    id: "task-renew-license",
    title: "Renew software license",
    notes: "Overdue administrative item for the project toolkit.",
    categoryId: "cat-work",
    status: "todo",
    priority: "high",
    dueDate: s(u(o, -2))
  },
  {
    id: "task-plan-week",
    title: "Plan the week",
    notes: "Due today and linked to the first planned block.",
    categoryId: "cat-work",
    status: "in-progress",
    priority: "high",
    dueDate: s(o),
    plannedTimeBlockId: "block-week-planning",
    subtasks: [
      { id: "subtask-review-calendar", title: "Review calendar", completed: !0 },
      { id: "subtask-pick-focus", title: "Pick three focus items", completed: !1 },
      { id: "subtask-block-time", title: "Block deep work time", completed: !1 }
    ]
  },
  {
    id: "task-grocery-list",
    title: "Make grocery list",
    notes: "Capture ingredients before the planned store run.",
    categoryId: "cat-personal",
    status: "todo",
    priority: "medium",
    dueDate: s(u(o, 1)),
    plannedTimeBlockId: "block-grocery",
    subtasks: [
      { id: "subtask-check-pantry", title: "Check pantry staples", completed: !1 }
    ]
  },
  {
    id: "task-review-shell",
    title: "Review app shell notes",
    notes: "Due in a few days as preparation for the next UI phase.",
    categoryId: "cat-work",
    status: "todo",
    priority: "medium",
    dueDate: s(u(o, 3)),
    plannedTimeBlockId: "block-design-review"
  },
  {
    id: "task-read-typescript",
    title: "Read TypeScript domain modeling chapter",
    notes: "Learning task tied to a reading block.",
    categoryId: "cat-learning",
    status: "todo",
    priority: "low",
    dueDate: s(u(o, 4)),
    plannedTimeBlockId: "block-reading"
  },
  {
    id: "task-budget-review",
    title: "Review monthly budget",
    notes: "Finance check-in due later this week.",
    categoryId: "cat-finance",
    status: "todo",
    priority: "medium",
    dueDate: s(u(o, 7)),
    plannedTimeBlockId: "block-budget"
  },
  {
    id: "task-send-proposal",
    title: "Send proposal follow-up",
    notes: "Short email follow-up after inbox triage.",
    categoryId: "cat-work",
    status: "todo",
    priority: "high",
    dueDate: s(u(o, 2)),
    plannedTimeBlockId: "block-email"
  },
  {
    id: "task-backup-files",
    title: "Back up planner notes",
    notes: "Later task for a local data hygiene pass.",
    categoryId: "cat-personal",
    status: "todo",
    priority: "low",
    dueDate: s(u(o, 14))
  },
  {
    id: "task-capture-ideas",
    title: "Capture planner improvement ideas",
    notes: "Unscheduled ideas for future planner iterations.",
    categoryId: "cat-personal",
    status: "todo",
    priority: "low"
  }
];
let L;
const A = (e) => `${e}-${Date.now()}-${Math.random().toString(16).slice(2)}`, V = (e) => {
  if (e)
    try {
      const t = JSON.parse(e);
      if (Array.isArray(t) && t.every((r) => Number.isInteger(r) && r >= 0 && r <= 6))
        return t;
    } catch {
      return;
    }
}, h = (e) => e && e.length > 0 ? JSON.stringify(e) : null, j = (e) => {
  if (e)
    try {
      const t = JSON.parse(e);
      if (Array.isArray(t) && t.every((r) => typeof r == "string"))
        return t;
    } catch {
      return;
    }
}, S = (e) => e && e.length > 0 ? JSON.stringify([...new Set(e)].sort()) : null, z = (e, t) => e === "never" && t ? "on" : e ?? (t ? "on" : "never"), $ = ["active", "abandoned"], J = ["event", "task-session", "habit", "routine"], Q = ["manual", "pomodoro", "generated", "imported"], Z = [
  {
    id: "stats-group-work-study",
    name: "Work / Study",
    color: "#60a5fa",
    sortOrder: 0,
    countsTowardProductiveTime: !0,
    categoryIds: []
  },
  {
    id: "stats-group-entertainment",
    name: "Entertainment",
    color: "#a78bfa",
    sortOrder: 1,
    countsTowardProductiveTime: !0,
    categoryIds: []
  },
  {
    id: "stats-group-sleep-meals",
    name: "Sleep / Meals",
    color: "#f59e0b",
    sortOrder: 2,
    countsTowardProductiveTime: !1,
    categoryIds: []
  },
  {
    id: "stats-group-rest-recovery",
    name: "Rest / Recovery",
    color: "#34d399",
    sortOrder: 3,
    countsTowardProductiveTime: !1,
    categoryIds: []
  },
  {
    id: "stats-group-creative",
    name: "Creative",
    color: "#f472b6",
    sortOrder: 4,
    countsTowardProductiveTime: !0,
    categoryIds: []
  },
  {
    id: "stats-group-health",
    name: "Health",
    color: "#f87171",
    sortOrder: 5,
    countsTowardProductiveTime: !0,
    categoryIds: []
  },
  {
    id: "stats-group-other",
    name: "Other",
    color: "#94a3b8",
    sortOrder: 6,
    countsTowardProductiveTime: !0,
    categoryIds: []
  }
], ee = [
  {
    id: "stats-group-work-study",
    matcher: /work|job|study|school|class|course|learning|reading|research|meeting|project|lab/
  },
  {
    id: "stats-group-entertainment",
    matcher: /entertainment|game|gaming|movie|show|tv|stream|social|fun/
  },
  {
    id: "stats-group-sleep-meals",
    matcher: /sleep|meal|food|breakfast|lunch|dinner|eat|cooking|cook/
  },
  {
    id: "stats-group-rest-recovery",
    matcher: /rest|recovery|recover|break|relax|recharge|downtime/
  },
  {
    id: "stats-group-creative",
    matcher: /creative|art|drawing|design|write|writing|craft|compose/
  },
  {
    id: "stats-group-health",
    matcher: /health|gym|workout|exercise|fitness|doctor|medical|therapy/
  }
], te = (e) => e === "skipped" || e === "canceled" ? "abandoned" : "active", U = (e) => e === "abandoned" ? "skipped" : "planned", y = (e, t) => e && $.includes(e) ? e : te(t), k = (e) => e && J.includes(e) ? e : "event", f = (e) => e && Q.includes(e) ? e : "manual";
function re() {
  const e = _.join(N.getPath("userData"), "planner.sqlite3");
  L = new H(e), L.pragma("journal_mode = WAL"), ne(L), ae(L), oe(L);
}
function E() {
  if (!L)
    throw new Error("Planner database has not been initialized");
  return L;
}
function ne(e) {
  e.exec(`
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

    CREATE TABLE IF NOT EXISTS stats_groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      counts_toward_active_time INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS stats_group_categories (
      group_id TEXT NOT NULL,
      category_id TEXT NOT NULL UNIQUE,
      PRIMARY KEY (group_id, category_id),
      FOREIGN KEY (group_id) REFERENCES stats_groups(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
    );
  `);
  const t = e.prepare("PRAGMA table_info(categories)").all(), r = new Set(t.map((p) => p.name));
  r.has("default_block_kind") || e.prepare("ALTER TABLE categories ADD COLUMN default_block_kind TEXT NOT NULL DEFAULT 'event'").run(), r.has("hidden_from_calendar") || e.prepare("ALTER TABLE categories ADD COLUMN hidden_from_calendar INTEGER NOT NULL DEFAULT 0").run(), r.has("include_in_stats_by_default") || e.prepare(
    "ALTER TABLE categories ADD COLUMN include_in_stats_by_default INTEGER NOT NULL DEFAULT 1"
  ).run();
  const c = e.prepare("PRAGMA table_info(tasks)").all(), n = new Set(c.map((p) => p.name));
  e.exec("DROP TABLE IF EXISTS tasks_without_lists"), e.exec("DROP TABLE IF EXISTS tasks_without_estimates"), (n.has("list_id") || n.has("estimated_minutes")) && e.exec(`
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
    `), e.exec("DROP TABLE IF EXISTS task_lists");
  const i = e.prepare("PRAGMA table_info(time_blocks)").all(), l = new Set(i.map((p) => p.name));
  l.has("status") || e.prepare("ALTER TABLE time_blocks ADD COLUMN status TEXT NOT NULL DEFAULT 'planned'").run(), l.has("outcome") ? e.prepare(
    `UPDATE time_blocks
         SET outcome = CASE status
           WHEN 'skipped' THEN 'abandoned'
           WHEN 'canceled' THEN 'abandoned'
           ELSE 'active'
         END
         WHERE outcome IS NULL
            OR outcome NOT IN ('active', 'abandoned')`
  ).run() : (e.prepare("ALTER TABLE time_blocks ADD COLUMN outcome TEXT NOT NULL DEFAULT 'active'").run(), e.prepare(
    `UPDATE time_blocks
         SET outcome = CASE status
           WHEN 'skipped' THEN 'abandoned'
           WHEN 'canceled' THEN 'abandoned'
           ELSE 'active'
         END`
  ).run()), e.prepare(
    `UPDATE time_blocks
       SET outcome = 'active'
       WHERE outcome IN ('scheduled', 'recorded')`
  ).run(), l.has("kind") || e.prepare("ALTER TABLE time_blocks ADD COLUMN kind TEXT NOT NULL DEFAULT 'event'").run(), l.has("source") || e.prepare("ALTER TABLE time_blocks ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'").run(), l.has("recurrence_frequency") || e.prepare(
    "ALTER TABLE time_blocks ADD COLUMN recurrence_frequency TEXT NOT NULL DEFAULT 'none'"
  ).run(), l.has("is_all_day") || e.prepare("ALTER TABLE time_blocks ADD COLUMN is_all_day INTEGER NOT NULL DEFAULT 0").run(), l.has("recurrence_end_date") || e.prepare("ALTER TABLE time_blocks ADD COLUMN recurrence_end_date TEXT").run(), l.has("recurrence_interval") || e.prepare("ALTER TABLE time_blocks ADD COLUMN recurrence_interval INTEGER NOT NULL DEFAULT 1").run(), l.has("recurrence_weekdays") || e.prepare("ALTER TABLE time_blocks ADD COLUMN recurrence_weekdays TEXT").run(), l.has("recurrence_end_mode") || e.prepare("ALTER TABLE time_blocks ADD COLUMN recurrence_end_mode TEXT NOT NULL DEFAULT 'never'").run(), l.has("recurrence_count") || e.prepare("ALTER TABLE time_blocks ADD COLUMN recurrence_count INTEGER").run(), l.has("recurrence_exceptions") || e.prepare("ALTER TABLE time_blocks ADD COLUMN recurrence_exceptions TEXT").run();
  const a = e.prepare("PRAGMA table_info(stats_groups)").all(), d = new Set(a.map((p) => p.name));
  d.has("created_at") || e.prepare("ALTER TABLE stats_groups ADD COLUMN created_at TEXT NOT NULL DEFAULT ''").run(), d.has("updated_at") || e.prepare("ALTER TABLE stats_groups ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''").run(), d.has("counts_toward_active_time") || (e.prepare(
    "ALTER TABLE stats_groups ADD COLUMN counts_toward_active_time INTEGER NOT NULL DEFAULT 1"
  ).run(), e.prepare(
    `UPDATE stats_groups
         SET counts_toward_active_time = 0
         WHERE lower(name) IN ('sleep / meals', 'rest / recovery')`
  ).run()), e.prepare(
    `UPDATE stats_groups
       SET created_at = CASE WHEN created_at = '' THEN datetime('now') ELSE created_at END,
           updated_at = CASE WHEN updated_at = '' THEN datetime('now') ELSE updated_at END`
  ).run();
}
function ae(e) {
  if (e.prepare("SELECT COUNT(*) AS count FROM categories").get().count > 0)
    return;
  const r = e.prepare(`
    INSERT INTO categories (
      id, name, color, description, default_block_kind,
      hidden_from_calendar, include_in_stats_by_default
    )
    VALUES (
      @id, @name, @color, @description, @defaultBlockKind,
      @hiddenFromCalendar, @includeInStatsByDefault
    )
  `), c = e.prepare(`
    INSERT INTO tasks (
      id, title, notes, category_id, status, priority,
      due_date, planned_time_block_id
    )
    VALUES (
      @id, @title, @notes, @categoryId, @status, @priority,
      @dueDate, @plannedTimeBlockId
    )
  `), n = e.prepare(`
    INSERT INTO subtasks (id, task_id, title, completed)
    VALUES (@id, @taskId, @title, @completed)
  `), i = e.prepare(`
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
  `);
  e.transaction(() => {
    K.forEach(
      (a) => r.run({
        ...a,
        defaultBlockKind: k(a.defaultBlockKind),
        hiddenFromCalendar: a.hiddenFromCalendar ? 1 : 0,
        includeInStatsByDefault: a.includeInStatsByDefault ? 1 : 0
      })
    ), q.forEach((a) => {
      var d;
      c.run({
        ...a,
        dueDate: a.dueDate ?? null,
        plannedTimeBlockId: a.plannedTimeBlockId ?? null
      }), (d = a.subtasks) == null || d.forEach(
        (p) => n.run({
          ...p,
          taskId: a.id,
          completed: p.completed ? 1 : 0
        })
      );
    }), Y.forEach(
      (a) => i.run({
        ...a,
        taskId: a.taskId ?? null,
        outcome: y(a.outcome, a.status),
        status: U(y(a.outcome, a.status)),
        kind: k(a.kind),
        source: f(a.source),
        isAllDay: a.isAllDay ? 1 : 0,
        recurrenceFrequency: a.recurrenceFrequency ?? "none",
        recurrenceInterval: a.recurrenceInterval ?? 1,
        recurrenceWeekdays: h(a.recurrenceWeekdays),
        recurrenceEndMode: a.recurrenceEndMode ?? (a.recurrenceEndDate ? "on" : "never"),
        recurrenceEndDate: a.recurrenceEndDate ?? null,
        recurrenceCount: a.recurrenceCount ?? null,
        recurrenceExceptions: S(a.recurrenceExceptions)
      })
    );
  })();
}
function ce(e) {
  var r;
  const t = e.name.toLowerCase();
  return ((r = ee.find(
    (c) => c.matcher.test(t)
  )) == null ? void 0 : r.id) ?? "stats-group-other";
}
function oe(e) {
  if (e.prepare("SELECT COUNT(*) AS count FROM stats_groups").get().count > 0)
    return;
  e.transaction(() => b(e))();
}
function b(e) {
  const t = (/* @__PURE__ */ new Date()).toISOString(), r = e.prepare(`
    INSERT INTO stats_groups (
      id, name, color, sort_order, counts_toward_active_time, created_at, updated_at
    )
    VALUES (
      @id, @name, @color, @sortOrder, @countsTowardProductiveTime,
      @createdAt, @updatedAt
    )
  `), c = e.prepare(`
    INSERT OR REPLACE INTO stats_group_categories (group_id, category_id)
    VALUES (@groupId, @categoryId)
  `), n = e.prepare("SELECT * FROM categories ORDER BY name").all();
  Z.forEach(
    (i) => r.run({
      id: i.id,
      name: i.name,
      color: i.color,
      sortOrder: i.sortOrder,
      countsTowardProductiveTime: i.countsTowardProductiveTime ? 1 : 0,
      createdAt: t,
      updatedAt: t
    })
  ), n.forEach((i) => {
    c.run({
      groupId: ce(i),
      categoryId: i.id
    });
  });
}
function D() {
  return {
    categories: ie(),
    statsGroups: R(),
    tasks: C(),
    timeBlocks: M()
  };
}
function se(e, t) {
  return {
    id: e.id || A("stats-group"),
    name: e.name.trim() || "Untitled group",
    color: /^#[0-9a-f]{6}$/i.test(e.color) ? e.color : "#22d3ee",
    sortOrder: Number.isFinite(e.sortOrder) ? e.sortOrder : t,
    countsTowardProductiveTime: e.countsTowardProductiveTime ?? !0,
    categoryIds: [...new Set(e.categoryIds)]
  };
}
function R() {
  const e = E(), t = e.prepare("SELECT * FROM stats_groups ORDER BY sort_order, name").all(), r = e.prepare("SELECT * FROM stats_group_categories").all(), c = /* @__PURE__ */ new Map();
  return r.forEach((n) => {
    c.set(n.group_id, [
      ...c.get(n.group_id) ?? [],
      n.category_id
    ]);
  }), t.map((n) => ({
    id: n.id,
    name: n.name,
    color: n.color,
    sortOrder: n.sort_order,
    countsTowardProductiveTime: n.counts_toward_active_time !== 0,
    categoryIds: c.get(n.id) ?? []
  }));
}
function de(e) {
  const t = E(), r = R(), c = new Set(r.map((d) => d.id)), n = e.map(se), i = new Set(n.map((d) => d.id)), l = (/* @__PURE__ */ new Date()).toISOString();
  return t.transaction(() => {
    if (n.length === 0) {
      t.prepare("DELETE FROM stats_group_categories").run(), t.prepare("DELETE FROM stats_groups").run(), b(t);
      return;
    }
    t.prepare("DELETE FROM stats_group_categories").run(), r.forEach((d) => {
      i.has(d.id) || t.prepare("DELETE FROM stats_groups WHERE id = @id").run({ id: d.id });
    }), n.forEach((d, p) => {
      c.has(d.id) ? t.prepare(
        `UPDATE stats_groups
             SET name = @name,
                 color = @color,
                 sort_order = @sortOrder,
                  counts_toward_active_time = @countsTowardProductiveTime,
                 updated_at = @updatedAt
             WHERE id = @id`
      ).run({
        ...d,
        sortOrder: p,
        countsTowardProductiveTime: d.countsTowardProductiveTime ? 1 : 0,
        updatedAt: l
      }) : t.prepare(
        `INSERT INTO stats_groups (
              id, name, color, sort_order, counts_toward_active_time,
              created_at, updated_at
            )
            VALUES (
              @id, @name, @color, @sortOrder, @countsTowardProductiveTime,
              @createdAt, @updatedAt
            )`
      ).run({
        ...d,
        sortOrder: p,
        countsTowardProductiveTime: d.countsTowardProductiveTime ? 1 : 0,
        createdAt: l,
        updatedAt: l
      }), d.categoryIds.forEach((G) => {
        t.prepare(
          `INSERT OR REPLACE INTO stats_group_categories (group_id, category_id)
             VALUES (@groupId, @categoryId)`
        ).run({
          groupId: d.id,
          categoryId: G
        });
      });
    });
  })(), R();
}
function ie() {
  return E().prepare("SELECT * FROM categories ORDER BY name").all().map((t) => ({
    id: t.id,
    name: t.name,
    color: t.color,
    description: t.description,
    defaultBlockKind: k(t.default_block_kind),
    hiddenFromCalendar: !!t.hidden_from_calendar,
    includeInStatsByDefault: t.include_in_stats_by_default !== 0
  }));
}
function ue(e) {
  const t = {
    id: A("cat"),
    name: e.name,
    color: e.color,
    description: e.description,
    defaultBlockKind: k(e.defaultBlockKind),
    hiddenFromCalendar: e.hiddenFromCalendar ?? !1,
    includeInStatsByDefault: e.includeInStatsByDefault ?? !0
  };
  return E().prepare(
    `INSERT INTO categories (
        id, name, color, description, default_block_kind,
        hidden_from_calendar, include_in_stats_by_default
      )
      VALUES (
        @id, @name, @color, @description, @defaultBlockKind,
        @hiddenFromCalendar, @includeInStatsByDefault
      )`
  ).run({
    ...t,
    hiddenFromCalendar: t.hiddenFromCalendar ? 1 : 0,
    includeInStatsByDefault: t.includeInStatsByDefault ? 1 : 0
  }), t;
}
function le(e) {
  const t = {
    ...e,
    defaultBlockKind: k(e.defaultBlockKind),
    hiddenFromCalendar: e.hiddenFromCalendar ?? !1,
    includeInStatsByDefault: e.includeInStatsByDefault ?? !0
  };
  return E().prepare(
    `UPDATE categories
       SET name = @name,
           color = @color,
           description = @description,
           default_block_kind = @defaultBlockKind,
           hidden_from_calendar = @hiddenFromCalendar,
           include_in_stats_by_default = @includeInStatsByDefault
       WHERE id = @id`
  ).run({
    ...t,
    hiddenFromCalendar: t.hiddenFromCalendar ? 1 : 0,
    includeInStatsByDefault: t.includeInStatsByDefault ? 1 : 0
  }), t;
}
function Ee(e) {
  const t = E(), r = t.prepare("SELECT id FROM categories WHERE id != @categoryId ORDER BY name LIMIT 1").get({ categoryId: e });
  if (!r)
    throw new Error("Cannot delete the only category. Create another category first.");
  return t.transaction(() => {
    t.prepare(
      "UPDATE tasks SET category_id = @fallbackCategoryId WHERE category_id = @categoryId"
    ).run({ categoryId: e, fallbackCategoryId: r.id }), t.prepare(
      "UPDATE time_blocks SET category_id = @fallbackCategoryId WHERE category_id = @categoryId"
    ).run({ categoryId: e, fallbackCategoryId: r.id }), t.prepare("DELETE FROM stats_group_categories WHERE category_id = @categoryId").run({ categoryId: e }), t.prepare("DELETE FROM categories WHERE id = @categoryId").run({ categoryId: e });
  })(), e;
}
function C() {
  const e = E().prepare("SELECT * FROM tasks ORDER BY due_date IS NULL, due_date, title").all(), t = E().prepare("SELECT * FROM subtasks ORDER BY title").all();
  return e.map((r) => {
    const c = t.filter((n) => n.task_id === r.id).map((n) => ({
      id: n.id,
      title: n.title,
      completed: n.completed === 1
    }));
    return {
      id: r.id,
      title: r.title,
      notes: r.notes,
      categoryId: r.category_id,
      status: r.status,
      priority: r.priority,
      dueDate: r.due_date ?? void 0,
      plannedTimeBlockId: r.planned_time_block_id ?? void 0,
      subtasks: c.length > 0 ? c : void 0
    };
  });
}
function Te(e) {
  const t = {
    id: A("task"),
    ...e
  }, r = E();
  return r.transaction(() => {
    var n;
    r.prepare(`
        INSERT INTO tasks (
          id, title, notes, category_id, status, priority,
          due_date, planned_time_block_id
        )
        VALUES (
          @id, @title, @notes, @categoryId, @status, @priority,
          @dueDate, @plannedTimeBlockId
        )
      `).run({
      ...t,
      dueDate: t.dueDate ?? null,
      plannedTimeBlockId: t.plannedTimeBlockId ?? null
    }), (n = t.subtasks) == null || n.forEach((i) => {
      r.prepare(
        "INSERT INTO subtasks (id, task_id, title, completed) VALUES (@id, @taskId, @title, @completed)"
      ).run({
        ...i,
        taskId: t.id,
        completed: i.completed ? 1 : 0
      });
    });
  })(), t;
}
function pe(e) {
  const t = E();
  return t.transaction(() => {
    var c;
    t.prepare(`
        UPDATE tasks
        SET title = @title,
            notes = @notes,
            category_id = @categoryId,
            status = @status,
            priority = @priority,
            due_date = @dueDate,
            planned_time_block_id = @plannedTimeBlockId
        WHERE id = @id
      `).run({
      ...e,
      dueDate: e.dueDate ?? null,
      plannedTimeBlockId: e.plannedTimeBlockId ?? null
    }), t.prepare("DELETE FROM subtasks WHERE task_id = @taskId").run({ taskId: e.id }), (c = e.subtasks) == null || c.forEach((n) => {
      t.prepare(
        "INSERT INTO subtasks (id, task_id, title, completed) VALUES (@id, @taskId, @title, @completed)"
      ).run({
        ...n,
        taskId: e.id,
        completed: n.completed ? 1 : 0
      });
    });
  })(), C().find((c) => c.id === e.id) ?? e;
}
function me(e) {
  const t = E();
  return t.transaction(() => {
    t.prepare("UPDATE time_blocks SET task_id = NULL WHERE task_id = @taskId").run({ taskId: e }), t.prepare("DELETE FROM subtasks WHERE task_id = @taskId").run({ taskId: e }), t.prepare("DELETE FROM tasks WHERE id = @taskId").run({ taskId: e });
  })(), e;
}
function _e(e, t) {
  return E().prepare("UPDATE tasks SET status = @status WHERE id = @taskId").run({ taskId: e, status: t }), C().find((r) => r.id === e);
}
function M() {
  return E().prepare("SELECT * FROM time_blocks ORDER BY starts_at").all().map((t) => ({
    id: t.id,
    title: t.title,
    notes: t.notes,
    categoryId: t.category_id,
    taskId: t.task_id ?? void 0,
    startsAt: t.starts_at,
    endsAt: t.ends_at,
    outcome: y(t.outcome, t.status),
    kind: k(t.kind),
    source: f(t.source),
    isAllDay: !!t.is_all_day,
    recurrenceFrequency: t.recurrence_frequency ?? "none",
    recurrenceInterval: t.recurrence_interval ?? 1,
    recurrenceWeekdays: V(t.recurrence_weekdays),
    recurrenceEndMode: z(
      t.recurrence_end_mode,
      t.recurrence_end_date
    ),
    recurrenceEndDate: t.recurrence_end_date ?? void 0,
    recurrenceCount: t.recurrence_count ?? void 0,
    recurrenceExceptions: j(t.recurrence_exceptions)
  }));
}
function O(e) {
  const t = {
    id: e.id ?? A("block"),
    title: e.title,
    notes: e.notes,
    categoryId: e.categoryId,
    taskId: e.taskId,
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    outcome: y(e.outcome),
    kind: k(e.kind),
    source: f(e.source),
    isAllDay: e.isAllDay,
    recurrenceFrequency: e.recurrenceFrequency ?? "none",
    recurrenceInterval: e.recurrenceInterval ?? 1,
    recurrenceWeekdays: e.recurrenceWeekdays,
    recurrenceEndMode: e.recurrenceEndMode ?? (e.recurrenceEndDate ? "on" : "never"),
    recurrenceEndDate: e.recurrenceEndDate,
    recurrenceCount: e.recurrenceCount,
    recurrenceExceptions: e.recurrenceExceptions
  };
  return E().prepare(`
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
    `).run({
    ...t,
    taskId: t.taskId ?? null,
    status: U(t.outcome),
    isAllDay: t.isAllDay ? 1 : 0,
    recurrenceFrequency: t.recurrenceFrequency ?? "none",
    recurrenceInterval: t.recurrenceInterval ?? 1,
    recurrenceWeekdays: h(t.recurrenceWeekdays),
    recurrenceEndMode: t.recurrenceEndMode ?? "never",
    recurrenceEndDate: t.recurrenceEndDate ?? null,
    recurrenceCount: t.recurrenceCount ?? null,
    recurrenceExceptions: S(t.recurrenceExceptions)
  }), t;
}
function I(e) {
  return E().prepare(`
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
    `).run({
    ...e,
    taskId: e.taskId ?? null,
    outcome: y(e.outcome, e.status),
    status: U(y(e.outcome, e.status)),
    kind: k(e.kind),
    source: f(e.source),
    isAllDay: e.isAllDay ? 1 : 0,
    recurrenceFrequency: e.recurrenceFrequency ?? "none",
    recurrenceInterval: e.recurrenceInterval ?? 1,
    recurrenceWeekdays: h(e.recurrenceWeekdays),
    recurrenceEndMode: e.recurrenceEndMode ?? "never",
    recurrenceEndDate: e.recurrenceEndDate ?? null,
    recurrenceCount: e.recurrenceCount ?? null,
    recurrenceExceptions: S(e.recurrenceExceptions)
  }), {
    ...e,
    outcome: y(e.outcome, e.status),
    kind: k(e.kind),
    source: f(e.source)
  };
}
const F = (e, t) => new Date(new Date(e).getTime() + t).toISOString(), B = (e, t, r) => {
  const c = new Date(r.startsAt).getTime() - new Date(t.startsAt).getTime(), n = new Date(r.endsAt).getTime() - new Date(t.endsAt).getTime();
  return {
    ...e,
    title: r.title,
    notes: r.notes,
    categoryId: r.categoryId,
    taskId: r.taskId,
    startsAt: F(e.startsAt, c),
    endsAt: F(e.endsAt, n),
    outcome: r.outcome,
    kind: r.kind,
    source: r.source,
    isAllDay: r.isAllDay,
    recurrenceFrequency: r.recurrenceFrequency ?? e.recurrenceFrequency,
    recurrenceInterval: r.recurrenceInterval ?? e.recurrenceInterval,
    recurrenceWeekdays: r.recurrenceWeekdays ?? e.recurrenceWeekdays,
    recurrenceEndMode: r.recurrenceEndMode ?? e.recurrenceEndMode,
    recurrenceEndDate: r.recurrenceEndDate,
    recurrenceCount: r.recurrenceCount,
    recurrenceExceptions: e.recurrenceExceptions
  };
}, ke = (e) => ({
  ...e,
  id: A("block"),
  recurrenceFrequency: "none",
  recurrenceInterval: void 0,
  recurrenceWeekdays: void 0,
  recurrenceEndMode: "never",
  recurrenceEndDate: void 0,
  recurrenceCount: void 0,
  recurrenceExceptions: void 0,
  recurringTimeBlockId: void 0
}), ge = (e) => ({
  ...e,
  id: A("block"),
  recurringTimeBlockId: void 0,
  recurrenceExceptions: void 0
}), Le = (e, t) => ({
  ...e,
  recurrenceEndMode: "on",
  recurrenceEndDate: new Date(
    new Date(t.startsAt).getTime() - 1e3
  ).toISOString(),
  recurrenceCount: void 0
});
function ye(e) {
  const t = e.occurrence.recurringTimeBlockId ?? e.occurrence.id, r = M().find((i) => i.id === t);
  if (!r)
    throw new Error("Recurring series was not found");
  return e.scope === "all" ? (I(B(r, e.occurrence, e.updatedBlock)), D()) : (E().transaction(() => {
    if (e.scope === "this") {
      I({
        ...r,
        recurrenceExceptions: [
          ...r.recurrenceExceptions ?? [],
          e.occurrence.startsAt
        ]
      }), O(ke(e.updatedBlock));
      return;
    }
    if (new Date(e.occurrence.startsAt).getTime() <= new Date(r.startsAt).getTime()) {
      I(B(r, e.occurrence, e.updatedBlock));
      return;
    }
    I(Le(r, e.occurrence)), O(ge(e.updatedBlock));
  })(), D());
}
function Ae(e) {
  return E().prepare("DELETE FROM time_blocks WHERE id = @timeBlockId").run({ timeBlockId: e }), e;
}
function Ie() {
  m.handle("planner:getSnapshot", () => D()), m.handle(
    "planner:createCategory",
    (e, t) => ue(t)
  ), m.handle(
    "planner:updateCategory",
    (e, t) => le(t)
  ), m.handle(
    "planner:deleteCategory",
    (e, t) => Ee(t)
  ), m.handle(
    "planner:updateStatsGroups",
    (e, t) => de(t)
  ), m.handle(
    "planner:createTask",
    (e, t) => Te(t)
  ), m.handle(
    "planner:updateTask",
    (e, t) => pe(t)
  ), m.handle(
    "planner:deleteTask",
    (e, t) => me(t)
  ), m.handle(
    "planner:updateTaskStatus",
    (e, t, r) => _e(t, r)
  ), m.handle(
    "planner:createTimeBlock",
    (e, t) => O(t)
  ), m.handle(
    "planner:updateTimeBlock",
    (e, t) => I(t)
  ), m.handle(
    "planner:updateRecurringTimeBlock",
    (e, t) => ye(t)
  ), m.handle(
    "planner:deleteTimeBlock",
    (e, t) => Ae(t)
  );
}
const P = _.dirname(x(import.meta.url));
process.env.APP_ROOT = _.join(P, "..");
const v = process.env.VITE_DEV_SERVER_URL, Oe = _.join(process.env.APP_ROOT, "dist-electron"), X = _.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = v ? _.join(process.env.APP_ROOT, "public") : X;
let g;
function W() {
  g = new w({
    icon: _.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: _.join(P, "preload.mjs")
    }
  }), g.webContents.on("did-finish-load", () => {
    g == null || g.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  }), v ? g.loadURL(v) : g.loadFile(_.join(X, "index.html"));
}
N.on("window-all-closed", () => {
  process.platform !== "darwin" && (N.quit(), g = null);
});
N.on("activate", () => {
  w.getAllWindows().length === 0 && W();
});
N.whenReady().then(() => {
  re(), Ie(), W();
});
export {
  Oe as MAIN_DIST,
  X as RENDERER_DIST,
  v as VITE_DEV_SERVER_URL
};
