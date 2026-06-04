import { sectionPlaceholders } from "../data/placeholders";
import { statsHeatmapMetrics } from "../data/stats";
import type {
  CalendarView,
  NavItemId,
  StatsAnalyzeBy,
  StatsBlockKindFilter,
  StatsBlockOutcomeFilter,
  StatsBlockSourceFilter,
  StatsFilters,
  WeekStartDay,
} from "../types/app";
import type { CSSProperties } from "react";
import type {
  Category,
  StatsGroup,
  Task,
  TimeBlock,
  TimeBlockKind,
  TimeBlockOutcome,
} from "../types/domain";
import { useEffect, useMemo, useState } from "react";
import TimeBlockDialog from "./calendar/TimeBlockDialog";
import { getCategoryName } from "../utils/categories";
import { formatDate, formatDateTimeRange } from "../utils/date";
import {
  findTaskCategory,
  formatMinutes,
  formatTaskDueDate,
  isTaskComplete,
} from "../utils/tasks";
import {
  getCurrentPeriodDate,
  getNextPeriodDate,
  getPreviousPeriodDate,
  getStatsRange,
  getTimeBlockMinutes,
} from "../utils/stats";
import {
  formatRecurrenceLabel,
  getCategoryAccentColor,
  getCategoryColorValues,
  getBlocksForDay,
  addCalendarDays,
  addCalendarMonths,
  isAllDayBlock,
  isSameCalendarDay,
  startOfDay,
  startOfWeek,
} from "../utils/calendar";
import { SegmentedControl, ToggleRow } from "./ui/ChoiceControls";
import {
  resolveZonedDateTime,
  toZonedCalendarDate,
} from "../utils/timezone";

type TaskSidebarScope = "week" | "month" | "all";
type TaskSidebarTaskMode = "open" | "completed";

type TaskSidebarGroup = {
  id: string;
  title: string;
  tasks: Task[];
  defaultCollapsed?: boolean;
};

const taskSidebarScopeKey = "planner:taskSidebarScope";
const taskSidebarTaskModeKey = "planner:taskSidebarTaskMode";

const readTaskSidebarScope = (): TaskSidebarScope => {
  try {
    const storedScope = localStorage.getItem(taskSidebarScopeKey);
    return storedScope === "week" ||
      storedScope === "month" ||
      storedScope === "all"
      ? storedScope
      : "week";
  } catch {
    return "week";
  }
};

const readTaskSidebarTaskMode = (): TaskSidebarTaskMode => {
  try {
    const storedMode = localStorage.getItem(taskSidebarTaskModeKey);
    return storedMode === "completed" ? "completed" : "open";
  } catch {
    return "open";
  }
};

const taskSidebarScopeOptions: Array<{
  value: TaskSidebarScope;
  label: string;
}> = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "all", label: "All" },
];

const taskSidebarTaskModeOptions: Array<{
  value: TaskSidebarTaskMode;
  label: string;
}> = [
  { value: "open", label: "Tasks" },
  { value: "completed", label: "Completed tasks" },
];

const taskSidebarProgressCenter = 60;
const taskSidebarProgressOuterRadius = 52;
const taskSidebarProgressRadiusStep = 8;
const taskSidebarProgressMinRadius = 16;
const taskSidebarProgressFallbackRadius = 46;

const shortDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const monthRangeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});

const formatSidebarWeekRange = (start: Date, end: Date) =>
  `${shortDateFormatter.format(start)} - ${formatDate(end)}`;

const getTaskDueDate = (task: Task) =>
  task.dueDate ? startOfDay(new Date(task.dueDate)) : undefined;

const isTaskCanceled = (task: Task) => task.status === "canceled";

const orderTasksByDueDate = (tasks: Task[]) =>
  [...tasks].sort((firstTask, secondTask) => {
    const firstDue = getTaskDueDate(firstTask)?.getTime() ?? Number.POSITIVE_INFINITY;
    const secondDue =
      getTaskDueDate(secondTask)?.getTime() ?? Number.POSITIVE_INFINITY;
    return firstDue - secondDue || firstTask.title.localeCompare(secondTask.title);
  });

const orderCompletedTasksByDueDate = (tasks: Task[]) =>
  [...tasks].sort((firstTask, secondTask) => {
    const firstDue = getTaskDueDate(firstTask)?.getTime() ?? Number.NEGATIVE_INFINITY;
    const secondDue =
      getTaskDueDate(secondTask)?.getTime() ?? Number.NEGATIVE_INFINITY;
    return secondDue - firstDue || firstTask.title.localeCompare(secondTask.title);
  });

type InspectorPanelProps = {
  activeItem: NavItemId;
  activeView: CalendarView;
  categories: Category[];
  statsGroups: StatsGroup[];
  compactTaskList: boolean;
  weekStartDay: WeekStartDay;
  onSelectBlock: (blockId?: string, additive?: boolean) => void;
  onSelectTask: (taskId: string) => void;
  onToggleTask: (taskId: string) => void | Promise<void>;
  onUpdateTask: (task: Task) => void | Promise<void>;
  onDeleteTask: (taskId: string) => void | Promise<void>;
  onUpdateCategory: (category: Category) => void | Promise<void>;
  onUpdateStatsGroups: (groups: StatsGroup[]) => void | Promise<void>;
  selectedBlockId?: string;
  selectedBlockIds: string[];
  selectedDate?: Date;
  selectedStatsDate: Date;
  selectedTaskId?: string;
  statsFilters: StatsFilters;
  tasks: Task[];
  timeBlocks: TimeBlock[];
  showHiddenCalendarCategories: boolean;
  onUpdateTimeBlock: (timeBlock: TimeBlock) => void | Promise<void>;
  onDeleteTimeBlock: (timeBlockId: string) => void | Promise<void>;
  onToggleHiddenCalendarCategories: (showHidden: boolean) => void;
  onSelectStatsDate: (date: Date) => void;
  onUpdateStatsFilters: (filters: StatsFilters) => void;
  timeZone: string;
  timeZones: string[];
};

const toDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toTimeInputValue = (date: Date) => {
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${hours}:${minutes}`;
};

const toAllDayEndInputValue = (date: Date) => {
  const inclusiveEndDate = new Date(date);
  inclusiveEndDate.setDate(inclusiveEndDate.getDate() - 1);
  return toDateInputValue(inclusiveEndDate);
};

const createStatsGroupId = () =>
  `stats-group-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const blockKindOptions: Array<{ value: TimeBlockKind; label: string }> = [
  { value: "event", label: "Event" },
  { value: "task-session", label: "Task" },
  { value: "habit", label: "Habit" },
  { value: "routine", label: "Routine" },
];

const taskStatusOptions: Array<{ value: Task["status"]; label: string }> = [
  { value: "todo", label: "Todo" },
  { value: "in-progress", label: "In progress" },
  { value: "blocked", label: "Blocked" },
  { value: "done", label: "Done" },
  { value: "canceled", label: "Canceled" },
];

const taskPriorityOptions: Array<{ value: Task["priority"]; label: string }> = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

const blockOutcomeOptions: Array<{ value: TimeBlockOutcome; label: string }> = [
  { value: "active", label: "Normal" },
  { value: "abandoned", label: "Abandoned" },
];

const statsBlockKindOptions: Array<{
  value: StatsBlockKindFilter;
  label: string;
}> = [{ value: "all", label: "All kinds" }, ...blockKindOptions];

const statsAnalyzeByOptions: Array<{ value: StatsAnalyzeBy; label: string }> = [
  { value: "category", label: "Category" },
  { value: "kind", label: "Kind" },
  { value: "outcome", label: "Outcome" },
  { value: "source", label: "Source" },
];

const statsBlockOutcomeOptions: Array<{
  value: StatsBlockOutcomeFilter;
  label: string;
}> = [{ value: "all", label: "All outcomes" }, ...blockOutcomeOptions];

const statsBlockSourceOptions: Array<{
  value: StatsBlockSourceFilter;
  label: string;
}> = [
  { value: "all", label: "All sources" },
  { value: "manual", label: "Manual" },
  { value: "pomodoro", label: "Pomodoro" },
  { value: "timer", label: "Timer" },
  { value: "generated", label: "Generated" },
  { value: "imported", label: "Imported" },
];

const sourceLabels: Record<TimeBlock["source"], string> = {
  manual: "Manual",
  pomodoro: "Pomodoro",
  timer: "Timer",
  generated: "Generated",
  imported: "Imported",
};

const blockKindHelperText: Partial<Record<TimeBlockKind, string>> = {
  habit: "Repeatable practice and consistency.",
  routine: "Regular life patterns like sleep and meals.",
};

function InspectorPanel({
  activeItem,
  activeView,
  categories,
  statsGroups,
  compactTaskList,
  weekStartDay,
  onSelectBlock,
  onSelectTask,
  onToggleTask,
  onUpdateTask,
  onDeleteTask,
  onUpdateCategory,
  onUpdateStatsGroups,
  selectedBlockId,
  selectedBlockIds,
  selectedDate,
  selectedTaskId,
  statsFilters,
  tasks,
  timeBlocks,
  showHiddenCalendarCategories,
  onUpdateTimeBlock,
  onDeleteTimeBlock,
  onToggleHiddenCalendarCategories,
  onSelectStatsDate,
  onUpdateStatsFilters,
  timeZone,
  timeZones,
}: InspectorPanelProps) {
  const [isEditingBlock, setIsEditingBlock] = useState(false);
  const [blockTitle, setBlockTitle] = useState("");
  const [blockNotes, setBlockNotes] = useState("");
  const [blockStartDate, setBlockStartDate] = useState("");
  const [blockEndDate, setBlockEndDate] = useState("");
  const [blockStartTime, setBlockStartTime] = useState("");
  const [blockEndTime, setBlockEndTime] = useState("");
  const [blockDateTimeWarning, setBlockDateTimeWarning] = useState<string>();
  const [taskTitle, setTaskTitle] = useState("");
  const [taskNotes, setTaskNotes] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [statsGroupDrafts, setStatsGroupDrafts] = useState<StatsGroup[]>([]);
  const [isStatsGroupsDialogOpen, setIsStatsGroupsDialogOpen] = useState(false);
  const [collapsedTaskGroups, setCollapsedTaskGroups] = useState<
    Record<string, boolean>
  >({});
  const [taskCategoryFilter, setTaskCategoryFilter] = useState("all");
  const [taskSidebarTaskMode, setTaskSidebarTaskMode] =
    useState<TaskSidebarTaskMode>(readTaskSidebarTaskMode);
  const [taskSidebarScope, setTaskSidebarScope] =
    useState<TaskSidebarScope>(readTaskSidebarScope);
  const [taskSidebarDate, setTaskSidebarDate] = useState(() => new Date());
  const section = sectionPlaceholders[activeItem];
  const hiddenCalendarCategories = categories.filter(
    (category) => category.hiddenFromCalendar,
  );
  const visibleRoutineCategories = categories.filter(
    (category) =>
      category.defaultBlockKind === "routine" && !category.hiddenFromCalendar,
  );
  const selectedBlock = timeBlocks.find(
    (block) => block.id === selectedBlockId,
  );
  const selectedBlocks = selectedBlockIds
    .map((blockId) => timeBlocks.find((block) => block.id === blockId))
    .filter((block): block is TimeBlock => Boolean(block));
  const selectedBlockIsRecurring =
    selectedBlock &&
    (selectedBlock.recurringTimeBlockId ||
      selectedBlock.recurrenceFrequency !== "none");
  const linkedTask = selectedBlock?.taskId
    ? tasks.find((task) => task.id === selectedBlock.taskId)
    : undefined;
  const selectedTask = tasks.find((task) => task.id === selectedTaskId);
  const selectedDateBlocks = selectedDate
    ? getBlocksForDay(timeBlocks, selectedDate, timeZone)
    : [];
  const selectedDateTasks = selectedDate
    ? tasks.filter(
        (task) =>
          task.dueDate && isSameCalendarDay(new Date(task.dueDate), selectedDate),
      )
    : [];
  const selectedDateMinutes = selectedDateBlocks.reduce(
    (total, block) => total + getTimeBlockMinutes(block),
    0,
  );
  const upcomingBlocks = timeBlocks
    .filter((block) => new Date(block.endsAt).getTime() >= Date.now())
    .sort(
      (firstBlock, secondBlock) =>
        new Date(firstBlock.startsAt).getTime() -
        new Date(secondBlock.startsAt).getTime(),
    )
    .slice(0, 3);
  const filteredSidebarTasks = useMemo(
    () =>
      tasks.filter(
        (task) =>
          !isTaskCanceled(task) &&
          (taskCategoryFilter === "all" ||
            task.categoryId === taskCategoryFilter),
      ),
    [taskCategoryFilter, tasks],
  );
  const taskSidebarRange = useMemo(() => {
    if (taskSidebarScope === "all") {
      return undefined;
    }

    if (taskSidebarScope === "month") {
      const start = startOfDay(
        new Date(taskSidebarDate.getFullYear(), taskSidebarDate.getMonth(), 1),
      );
      const end = startOfDay(
        new Date(taskSidebarDate.getFullYear(), taskSidebarDate.getMonth() + 1, 0),
      );
      return { start, end };
    }

    const start = startOfWeek(taskSidebarDate, weekStartDay);
    return { start, end: addCalendarDays(start, 6) };
  }, [taskSidebarDate, taskSidebarScope, weekStartDay]);
  const today = startOfDay(new Date());
  const visibleSidebarTasks = useMemo(() => {
    if (taskSidebarScope === "all" || !taskSidebarRange) {
      return filteredSidebarTasks;
    }

    return filteredSidebarTasks.filter((task) => {
      const dueDate = getTaskDueDate(task);
      if (!dueDate) {
        return false;
      }

      const isInRange =
        dueDate >= taskSidebarRange.start && dueDate <= taskSidebarRange.end;
      const isOverdueOpen = dueDate < today && !isTaskComplete(task);
      return isInRange || isOverdueOpen;
    });
  }, [filteredSidebarTasks, taskSidebarRange, taskSidebarScope, today]);
  const openTaskDueGroups = useMemo<TaskSidebarGroup[]>(() => {
    const openVisibleTasks = visibleSidebarTasks.filter(
      (task) => !isTaskComplete(task),
    );
    const overdueTasks = orderTasksByDueDate(
      openVisibleTasks.filter((task) => {
        const dueDate = getTaskDueDate(task);
        return dueDate ? dueDate < today : false;
      }),
    );

    if (taskSidebarScope === "all") {
      return [
        {
          id: "open-overdue",
          title: "Overdue",
          tasks: overdueTasks,
        },
        {
          id: "open-upcoming",
          title: "Upcoming",
          tasks: orderTasksByDueDate(
            openVisibleTasks.filter((task) => {
              const dueDate = getTaskDueDate(task);
              return dueDate ? dueDate >= today : false;
            }),
          ),
        },
        {
          id: "open-none",
          title: "No Due Date",
          tasks: orderTasksByDueDate(
            openVisibleTasks.filter((task) => !getTaskDueDate(task)),
          ),
        },
      ];
    }

    if (!taskSidebarRange) {
      return [];
    }

    if (taskSidebarScope === "month") {
      const groups: TaskSidebarGroup[] = [
        { id: "open-overdue", title: "Overdue", tasks: overdueTasks },
      ];
      let cursor = startOfWeek(taskSidebarRange.start, weekStartDay);
      let index = 1;
      while (cursor <= taskSidebarRange.end) {
        const weekStart = new Date(cursor);
        const weekEnd = addCalendarDays(weekStart, 6);
        const clampedStart =
          weekStart < taskSidebarRange.start ? taskSidebarRange.start : weekStart;
        const clampedEnd =
          weekEnd > taskSidebarRange.end ? taskSidebarRange.end : weekEnd;
        groups.push({
          id: `open-month-week-${index}`,
          title: `Week ${index}: ${shortDateFormatter.format(clampedStart)} - ${shortDateFormatter.format(clampedEnd)}`,
          tasks: orderTasksByDueDate(
            openVisibleTasks.filter((task) => {
              const dueDate = getTaskDueDate(task);
              if (!dueDate) {
                return false;
              }

              return (
                dueDate >= clampedStart &&
                dueDate <= clampedEnd
              );
            }),
          ),
        });
        cursor = addCalendarDays(cursor, 7);
        index += 1;
      }
      return groups;
    }

    return [
      { id: "open-overdue", title: "Overdue", tasks: overdueTasks },
      {
        id: "open-today",
        title: "Due Today",
        tasks: orderTasksByDueDate(
          openVisibleTasks.filter((task) => {
            const dueDate = getTaskDueDate(task);
            return dueDate ? dueDate.getTime() === today.getTime() : false;
          }),
        ),
      },
      {
        id: "open-tomorrow",
        title: "Due Tomorrow",
        tasks: orderTasksByDueDate(
          openVisibleTasks.filter((task) => {
            const dueDate = getTaskDueDate(task);
            const tomorrow = addCalendarDays(today, 1);
            return dueDate ? dueDate.getTime() === tomorrow.getTime() : false;
          }),
        ),
      },
      {
        id: "open-week",
        title: "Due This Week",
        tasks: orderTasksByDueDate(
          openVisibleTasks.filter((task) => {
            const dueDate = getTaskDueDate(task);
            if (!dueDate) {
              return false;
            }
            const tomorrow = addCalendarDays(today, 1);
            return (
              dueDate >= taskSidebarRange.start &&
              dueDate <= taskSidebarRange.end &&
              dueDate.getTime() !== today.getTime() &&
              dueDate.getTime() !== tomorrow.getTime()
            );
          }),
        ),
      },
    ];
  }, [
    taskSidebarRange,
    taskSidebarScope,
    today,
    visibleSidebarTasks,
    weekStartDay,
  ]);
  const completedTaskDueGroups = useMemo<TaskSidebarGroup[]>(() => {
    const completedVisibleTasks = visibleSidebarTasks.filter(isTaskComplete);

    if (taskSidebarScope === "all" || !taskSidebarRange) {
      return [
        {
          id: "completed-all",
          title: "Completed",
          tasks: orderCompletedTasksByDueDate(completedVisibleTasks),
        },
      ];
    }

    if (taskSidebarScope === "month") {
      const groups: TaskSidebarGroup[] = [];
      let cursor = startOfWeek(taskSidebarRange.start, weekStartDay);
      let index = 1;
      while (cursor <= taskSidebarRange.end) {
        const weekStart = new Date(cursor);
        const weekEnd = addCalendarDays(weekStart, 6);
        const clampedStart =
          weekStart < taskSidebarRange.start ? taskSidebarRange.start : weekStart;
        const clampedEnd =
          weekEnd > taskSidebarRange.end ? taskSidebarRange.end : weekEnd;

        groups.push({
          id: `completed-month-week-${index}`,
          title: `Week ${index}: ${shortDateFormatter.format(clampedStart)} - ${shortDateFormatter.format(clampedEnd)}`,
          tasks: orderCompletedTasksByDueDate(
            completedVisibleTasks.filter((task) => {
              const dueDate = getTaskDueDate(task);
              return dueDate ? dueDate >= clampedStart && dueDate <= clampedEnd : false;
            }),
          ),
        });
        cursor = addCalendarDays(cursor, 7);
        index += 1;
      }
      return groups;
    }

    return Array.from({ length: 7 }, (_, dayIndex) => {
      const day = addCalendarDays(taskSidebarRange.start, dayIndex);
      return {
        id: `completed-day-${toDateInputValue(day)}`,
        title: shortDateFormatter.format(day),
        tasks: orderCompletedTasksByDueDate(
          completedVisibleTasks.filter((task) => {
            const dueDate = getTaskDueDate(task);
            return dueDate ? dueDate.getTime() === day.getTime() : false;
          }),
        ),
      };
    });
  }, [
    taskSidebarRange,
    taskSidebarScope,
    visibleSidebarTasks,
    weekStartDay,
  ]);
  const taskSidebarGroups =
    taskSidebarTaskMode === "completed"
      ? completedTaskDueGroups
      : openTaskDueGroups;
  const visibleTaskSidebarGroups = taskSidebarGroups.filter(
    (group) => group.tasks.length > 0,
  );
  const taskSidebarEmptyMessage =
    taskSidebarTaskMode === "completed"
      ? "No completed tasks in this range."
      : "No open tasks in this range.";
  const categoryProgressRings = useMemo(
    () =>
      categories
        .map((category) => {
          const categoryTasks = visibleSidebarTasks.filter(
            (task) => task.categoryId === category.id,
          );
          const completedTasks = categoryTasks.filter(isTaskComplete).length;
          return {
            category,
            completedTasks,
            totalTasks: categoryTasks.length,
          };
        })
        .filter((ring) => ring.totalTasks > 0),
    [categories, visibleSidebarTasks],
  );
  const completedTaskCount = visibleSidebarTasks.filter(isTaskComplete).length;
  const taskSidebarRangeLabel =
    taskSidebarScope === "all" || !taskSidebarRange
      ? "All tasks"
      : taskSidebarScope === "month"
        ? monthRangeFormatter.format(taskSidebarRange.start)
        : formatSidebarWeekRange(taskSidebarRange.start, taskSidebarRange.end);
  const assignedStatsCategoryIds = new Set(
    statsGroupDrafts.flatMap((group) => group.categoryIds),
  );
  const updateStatsFilter = <Key extends keyof StatsFilters>(
    key: Key,
    value: StatsFilters[Key],
  ) => {
    onUpdateStatsFilters({ ...statsFilters, [key]: value });
  };
  const statsPeriodDate = new Date(statsFilters.selectedDateIso);
  const statsRange = getStatsRange(
    statsFilters.range,
    statsPeriodDate,
    weekStartDay,
  );
  const updateStatsPeriodDate = (date: Date) => {
    onSelectStatsDate(date);
    onUpdateStatsFilters({
      ...statsFilters,
      selectedDateIso: date.toISOString(),
    });
  };
  const updateTaskSidebarScope = (scope: TaskSidebarScope) => {
    setTaskSidebarScope(scope);
    try {
      localStorage.setItem(taskSidebarScopeKey, scope);
    } catch {
      // Sidebar preference writes are best-effort.
    }
  };
  const updateTaskSidebarTaskMode = (mode: TaskSidebarTaskMode) => {
    setTaskSidebarTaskMode(mode);
    try {
      localStorage.setItem(taskSidebarTaskModeKey, mode);
    } catch {
      // Sidebar preference writes are best-effort.
    }
  };
  const shiftTaskSidebarRange = (step: number) => {
    setTaskSidebarDate((currentDate) =>
      taskSidebarScope === "month"
        ? addCalendarMonths(currentDate, step)
        : addCalendarDays(currentDate, step * 7),
    );
  };
  const resetTaskSidebarRange = () => setTaskSidebarDate(new Date());
  const toggleTaskGroup = (groupId: string) => {
    setCollapsedTaskGroups((currentGroups) => ({
      ...currentGroups,
      [groupId]: !currentGroups[groupId],
    }));
  };
  const updateSelectedBlock = (input: Partial<TimeBlock>) => {
    if (selectedBlock) {
      void onUpdateTimeBlock({ ...selectedBlock, ...input });
    }
  };
  const updateSelectedBlocks = (input: Partial<TimeBlock>) => {
    selectedBlocks.forEach((block) => {
      void onUpdateTimeBlock({ ...block, ...input });
    });
  };
  const getSharedBlockValue = <Key extends keyof TimeBlock>(key: Key) => {
    if (selectedBlocks.length === 0) {
      return "";
    }

    const firstValue = selectedBlocks[0][key];
    return selectedBlocks.every((block) => block[key] === firstValue)
      ? firstValue
      : "";
  };
  const updateSelectedTask = (input: Partial<Task>) => {
    if (selectedTask) {
      void onUpdateTask({ ...selectedTask, ...input });
    }
  };
  const updateStatsGroupDraft = (
    groupId: string,
    input: Partial<StatsGroup>,
  ) => {
    setStatsGroupDrafts((currentGroups) =>
      currentGroups.map((group) =>
        group.id === groupId ? { ...group, ...input } : group,
      ),
    );
  };
  const addStatsGroupDraft = () => {
    setStatsGroupDrafts((currentGroups) => [
      ...currentGroups,
      {
        id: createStatsGroupId(),
        name: "New group",
        color: "#22d3ee",
        sortOrder: currentGroups.length,
        countsTowardProductiveTime: true,
        categoryIds: [],
      },
    ]);
  };
  const deleteStatsGroupDraft = (groupId: string) => {
    setStatsGroupDrafts((currentGroups) =>
      currentGroups
        .filter((group) => group.id !== groupId)
        .map((group, index) => ({ ...group, sortOrder: index })),
    );
  };
  const assignCategoryToStatsGroup = (categoryId: string, groupId: string) => {
    setStatsGroupDrafts((currentGroups) =>
      currentGroups.map((group) => ({
        ...group,
        categoryIds:
          group.id === groupId
            ? [...new Set([...group.categoryIds, categoryId])]
            : group.categoryIds.filter((currentId) => currentId !== categoryId),
      })),
    );
  };
  const saveStatsGroupDrafts = () => {
    void onUpdateStatsGroups(
      statsGroupDrafts.map((group, index) => ({
        ...group,
        name: group.name.trim() || "Untitled group",
        sortOrder: index,
        countsTowardProductiveTime: group.countsTowardProductiveTime,
        categoryIds: [...new Set(group.categoryIds)],
      })),
    );
    setIsStatsGroupsDialogOpen(false);
  };
  const cancelStatsGroupDrafts = () => {
    setStatsGroupDrafts(
      statsGroups.map((group) => ({
        ...group,
        categoryIds: [...group.categoryIds],
      })),
    );
    setIsStatsGroupsDialogOpen(false);
  };
  const commitBlockTitle = () => {
    const nextTitle = blockTitle.trim();
    if (!selectedBlock) {
      return;
    }
    if (!nextTitle) {
      setBlockTitle(selectedBlock.title);
      return;
    }
    if (nextTitle !== selectedBlock.title) {
      updateSelectedBlock({ title: nextTitle });
    }
  };
  const commitBlockNotes = () => {
    if (selectedBlock && blockNotes !== selectedBlock.notes) {
      updateSelectedBlock({ notes: blockNotes });
    }
  };
  const commitBlockDateTime = (
    nextValues: Partial<{
      endDate: string;
      endTime: string;
      isAllDay: boolean;
      startDate: string;
      startTime: string;
    }>,
  ) => {
    if (!selectedBlock) {
      return;
    }

    const nextIsAllDay = nextValues.isAllDay ?? Boolean(selectedBlock.isAllDay);
    const nextStartDate = nextValues.startDate ?? blockStartDate;
    const nextEndDate = nextValues.endDate ?? blockEndDate;
    const nextStartTime = nextValues.startTime ?? blockStartTime;
    const nextEndTime = nextValues.endTime ?? blockEndTime;
    const normalizedEndDate =
      nextEndDate < nextStartDate ? nextStartDate : nextEndDate;
    const endDate = nextIsAllDay
      ? toDateInputValue(addCalendarDays(new Date(`${normalizedEndDate}T00:00:00`), 1))
      : normalizedEndDate;
    const startsAt = resolveZonedDateTime(
      nextStartDate,
      nextIsAllDay ? "00:00" : nextStartTime,
      timeZone,
    );
    const endsAt = resolveZonedDateTime(
      endDate,
      nextIsAllDay ? "00:00" : nextEndTime,
      timeZone,
    );

    if (startsAt.status !== "valid" || endsAt.status !== "valid") {
      setBlockDateTimeWarning(
        "This wall time is invalid or ambiguous because of a DST transition. Use Advanced Edit to choose an exact occurrence.",
      );
      return;
    }
    if (endsAt.date <= startsAt.date) {
      endsAt.date.setTime(startsAt.date.getTime() + 15 * 60000);
    }
    setBlockDateTimeWarning(undefined);

    updateSelectedBlock({
      isAllDay: nextIsAllDay,
      startsAt: startsAt.date.toISOString(),
      endsAt: endsAt.date.toISOString(),
      timeZone,
    });
  };
  const commitTaskTitle = () => {
    const nextTitle = taskTitle.trim();
    if (!selectedTask) {
      return;
    }
    if (!nextTitle) {
      setTaskTitle(selectedTask.title);
      return;
    }
    if (nextTitle !== selectedTask.title) {
      updateSelectedTask({ title: nextTitle });
    }
  };
  const commitTaskNotes = () => {
    if (selectedTask && taskNotes !== selectedTask.notes) {
      updateSelectedTask({ notes: taskNotes });
    }
  };
  const hideRoutineCategories = () => {
    visibleRoutineCategories.forEach((category) => {
      void onUpdateCategory({ ...category, hiddenFromCalendar: true });
    });
  };
  useEffect(() => {
    if (!selectedBlock) {
      return;
    }

    const startsAt = toZonedCalendarDate(selectedBlock.startsAt, timeZone);
    const endsAt = toZonedCalendarDate(selectedBlock.endsAt, timeZone);
    setBlockTitle(selectedBlock.title);
    setBlockNotes(selectedBlock.notes);
    setBlockStartDate(toDateInputValue(startsAt));
    setBlockEndDate(
      isAllDayBlock(selectedBlock)
        ? toAllDayEndInputValue(endsAt)
        : toDateInputValue(endsAt),
    );
    setBlockStartTime(toTimeInputValue(startsAt));
    setBlockEndTime(toTimeInputValue(endsAt));
  }, [selectedBlock, timeZone]);

  useEffect(() => {
    if (!selectedTask) {
      return;
    }

    setTaskTitle(selectedTask.title);
    setTaskNotes(selectedTask.notes);
    setTaskDueDate(selectedTask.dueDate ? selectedTask.dueDate.slice(0, 10) : "");
  }, [selectedTask]);

  useEffect(() => {
    setStatsGroupDrafts(
      statsGroups.map((group) => ({
        ...group,
        categoryIds: [...group.categoryIds],
      })),
    );
  }, [statsGroups]);

  return (
    <aside className="inspector" aria-label="Inspector panel">
      <div className="inspector-header">
        <div className="panel-kicker">Inspector</div>
        <h2>{section.title}</h2>
      </div>

      {activeItem === "tasks" ? (
        <div
          className={`inspector-section task-sidebar-workflow${
            compactTaskList ? " compact" : ""
          }`}
        >
          <div className="section-title">Due list</div>
          <div className="range-switcher compact" aria-label="Task due scope">
            {taskSidebarScopeOptions.map((option) => (
              <button
                className={taskSidebarScope === option.value ? "active" : ""}
                key={option.value}
                onClick={() => updateTaskSidebarScope(option.value)}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="task-sidebar-range-nav">
            <button
              className="icon-button"
              disabled={taskSidebarScope === "all"}
              onClick={() => shiftTaskSidebarRange(-1)}
              type="button"
            >
              Prev
            </button>
            <div>
              <strong>{taskSidebarRangeLabel}</strong>
            </div>
            <button
              className="icon-button"
              disabled={taskSidebarScope === "all"}
              onClick={() => shiftTaskSidebarRange(1)}
              type="button"
            >
              Next
            </button>
          </div>
          {taskSidebarScope !== "all" ? (
            <button
              className="toolbar-button task-sidebar-current-button"
              onClick={resetTaskSidebarRange}
              type="button"
            >
              Current {taskSidebarScope}
            </button>
          ) : null}
          <div className="task-sidebar-summary">
            <svg
              aria-hidden="true"
              className="task-sidebar-progress"
              viewBox="0 0 120 120"
            >
              {categoryProgressRings.length > 0 ? (
                categoryProgressRings.map((ring, index) => {
                  const radius = Math.max(
                    taskSidebarProgressMinRadius,
                    taskSidebarProgressOuterRadius -
                      index * taskSidebarProgressRadiusStep,
                  );
                  const circumference = 2 * Math.PI * radius;
                  const progress = ring.completedTasks / ring.totalTasks;

                  return (
                    <g key={ring.category.id}>
                      <circle
                        className="task-sidebar-progress-track"
                        cx={taskSidebarProgressCenter}
                        cy={taskSidebarProgressCenter}
                        r={radius}
                      />
                      <circle
                        className="task-sidebar-progress-ring"
                        cx={taskSidebarProgressCenter}
                        cy={taskSidebarProgressCenter}
                        r={radius}
                        stroke={getCategoryAccentColor(ring.category.color)}
                        strokeDasharray={`${circumference} ${circumference}`}
                        strokeDashoffset={circumference * (1 - progress)}
                        strokeLinecap="butt"
                      />
                    </g>
                  );
                })
              ) : (
                <circle
                  className="task-sidebar-progress-track"
                  cx={taskSidebarProgressCenter}
                  cy={taskSidebarProgressCenter}
                  r={taskSidebarProgressFallbackRadius}
                />
              )}
            </svg>
            <div>
              <strong>
                {completedTaskCount}/{visibleSidebarTasks.length}
              </strong>
              <span>completed</span>
            </div>
          </div>

          <div
            className="range-switcher compact task-sidebar-mode-switcher"
            aria-label="Task list mode"
          >
            {taskSidebarTaskModeOptions.map((option) => (
              <button
                className={taskSidebarTaskMode === option.value ? "active" : ""}
                key={option.value}
                onClick={() => updateTaskSidebarTaskMode(option.value)}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="task-sidebar-controls">
            <label>
              <span>Category</span>
              <select
                onChange={(event) => setTaskCategoryFilter(event.target.value)}
                value={taskCategoryFilter}
              >
                <option value="all">All categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="todo-groups inspector-todo-groups">
            {visibleTaskSidebarGroups.length > 0 ? (
              visibleTaskSidebarGroups.map((group) => (
                <section className="todo-group" key={group.id}>
                  <button
                    className="todo-group-header"
                    onClick={() => toggleTaskGroup(group.id)}
                    type="button"
                  >
                    <span
                      className={`collapse-indicator${
                        (collapsedTaskGroups[group.id] ??
                        group.defaultCollapsed ??
                        false)
                          ? " collapsed"
                          : ""
                      }`}
                    >
                      v
                    </span>
                    <span>{group.title}</span>
                    <span className="count-badge">{group.tasks.length}</span>
                  </button>
                  {!(collapsedTaskGroups[group.id] ?? group.defaultCollapsed ?? false) ? (
                    <div className="todo-card-list">
                      {group.tasks.length > 0 ? (
                        group.tasks.map((task) => {
                          const category = findTaskCategory(
                            categories,
                            task.categoryId,
                          );
                          const colors = getCategoryColorValues(category?.color);
                          const categoryName = category?.name ?? "Uncategorized";

                          return (
                            <div
                              className={`inspector-task-row${
                                selectedTaskId === task.id ? " selected" : ""
                              }${isTaskComplete(task) ? " complete" : ""}`}
                              key={task.id}
                              style={
                                {
                                  "--task-accent": colors.accent,
                                  "--task-background": colors.background,
                                  "--task-border": colors.border,
                                } as CSSProperties
                              }
                            >
                              <button
                                aria-label={`Mark ${task.title} ${
                                  isTaskComplete(task)
                                    ? "incomplete"
                                    : "complete"
                                }`}
                                className={`completion-circle${
                                  isTaskComplete(task) ? " complete" : ""
                                }`}
                                onClick={() => void onToggleTask(task.id)}
                                type="button"
                              />
                              <button
                                className="inspector-task-row-body"
                                onClick={() => onSelectTask(task.id)}
                                type="button"
                              >
                                <strong>{task.title}</strong>
                                <small className="inspector-task-meta">
                                  <span>{categoryName}</span>
                                  <span>{formatTaskDueDate(task)}</span>
                                  <span className={`priority-pill priority-${task.priority}`}>
                                    {task.priority}
                                  </span>
                                  <span>{task.status}</span>
                                </small>
                              </button>
                            </div>
                          );
                        })
                      ) : null}
                    </div>
                  ) : null}
                </section>
              ))
            ) : (
              <div className="todo-empty">{taskSidebarEmptyMessage}</div>
            )}
          </div>
        </div>
      ) : activeItem === "stats" ? (
        <div className="inspector-section stats-sidebar-controls">
          <div className="section-title">Stats Controls</div>

          <div className="stats-control-group">
            <div className="mini-label">Period</div>
            <div className="range-switcher compact" aria-label="Stats period">
              {(["week", "month", "year"] as const).map((range) => (
                <button
                  className={statsFilters.range === range ? "active" : ""}
                  key={range}
                  onClick={() => updateStatsFilter("range", range)}
                  type="button"
                >
                  {range}
                </button>
              ))}
            </div>
          </div>

          <div className="stats-control-group">
            <div className="mini-label">Current range</div>
            <div className="stats-range-label">{statsRange.label}</div>
            <div className="stats-nav-grid">
              <button
                className="toolbar-button"
                onClick={() =>
                  updateStatsPeriodDate(
                    getPreviousPeriodDate(statsFilters.range, statsPeriodDate),
                  )
                }
                type="button"
              >
                Previous
              </button>
              <button
                className="toolbar-button"
                onClick={() =>
                  updateStatsPeriodDate(
                    getNextPeriodDate(statsFilters.range, statsPeriodDate),
                  )
                }
                type="button"
              >
                Next
              </button>
            </div>
            <button
              className="toolbar-button"
              onClick={() => updateStatsPeriodDate(getCurrentPeriodDate(timeZone))}
              type="button"
            >
              Current Period
            </button>
          </div>

          <div className="stats-control-group">
            <ToggleRow
              checked={statsFilters.showAllTrackedTime}
              label="Tracked metric"
              onChange={(checked) => updateStatsFilter("showAllTrackedTime", checked)}
            />
            <div className="detail-meta">
              {statsFilters.showAllTrackedTime
                ? "Productive charts are showing tracked time."
                : "Productive charts exclude non-productive groups."}
            </div>
          </div>

          <div className="stats-control-group">
            <div className="mini-label">Configuration</div>
            <button
              className="toolbar-button"
              onClick={() => setIsStatsGroupsDialogOpen(true)}
              type="button"
            >
              Customize stats
            </button>
          </div>
        </div>
      ) : activeItem === "calendar" && selectedBlocks.length > 1 ? (
        <div className="inspector-section">
          <div className="section-title">Selected blocks</div>
          <div className="detail-card inspector-edit-card">
            <div className="multi-select-summary">
              <strong>{selectedBlocks.length} blocks selected</strong>
              <span>Shift-click blocks to add or remove them.</span>
            </div>
            <div className="inspector-field-grid">
              <div className="inspector-field">
                <span>Outcome</span>
                <div className="action-button-group">
                  <button
                    className="toolbar-button"
                    onClick={() => updateSelectedBlocks({ outcome: "abandoned" })}
                    type="button"
                  >
                    Mark abandoned
                  </button>
                  <button
                    className="toolbar-button"
                    onClick={() => updateSelectedBlocks({ outcome: "active" })}
                    type="button"
                  >
                    Restore
                  </button>
                </div>
              </div>
              <div className="inspector-field">
                <span>Kind</span>
                <SegmentedControl
                  ariaLabel="Bulk time block kind"
                  compact
                  onChange={(kind) => updateSelectedBlocks({ kind })}
                  options={blockKindOptions}
                  value={(getSharedBlockValue("kind") as TimeBlockKind) || ""}
                />
              </div>
            </div>
            <label className="inspector-field">
              <span>Category</span>
              <select
                onChange={(event) =>
                  updateSelectedBlocks({ categoryId: event.target.value })
                }
                value={(getSharedBlockValue("categoryId") as string) || ""}
              >
                <option disabled value="">
                  Mixed
                </option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="info-row compact">
              <span>Time fields</span>
              <strong>Open one block to edit dates and times.</strong>
            </div>
            <div className="detail-actions">
              <button
                className="toolbar-button"
                onClick={() => onSelectBlock(undefined)}
                type="button"
              >
                Clear Selection
              </button>
              <button
                className="toolbar-button danger-action"
                onClick={() =>
                  selectedBlocks.forEach((block) => onDeleteTimeBlock(block.id))
                }
                type="button"
              >
                Delete Selected
              </button>
            </div>
          </div>
        </div>
      ) : activeItem === "calendar" && selectedBlock ? (
        <div className="inspector-section">
          <div className="section-title">
            {isAllDayBlock(selectedBlock) ? "Selected all-day event" : "Selected block"}
          </div>
          <div className="detail-card inspector-edit-card">
            <label className="inspector-field">
              <span>Title</span>
              <input
                onBlur={commitBlockTitle}
                onChange={(event) => setBlockTitle(event.target.value)}
                value={blockTitle}
              />
            </label>
            <div className="inspector-field-grid">
              <div className="inspector-field">
                <span>Outcome</span>
                <div className="outcome-action-row">
                  <strong>
                    {selectedBlock.outcome === "abandoned"
                      ? "Abandoned"
                      : "Normal"}
                  </strong>
                  <button
                    className="toolbar-button"
                    onClick={() =>
                      updateSelectedBlock({
                        outcome:
                          selectedBlock.outcome === "abandoned"
                            ? "active"
                            : "abandoned",
                      })
                    }
                    type="button"
                  >
                    {selectedBlock.outcome === "abandoned"
                      ? "Restore"
                      : "Abandon"}
                  </button>
                </div>
              </div>
              <div className="inspector-field">
                <span>Kind</span>
                <SegmentedControl
                  ariaLabel="Time block kind"
                  compact
                  onChange={(kind) => updateSelectedBlock({ kind })}
                  options={blockKindOptions}
                  value={selectedBlock.kind}
                />
                {blockKindHelperText[selectedBlock.kind] ? (
                  <small className="field-helper-text">
                    {blockKindHelperText[selectedBlock.kind]}
                  </small>
                ) : null}
              </div>
            </div>
            <label className="inspector-field">
              <span>Category</span>
              <select
                onChange={(event) =>
                  updateSelectedBlock({ categoryId: event.target.value })
                }
                value={selectedBlock.categoryId}
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="checkbox-row inspector-checkbox-row">
              <input
                checked={Boolean(selectedBlock.isAllDay)}
                onChange={(event) =>
                  commitBlockDateTime({ isAllDay: event.target.checked })
                }
                type="checkbox"
              />
              <span>All-day event</span>
            </label>
            <div className="inspector-field-grid">
              <label className="inspector-field">
                <span>Start date</span>
                <input
                  onChange={(event) => {
                    setBlockStartDate(event.target.value);
                    commitBlockDateTime({ startDate: event.target.value });
                  }}
                  type="date"
                  value={blockStartDate}
                />
              </label>
              <label className="inspector-field">
                <span>End date</span>
                <input
                  onChange={(event) => {
                    setBlockEndDate(event.target.value);
                    commitBlockDateTime({ endDate: event.target.value });
                  }}
                  type="date"
                  value={blockEndDate}
                />
              </label>
            </div>
            {!isAllDayBlock(selectedBlock) ? (
              <div className="inspector-field-grid">
                <label className="inspector-field">
                  <span>Start time</span>
                  <input
                    onChange={(event) => {
                      setBlockStartTime(event.target.value);
                      commitBlockDateTime({ startTime: event.target.value });
                    }}
                    step={15 * 60}
                    type="time"
                    value={blockStartTime}
                  />
                </label>
                <label className="inspector-field">
                  <span>End time</span>
                  <input
                    onChange={(event) => {
                      setBlockEndTime(event.target.value);
                      commitBlockDateTime({ endTime: event.target.value });
                    }}
                    step={15 * 60}
                    type="time"
                    value={blockEndTime}
                  />
                </label>
              </div>
            ) : null}
            {blockDateTimeWarning ? (
              <small className="field-helper-text">{blockDateTimeWarning}</small>
            ) : null}
            <div className="info-row compact">
              <span>Repeats</span>
              <strong>{formatRecurrenceLabel(selectedBlock, timeZone)}</strong>
            </div>
            <label className="inspector-field">
              <span>Linked task</span>
              <select
                onChange={(event) =>
                  updateSelectedBlock({ taskId: event.target.value || undefined })
                }
                value={selectedBlock.taskId ?? ""}
              >
                <option value="">No linked task</option>
                {tasks
                  .filter((task) => !isTaskComplete(task) || task.id === selectedBlock.taskId)
                  .map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.title}
                    </option>
                  ))}
              </select>
            </label>
            {linkedTask ? (
              <div className="info-row compact">
                <span>Task status</span>
                <strong>{linkedTask.status}</strong>
              </div>
            ) : null}
            <div className="info-row compact">
              <span>Source</span>
              <strong>{sourceLabels[selectedBlock.source]}</strong>
            </div>
            <label className="inspector-field">
              <span>Notes</span>
              <textarea
                onBlur={commitBlockNotes}
                onChange={(event) => setBlockNotes(event.target.value)}
                rows={4}
                value={blockNotes}
              />
            </label>
            <div className="detail-actions">
              <button
                className="toolbar-button"
                onClick={() => setIsEditingBlock(true)}
                type="button"
              >
                Advanced Edit
              </button>
              <button
                className="toolbar-button danger-action"
                onClick={() => onDeleteTimeBlock(selectedBlock.id)}
                type="button"
              >
                {selectedBlockIsRecurring ? "Delete Series" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : activeItem === "calendar" && selectedTask ? (
        <div className="inspector-section">
          <div className="section-title">Selected task</div>
          <div className="detail-card inspector-edit-card">
            <label className="inspector-field">
              <span>Title</span>
              <input
                onBlur={commitTaskTitle}
                onChange={(event) => setTaskTitle(event.target.value)}
                value={taskTitle}
              />
            </label>
            <div className="inspector-field-grid">
              <div className="inspector-field">
                <span>Status</span>
                <SegmentedControl
                  ariaLabel="Task status"
                  compact
                  onChange={(status) => updateSelectedTask({ status })}
                  options={taskStatusOptions}
                  value={selectedTask.status}
                />
              </div>
              <div className="inspector-field">
                <span>Priority</span>
                <SegmentedControl
                  ariaLabel="Task priority"
                  compact
                  onChange={(priority) => updateSelectedTask({ priority })}
                  options={taskPriorityOptions}
                  value={selectedTask.priority}
                />
              </div>
            </div>
            <label className="inspector-field">
              <span>Due date</span>
              <input
                onChange={(event) => {
                  setTaskDueDate(event.target.value);
                  updateSelectedTask({
                    dueDate: event.target.value
                      ? new Date(`${event.target.value}T00:00:00`).toISOString()
                      : undefined,
                  });
                }}
                type="date"
                value={taskDueDate}
              />
            </label>
            <label className="inspector-field">
              <span>Category</span>
              <select
                onChange={(event) =>
                  updateSelectedTask({ categoryId: event.target.value })
                }
                value={selectedTask.categoryId}
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="inspector-field">
              <span>Notes</span>
              <textarea
                onBlur={commitTaskNotes}
                onChange={(event) => setTaskNotes(event.target.value)}
                rows={4}
                value={taskNotes}
              />
            </label>
            <div className="detail-actions">
              <button
                className="toolbar-button"
                onClick={() => void onToggleTask(selectedTask.id)}
                type="button"
              >
                {isTaskComplete(selectedTask) ? "Mark Undone" : "Mark Done"}
              </button>
              <button
                className="toolbar-button danger-action"
                onClick={() => onDeleteTask(selectedTask.id)}
                type="button"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : activeItem === "calendar" && activeView === "month" ? (
        <div className="inspector-section">
          <div className="section-title">Selected day</div>
          {selectedDate ? (
            <div className="detail-card">
              <h3>{formatDate(selectedDate)}</h3>
              <div className="info-row compact">
                <span>Planned</span>
                <strong>{formatMinutes(selectedDateMinutes)}</strong>
              </div>
              <div className="info-row compact">
                <span>Blocks</span>
                <strong>{selectedDateBlocks.length}</strong>
              </div>
              <div className="info-row compact">
                <span>Due tasks</span>
                <strong>{selectedDateTasks.length}</strong>
              </div>
              <div className="selected-day-list">
                {selectedDateBlocks.map((block) => (
                  <button
                    className="mini-block"
                    key={block.id}
                    onClick={() => onSelectBlock(block.id)}
                    type="button"
                  >
                    <span>{block.title}</span>
                    <small>
                      {isAllDayBlock(block)
                        ? "All day"
                        : formatDateTimeRange(block.startsAt, block.endsAt, timeZone)}
                    </small>
                  </button>
                ))}
                {selectedDateTasks.map((task) => (
                  <button
                    className="mini-block"
                    key={task.id}
                    onClick={() => onSelectTask(task.id)}
                    type="button"
                  >
                    <span>{task.title}</span>
                    <small>{isTaskComplete(task) ? "Complete" : "Open"}</small>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="empty-state">Select a day to inspect it.</div>
          )}
        </div>
      ) : (
        <div className="inspector-section">
          <div className="section-title">Selected block</div>
          {selectedBlock ? (
          <div className="detail-card">
            <h3>{selectedBlock.title}</h3>
            <div className="detail-meta">
              {isAllDayBlock(selectedBlock)
                ? "All day"
                : formatDateTimeRange(selectedBlock.startsAt, selectedBlock.endsAt, timeZone)}
            </div>
            <p>{selectedBlock.notes}</p>
            <div className="info-row compact">
              <span>Category</span>
              <strong>
                {getCategoryName(categories, selectedBlock.categoryId)}
              </strong>
            </div>
            {linkedTask ? (
              <div className="info-row compact">
                <span>Linked task</span>
                <strong>{linkedTask.title}</strong>
              </div>
            ) : null}
            <div className="info-row compact">
              <span>Repeats</span>
              <strong>{formatRecurrenceLabel(selectedBlock, timeZone)}</strong>
            </div>
            <div className="detail-actions">
              <button
                className="toolbar-button"
                onClick={() => setIsEditingBlock(true)}
                type="button"
              >
                Edit Block
              </button>
              <button
                className="toolbar-button danger-action"
                onClick={() => onDeleteTimeBlock(selectedBlock.id)}
                type="button"
              >
                {selectedBlockIsRecurring ? "Delete Series" : "Delete"}
              </button>
            </div>
          </div>
          ) : (
            <div className="empty-state">Select a time block to inspect it.</div>
          )}
        </div>
      )}

      {activeItem === "calendar" ? (
        <>
          <div className="inspector-section">
            <div className="section-title">Category visibility</div>
            <div className="detail-card calendar-visibility-card">
              <ToggleRow
                checked={showHiddenCalendarCategories}
                disabled={hiddenCalendarCategories.length === 0}
                label="Show hidden categories"
                onChange={onToggleHiddenCalendarCategories}
              />
              <div className="detail-meta">
                {hiddenCalendarCategories.length > 0
                  ? `${hiddenCalendarCategories.length} hidden categories`
                  : "No hidden categories"}
              </div>
              <button
                className="toolbar-button"
                disabled={visibleRoutineCategories.length === 0}
                onClick={hideRoutineCategories}
                type="button"
              >
                Hide routine categories
              </button>
            </div>
          </div>
          <div className="inspector-section">
            <div className="section-title">
              Upcoming blocks
            </div>
            <div className="mini-list">
              {upcomingBlocks.map((block) => (
                <button
                  className={`mini-block${
                    selectedBlockId === block.id ? " selected" : ""
                  }`}
                  key={block.id}
                  onClick={() => onSelectBlock(block.id)}
                  type="button"
                >
                  <span>{block.title}</span>
                  <small>
                    {isAllDayBlock(block)
                      ? "All day"
                      : formatDateTimeRange(block.startsAt, block.endsAt, timeZone)}
                  </small>
                </button>
              ))}
            </div>
          </div>
        </>
      ) : null}

      {isStatsGroupsDialogOpen ? (
        <div className="dialog-backdrop">
          <div className="fake-dialog stats-groups-dialog">
            <div className="fake-dialog-header">
              <div>
                <div className="panel-kicker">Stats</div>
                <h2>Customize stats</h2>
              </div>
              <button
                className="toolbar-button"
                onClick={cancelStatsGroupDrafts}
                type="button"
              >
                Close
              </button>
            </div>

            <div className="stats-groups-dialog-body">
              <div className="stats-advanced-panel">
                <div>
                  <div className="mini-label">Advanced filters</div>
                  <div className="detail-meta">
                    Defaults are tuned for the dashboard. Use these only for
                    focused audits.
                  </div>
                </div>
                <div className="stats-advanced-grid">
                  <label>
                    <span>Category</span>
                    <select
                      onChange={(event) =>
                        updateStatsFilter("categoryId", event.target.value)
                      }
                      value={statsFilters.categoryId}
                    >
                      <option value="all">All categories</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Analyze by</span>
                    <SegmentedControl
                      ariaLabel="Analyze stats by"
                      compact
                      onChange={(analyzeBy) =>
                        updateStatsFilter("analyzeBy", analyzeBy)
                      }
                      options={statsAnalyzeByOptions}
                      value={statsFilters.analyzeBy}
                    />
                  </label>
                  <label>
                    <span>Block kind</span>
                    <SegmentedControl
                      ariaLabel="Stats block kind filter"
                      compact
                      onChange={(blockKind) =>
                        updateStatsFilter("blockKind", blockKind)
                      }
                      options={statsBlockKindOptions}
                      value={statsFilters.blockKind}
                    />
                  </label>
                  <label>
                    <span>Block outcome</span>
                    <SegmentedControl
                      ariaLabel="Stats block outcome filter"
                      compact
                      onChange={(blockOutcome) =>
                        updateStatsFilter("blockOutcome", blockOutcome)
                      }
                      options={statsBlockOutcomeOptions}
                      value={statsFilters.blockOutcome}
                    />
                  </label>
                  <label>
                    <span>Block source</span>
                    <SegmentedControl
                      ariaLabel="Stats block source filter"
                      compact
                      onChange={(blockSource) =>
                        updateStatsFilter("blockSource", blockSource)
                      }
                      options={statsBlockSourceOptions}
                      value={statsFilters.blockSource}
                    />
                  </label>
                  <div className="stats-advanced-toggle-list">
                    <ToggleRow
                      checked={statsFilters.includeCompletedTasks}
                      label="Include completed tasks"
                      onChange={(checked) =>
                        updateStatsFilter("includeCompletedTasks", checked)
                      }
                    />
                    <ToggleRow
                      checked={statsFilters.includeAllDayBlocks}
                      label="Include all-day blocks"
                      onChange={(checked) =>
                        updateStatsFilter("includeAllDayBlocks", checked)
                      }
                    />
                    <ToggleRow
                      checked={statsFilters.includeUncategorized}
                      label="Include uncategorized items"
                      onChange={(checked) =>
                        updateStatsFilter("includeUncategorized", checked)
                      }
                    />
                    <ToggleRow
                      checked={statsFilters.includeStatsExcludedCategories}
                      label="Include categories excluded from stats"
                      onChange={(checked) =>
                        updateStatsFilter(
                          "includeStatsExcludedCategories",
                          checked,
                        )
                      }
                    />
                    <ToggleRow
                      checked={statsFilters.showAllTrackedTime}
                      label="Show tracked time in productive charts"
                      onChange={(checked) =>
                        updateStatsFilter("showAllTrackedTime", checked)
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="stats-advanced-panel">
                <div>
                  <div className="mini-label">Year heatmap metric</div>
                  <div className="detail-meta">
                    Applies only when Stats is in Year mode.
                  </div>
                </div>
                <div className="stats-metric-list" aria-label="Heatmap metric">
                  {statsHeatmapMetrics.map((metric) => (
                    <button
                      className={
                        statsFilters.heatmapMetric === metric.id ? "active" : ""
                      }
                      key={metric.id}
                      onClick={() => updateStatsFilter("heatmapMetric", metric.id)}
                      type="button"
                    >
                      {metric.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="stats-advanced-panel">
                <div>
                  <div className="mini-label">Actions</div>
                </div>
                <div className="stats-nav-grid">
                  <button
                    className="toolbar-button"
                    onClick={() =>
                      updateStatsFilter("refreshKey", statsFilters.refreshKey + 1)
                    }
                    type="button"
                  >
                    Refresh
                  </button>
                  <button className="toolbar-button" disabled type="button">
                    Export CSV
                  </button>
                </div>
              </div>

              <div className="stats-group-editor-header">
                <div>
                  <div className="mini-label">Groups</div>
                  <div className="detail-meta">
                    Productive groups count toward productive time. Other tracked
                    groups still appear in distribution charts.
                  </div>
                </div>
                <button
                  className="toolbar-button"
                  onClick={addStatsGroupDraft}
                  type="button"
                >
                  Add Group
                </button>
              </div>

              <div className="stats-group-editor-list">
                {statsGroupDrafts.map((group) => (
                  <div className="stats-group-editor-row" key={group.id}>
                    <input
                      aria-label={`${group.name} name`}
                      onChange={(event) =>
                        updateStatsGroupDraft(group.id, {
                          name: event.target.value,
                        })
                      }
                      value={group.name}
                    />
                    <input
                      aria-label={`${group.name} color`}
                      onChange={(event) =>
                        updateStatsGroupDraft(group.id, {
                          color: event.target.value,
                        })
                      }
                      type="color"
                      value={
                        /^#[0-9a-f]{6}$/i.test(group.color)
                          ? group.color
                          : "#22d3ee"
                      }
                    />
                    <button
                      className={`stats-group-productivity-pill${
                        group.countsTowardProductiveTime ? " productive" : ""
                      }`}
                      onClick={() =>
                        updateStatsGroupDraft(group.id, {
                          countsTowardProductiveTime:
                            !group.countsTowardProductiveTime,
                        })
                      }
                      type="button"
                    >
                      {group.countsTowardProductiveTime
                        ? "Productive"
                        : "Tracked only"}
                    </button>
                    <button
                      className="toolbar-button danger-action"
                      onClick={() => deleteStatsGroupDraft(group.id)}
                      type="button"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>

              <div className="stats-group-assignment-panel">
                <div>
                  <div className="mini-label">Category assignments</div>
                  <div className="detail-meta">
                    {assignedStatsCategoryIds.size}/{categories.length} assigned.
                    Unassigned categories appear in Other.
                  </div>
                </div>
                <div className="stats-group-assignment-list">
                  {categories.map((category) => {
                    const assignedGroup = statsGroupDrafts.find((group) =>
                      group.categoryIds.includes(category.id),
                    );
                    return (
                      <label
                        className="stats-group-assignment-row"
                        key={category.id}
                      >
                        <span>{category.name}</span>
                        <select
                          onChange={(event) =>
                            assignCategoryToStatsGroup(
                              category.id,
                              event.target.value,
                            )
                          }
                          value={assignedGroup?.id ?? ""}
                        >
                          <option value="">Other</option>
                          {statsGroupDrafts.map((group) => (
                            <option key={group.id} value={group.id}>
                              {group.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="fake-dialog-actions">
              <button
                className="toolbar-button"
                onClick={cancelStatsGroupDrafts}
                type="button"
              >
                Cancel
              </button>
              <button
                className="toolbar-button primary-action"
                onClick={saveStatsGroupDrafts}
                type="button"
              >
                Save Groups
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isEditingBlock && selectedBlock ? (
        <TimeBlockDialog
          block={selectedBlock}
          categories={categories}
          onClose={() => setIsEditingBlock(false)}
          onSave={(input) => onUpdateTimeBlock(input as TimeBlock)}
          primaryTimeZone={timeZone}
          tasks={tasks}
          timeZones={timeZones}
        />
      ) : null}
    </aside>
  );
}

export default InspectorPanel;
