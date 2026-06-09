import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import "./App.css";
import CommandPalette from "./components/CommandPalette";
import InspectorPanel from "./components/InspectorPanel";
import MainPanel from "./components/MainPanel";
import ResizeHandle from "./components/ResizeHandle";
import Sidebar from "./components/Sidebar";
import TopToolbar from "./components/TopToolbar";
import type { Category, StatsGroup, Task, TimeBlock } from "./types/domain";
import type {
  AppSettings,
  CalendarView,
  NavItemId,
  StatsFilters,
} from "./types/app";
import {
  addCalendarDays,
  expandRecurringTimeBlocks,
  formatCalendarTitle,
  getTimeBlockSeriesId,
} from "./utils/calendar";
import { getNextPeriodDate, getPreviousPeriodDate } from "./utils/stats";
import type {
  CreateCategoryInput,
  CreateTaskInput,
  CreateTimeBlockInput,
  RecurringUpdateScope,
} from "./types/plannerApi";
import { useResizablePanels } from "./hooks/useResizablePanels";
import { CalendarTimeZoneProvider } from "./components/TimeZoneContext";
import {
  normalizeCalendarTimeZones,
  systemTimeZone,
  toZonedCalendarDate,
} from "./utils/timezone";

const defaultSettings: AppSettings = {
  weekStartDay: "monday",
  visibleStartHour: 6,
  visibleEndHour: 22,
  compactTodo: false,
  calendarTimeZones: [systemTimeZone],
  primaryCalendarTimeZone: systemTimeZone,
};

const readSettings = () => {
  try {
    const storedSettings = localStorage.getItem("planner-settings");
    const nextSettings = storedSettings
      ? { ...defaultSettings, ...JSON.parse(storedSettings) }
      : defaultSettings;
    return {
      ...nextSettings,
      ...normalizeCalendarTimeZones(
        nextSettings.calendarTimeZones,
        nextSettings.primaryCalendarTimeZone,
      ),
    };
  } catch {
    return defaultSettings;
  }
};

const isTypingTarget = (target: EventTarget | null) =>
  target instanceof HTMLInputElement ||
  target instanceof HTMLTextAreaElement ||
  target instanceof HTMLSelectElement;

const calendarShortcutViews: CalendarView[] = ["week", "month"];
const categoryOrderKey = "planner:categoryOrder";

type PendingRecurringUpdate = {
  occurrence: TimeBlock;
  updatedBlock: TimeBlock;
};

type PendingRecurringDelete = {
  occurrence: TimeBlock;
};

type RecurringDeleteScope = "this" | "future" | "all";

const getExpansionRange = (date: Date) => {
  const start = new Date(date.getFullYear(), 0, 1);
  const end = new Date(date.getFullYear(), 11, 31, 23, 59, 59);
  return {
    start: addCalendarDays(start, -31),
    end: addCalendarDays(end, 31),
  };
};

const readCategoryOrderIds = () => {
  try {
    const storedOrder = localStorage.getItem(categoryOrderKey);
    if (!storedOrder) {
      return [];
    }

    const parsedOrder = JSON.parse(storedOrder);
    return Array.isArray(parsedOrder)
      ? parsedOrder.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
};

const writeCategoryOrderIds = (categoryIds: string[]) => {
  try {
    localStorage.setItem(categoryOrderKey, JSON.stringify(categoryIds));
  } catch {
    // Category ordering is a local UI preference.
  }
};

const orderCategoriesByStoredOrder = (categories: Category[]) => {
  const orderIds = readCategoryOrderIds();
  if (orderIds.length === 0) {
    return categories;
  }

  const categoryById = new Map(
    categories.map((category) => [category.id, category]),
  );
  const orderedCategories = orderIds
    .map((categoryId) => categoryById.get(categoryId))
    .filter((category): category is Category => Boolean(category));
  const orderedCategoryIds = new Set(orderedCategories.map((category) => category.id));
  const newCategories = categories.filter(
    (category) => !orderedCategoryIds.has(category.id),
  );

  return [...orderedCategories, ...newCategories];
};

function App() {
  const [activeItem, setActiveItem] = useState<NavItemId>("calendar");
  const [activeView, setActiveView] = useState<CalendarView>("week");
  const [currentDate, setCurrentDate] = useState(() =>
    toZonedCalendarDate(new Date(), defaultSettings.primaryCalendarTimeZone),
  );
  const [categories, setCategories] = useState<Category[]>([]);
  const [statsGroups, setStatsGroups] = useState<StatsGroup[]>([]);
  const [selectedCalendarCategoryId, setSelectedCalendarCategoryId] =
    useState<string>();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState<string | undefined>();
  const [selectedBlockIds, setSelectedBlockIds] = useState<string[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | undefined>();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    () => toZonedCalendarDate(new Date(), defaultSettings.primaryCalendarTimeZone),
  );
  const [selectedStatsDate, setSelectedStatsDate] = useState(() =>
    toZonedCalendarDate(new Date(), defaultSettings.primaryCalendarTimeZone),
  );
  const [settings, setSettings] = useState<AppSettings>(() => readSettings());
  const [showHiddenCalendarCategories, setShowHiddenCalendarCategories] =
    useState(false);
  const [statsFilters, setStatsFilters] = useState<StatsFilters>(() => ({
    analyzeBy: "category",
    categoryId: "all",
    blockKind: "all",
    blockOutcome: "all",
    blockSource: "all",
    heatmapMetric: "productive_hours",
    range: "month",
    selectedDateIso: new Date().toISOString(),
    timeMode: "active",
    includeCompletedTasks: true,
    includeAllDayBlocks: true,
    includeUncategorized: true,
    includeStatsExcludedCategories: false,
    showAllTrackedTime: false,
    refreshKey: 0,
  }));
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | undefined>();
  const [pendingRecurringUpdate, setPendingRecurringUpdate] =
    useState<PendingRecurringUpdate>();
  const [pendingRecurringDelete, setPendingRecurringDelete] =
    useState<PendingRecurringDelete>();
  const {
    activeResizeSide,
    constraints: resizeConstraints,
    leftWidth,
    resetWidth,
    rightWidth,
    startResize,
  } = useResizablePanels();
  const appStyle = {
    "--left-sidebar-width": `${leftWidth}px`,
    "--right-sidebar-width": `${rightWidth}px`,
  } as CSSProperties;
  const dateTitle = useMemo(
    () => formatCalendarTitle(currentDate, activeView),
    [activeView, currentDate],
  );
  const visibleTimeBlocks = useMemo(() => {
    const statsDate = new Date(statsFilters.selectedDateIso);
    const range = getExpansionRange(
      new Date(
        Math.min(currentDate.getFullYear(), statsDate.getFullYear()),
        0,
        1,
      ),
    );
    const endRange = getExpansionRange(
      new Date(
        Math.max(currentDate.getFullYear(), statsDate.getFullYear()),
        11,
        31,
      ),
    );
    return expandRecurringTimeBlocks(timeBlocks, range.start, endRange.end);
  }, [currentDate, statsFilters.selectedDateIso, timeBlocks]);
  const calendarTimeBlocks = useMemo(() => {
    if (showHiddenCalendarCategories) {
      return visibleTimeBlocks;
    }

    const visibleCategoryIds = new Set(
      categories
        .filter((category) => !category.hiddenFromCalendar)
        .map((category) => category.id),
    );
    return visibleTimeBlocks.filter((block) =>
      visibleCategoryIds.has(block.categoryId),
    );
  }, [categories, showHiddenCalendarCategories, visibleTimeBlocks]);

  useEffect(() => {
    if (categories.length === 0) {
      setSelectedCalendarCategoryId(undefined);
      setStatsFilters((currentFilters) => ({
        ...currentFilters,
        categoryId: "all",
      }));
      return;
    }

    if (
      !selectedCalendarCategoryId ||
      !categories.some((category) => category.id === selectedCalendarCategoryId)
    ) {
      setSelectedCalendarCategoryId(categories[0].id);
    }

    if (
      statsFilters.categoryId !== "all" &&
      !categories.some((category) => category.id === statsFilters.categoryId)
    ) {
      setStatsFilters((currentFilters) => ({
        ...currentFilters,
        categoryId: "all",
      }));
    }
  }, [categories, selectedCalendarCategoryId, statsFilters.categoryId]);

  const handleToday = () => {
    setCurrentDate(
      toZonedCalendarDate(new Date(), settings.primaryCalendarTimeZone),
    );
    setActiveItem("calendar");
  };

  const handlePrevious = () => {
    const step = activeView === "week" ? -7 : -30;
    setCurrentDate((date) => addCalendarDays(date, step));
  };

  const handleNext = () => {
    const step = activeView === "week" ? 7 : 30;
    setCurrentDate((date) => addCalendarDays(date, step));
  };

  const handleShiftCalendarDays = (days: number) => {
    setCurrentDate((date) => addCalendarDays(date, days));
  };

  const handleShiftStatsPeriod = (direction: -1 | 1) => {
    setStatsFilters((currentFilters) => {
      const currentStatsDate = new Date(currentFilters.selectedDateIso);
      const nextStatsDate =
        direction < 0
          ? getPreviousPeriodDate(currentFilters.range, currentStatsDate)
          : getNextPeriodDate(currentFilters.range, currentStatsDate);
      setSelectedStatsDate(nextStatsDate);
      return {
        ...currentFilters,
        selectedDateIso: nextStatsDate.toISOString(),
      };
    });
  };

  const handleCurrentStatsPeriod = () => {
    const currentPeriodDate = toZonedCalendarDate(
      new Date(),
      settings.primaryCalendarTimeZone,
    );
    setSelectedStatsDate(currentPeriodDate);
    setStatsFilters((currentFilters) => ({
      ...currentFilters,
      selectedDateIso: currentPeriodDate.toISOString(),
    }));
  };

  const handleSelectStatsRange = (range: StatsFilters["range"]) => {
    setStatsFilters((currentFilters) => ({
      ...currentFilters,
      range,
    }));
  };

  const handleSelectTask = (taskId: string) => {
    setSelectedTaskId(taskId);
    setSelectedBlockId(undefined);
    setSelectedBlockIds([]);
  };

  const handleSelectBlock = (blockId?: string, additive = false) => {
    if (!blockId) {
      setSelectedBlockId(undefined);
      setSelectedBlockIds([]);
      return;
    }

    if (additive) {
      setSelectedBlockIds((currentIds) => {
        const nextIds = currentIds.includes(blockId)
          ? currentIds.filter((currentId) => currentId !== blockId)
          : [...currentIds, blockId];
        setSelectedBlockId(nextIds.at(-1));
        return nextIds;
      });
    } else {
      setSelectedBlockId(blockId);
      setSelectedBlockIds([blockId]);
    }

    setSelectedTaskId(undefined);
  };

  const handleUpdateSettings = (nextSettings: AppSettings) => {
    const normalizedTimeZones = normalizeCalendarTimeZones(
      nextSettings.calendarTimeZones,
      nextSettings.primaryCalendarTimeZone,
    );
    const normalizedSettings = {
      ...nextSettings,
      ...normalizedTimeZones,
      visibleStartHour: Math.min(
        nextSettings.visibleStartHour,
        nextSettings.visibleEndHour - 1,
      ),
      visibleEndHour: Math.max(
        nextSettings.visibleEndHour,
        nextSettings.visibleStartHour + 1,
      ),
    };
    setSettings(normalizedSettings);
    localStorage.setItem("planner-settings", JSON.stringify(normalizedSettings));
  };

  useEffect(() => {
    window.plannerAPI
      .getSnapshot()
      .then((snapshot) => {
        setCategories(orderCategoriesByStoredOrder(snapshot.categories));
        setStatsGroups(snapshot.statsGroups);
        setTasks(snapshot.tasks);
        setTimeBlocks(snapshot.timeBlocks);
        setSelectedTaskId(snapshot.tasks[0]?.id);
        setSelectedBlockId(snapshot.timeBlocks[0]?.id);
        setSelectedBlockIds(
          snapshot.timeBlocks[0]?.id ? [snapshot.timeBlocks[0].id] : [],
        );
      })
      .catch((error: unknown) => {
        setLoadError(
          error instanceof Error ? error.message : "Failed to load planner data",
        );
      })
      .finally(() => setIsLoading(false));
  }, []);

  const handleToggleTask = async (taskId: string) => {
    const currentTask = tasks.find((task) => task.id === taskId);
    if (!currentTask) {
      return;
    }

    const nextStatus = currentTask.status === "done" ? "todo" : "done";
    const updatedTask = await window.plannerAPI.updateTaskStatus(
      taskId,
      nextStatus,
    );
    if (updatedTask) {
      setTasks((currentTasks) =>
        currentTasks.map((task) => (task.id === taskId ? updatedTask : task)),
      );
    }
  };

  const handleCreateTask = async (input: CreateTaskInput) => {
    const task = await window.plannerAPI.createTask(input);
    setTasks((currentTasks) => [...currentTasks, task]);
    setSelectedTaskId(task.id);
  };

  const handleUpdateTask = async (input: Task) => {
    const task = await window.plannerAPI.updateTask(input);
    setTasks((currentTasks) =>
      currentTasks.map((currentTask) =>
        currentTask.id === task.id ? task : currentTask,
      ),
    );
    setSelectedTaskId((currentTaskId) =>
      currentTaskId === task.id ? task.id : currentTaskId,
    );
  };

  const handleDeleteTask = async (taskId: string) => {
    await window.plannerAPI.deleteTask(taskId);
    setTasks((currentTasks) => {
      const nextTasks = currentTasks.filter((task) => task.id !== taskId);
      setSelectedTaskId(nextTasks[0]?.id);
      return nextTasks;
    });
    setTimeBlocks((currentBlocks) =>
      currentBlocks.map((block) =>
        block.taskId === taskId ? { ...block, taskId: undefined } : block,
      ),
    );
  };

  const handleCreateCategory = async (input: CreateCategoryInput) => {
    const category = await window.plannerAPI.createCategory(input);
    setCategories((currentCategories) => {
      const nextCategories = [...currentCategories, category];
      writeCategoryOrderIds(nextCategories.map((currentCategory) => currentCategory.id));
      return nextCategories;
    });
  };

  const handleUpdateCategory = async (input: Category) => {
    const category = await window.plannerAPI.updateCategory(input);
    setCategories((currentCategories) =>
      currentCategories.map((currentCategory) =>
        currentCategory.id === category.id ? category : currentCategory,
      ),
    );
  };

  const handleDeleteCategory = async (categoryId: string) => {
    await window.plannerAPI.deleteCategory(categoryId);
    const snapshot = await window.plannerAPI.getSnapshot();
    setTasks(snapshot.tasks);
    setTimeBlocks(snapshot.timeBlocks);
    setCategories((currentCategories) => {
      const nextCategories = currentCategories.filter(
        (category) => category.id !== categoryId,
      );
      writeCategoryOrderIds(nextCategories.map((category) => category.id));
      return nextCategories;
    });
    setStatsGroups(snapshot.statsGroups);
  };

  const handleReorderCategory = (
    categoryId: string,
    targetCategoryId: string,
    placement: "before" | "after",
  ) => {
    if (categoryId === targetCategoryId) {
      return;
    }

    setCategories((currentCategories) => {
      const currentIndex = currentCategories.findIndex(
        (category) => category.id === categoryId,
      );
      const targetIndex = currentCategories.findIndex(
        (category) => category.id === targetCategoryId,
      );
      if (currentIndex < 0 || targetIndex < 0) {
        return currentCategories;
      }

      const nextCategories = [...currentCategories];
      const [movedCategory] = nextCategories.splice(currentIndex, 1);
      const adjustedTargetIndex =
        currentIndex < targetIndex ? targetIndex - 1 : targetIndex;
      const nextIndex =
        placement === "after" ? adjustedTargetIndex + 1 : adjustedTargetIndex;
      nextCategories.splice(nextIndex, 0, movedCategory);
      writeCategoryOrderIds(nextCategories.map((category) => category.id));
      return nextCategories;
    });
  };

  const handleUpdateStatsGroups = async (groups: StatsGroup[]) => {
    const updatedGroups = await window.plannerAPI.updateStatsGroups(groups);
    setStatsGroups(updatedGroups);
  };

  const handleCreateTimeBlock = async (timeBlock: CreateTimeBlockInput) => {
    const createdBlock = await window.plannerAPI.createTimeBlock(timeBlock);
    setTimeBlocks((currentBlocks) => [...currentBlocks, createdBlock]);
    setSelectedBlockId(createdBlock.id);
    setSelectedBlockIds([createdBlock.id]);
  };

  const handleUpdateTimeBlock = async (timeBlock: TimeBlock) => {
    const seriesId = getTimeBlockSeriesId(timeBlock);
    const currentBlock = visibleTimeBlocks.find(
      (block) => block.id === timeBlock.id,
    );
    const seriesBlock = timeBlocks.find((block) => block.id === seriesId);
    const isRecurringUpdate =
      Boolean(timeBlock.recurringTimeBlockId) ||
      seriesBlock?.recurrenceFrequency !== "none";

    if (isRecurringUpdate && currentBlock) {
      const isAbandoningSingleOccurrence =
        currentBlock.outcome !== "abandoned" &&
        timeBlock.outcome === "abandoned";

      if (isAbandoningSingleOccurrence) {
        const snapshot = await window.plannerAPI.updateRecurringTimeBlock({
          occurrence: currentBlock,
          updatedBlock: timeBlock,
          scope: "this",
        });
        setCategories(orderCategoriesByStoredOrder(snapshot.categories));
        setStatsGroups(snapshot.statsGroups);
        setTasks(snapshot.tasks);
        setTimeBlocks(snapshot.timeBlocks);
        setSelectedBlockId(undefined);
        setSelectedBlockIds([]);
        return;
      }

      setPendingRecurringUpdate({
        occurrence: currentBlock,
        updatedBlock: timeBlock,
      });
      return;
    }

    const updatedBlock = await window.plannerAPI.updateTimeBlock(timeBlock);
    setTimeBlocks((currentBlocks) =>
      currentBlocks.map((currentBlock) =>
        currentBlock.id === updatedBlock.id ? updatedBlock : currentBlock,
      ),
    );
    setSelectedBlockId(updatedBlock.id);
    setSelectedBlockIds((currentIds) =>
      currentIds.includes(updatedBlock.id) ? currentIds : [updatedBlock.id],
    );
  };

  const applyRecurringTimeBlockUpdate = async (
    scope: RecurringUpdateScope,
  ) => {
    if (!pendingRecurringUpdate) {
      return;
    }

    const snapshot = await window.plannerAPI.updateRecurringTimeBlock({
      ...pendingRecurringUpdate,
      scope,
    });
    setCategories(orderCategoriesByStoredOrder(snapshot.categories));
    setStatsGroups(snapshot.statsGroups);
    setTasks(snapshot.tasks);
    setTimeBlocks(snapshot.timeBlocks);
    setSelectedBlockId(undefined);
    setSelectedBlockIds([]);
    setPendingRecurringUpdate(undefined);
  };

  const cancelRecurringTimeBlockUpdate = () => {
    setPendingRecurringUpdate(undefined);
  };

  const handleDeleteTimeBlock = async (timeBlockId: string) => {
    const selectedBlock = visibleTimeBlocks.find(
      (block) => block.id === timeBlockId,
    );
    const seriesId = selectedBlock
      ? getTimeBlockSeriesId(selectedBlock)
      : timeBlockId;
    const seriesBlock = timeBlocks.find((block) => block.id === seriesId);
    const isRecurringDelete =
      Boolean(selectedBlock?.recurringTimeBlockId) ||
      seriesBlock?.recurrenceFrequency !== "none";

    if (selectedBlock && isRecurringDelete) {
      setPendingRecurringDelete({ occurrence: selectedBlock });
      return;
    }

    await window.plannerAPI.deleteTimeBlock(seriesId);
    setTimeBlocks((currentBlocks) => {
      const nextBlocks = currentBlocks.filter(
        (block) => block.id !== seriesId,
      );
      setSelectedBlockId(nextBlocks[0]?.id);
      setSelectedBlockIds((currentIds) =>
        currentIds.filter((blockId) => blockId !== seriesId),
      );
      return nextBlocks;
    });
  };

  const applyRecurringTimeBlockDelete = async (
    scope: RecurringDeleteScope,
  ) => {
    if (!pendingRecurringDelete) {
      return;
    }

    const { occurrence } = pendingRecurringDelete;
    const seriesId = getTimeBlockSeriesId(occurrence);
    const seriesBlock = timeBlocks.find((block) => block.id === seriesId);
    if (!seriesBlock) {
      setPendingRecurringDelete(undefined);
      return;
    }

    if (
      scope === "all" ||
      (scope === "future" &&
        new Date(occurrence.startsAt).getTime() <=
          new Date(seriesBlock.startsAt).getTime())
    ) {
      await window.plannerAPI.deleteTimeBlock(seriesId);
      setTimeBlocks((currentBlocks) =>
        currentBlocks.filter((block) => block.id !== seriesId),
      );
    } else {
      const updatedSeries =
        scope === "this"
          ? await window.plannerAPI.updateTimeBlock({
              ...seriesBlock,
              recurrenceExceptions: [
                ...new Set([
                  ...(seriesBlock.recurrenceExceptions ?? []),
                  occurrence.startsAt,
                ]),
              ],
            })
          : await window.plannerAPI.updateTimeBlock({
              ...seriesBlock,
              recurrenceEndMode: "on",
              recurrenceEndDate: new Date(
                new Date(occurrence.startsAt).getTime() - 1000,
              ).toISOString(),
              recurrenceCount: undefined,
            });

      setTimeBlocks((currentBlocks) =>
        currentBlocks.map((block) =>
          block.id === updatedSeries.id ? updatedSeries : block,
        ),
      );
    }

    setSelectedBlockId(undefined);
    setSelectedBlockIds([]);
    setPendingRecurringDelete(undefined);
  };

  const cancelRecurringTimeBlockDelete = () => {
    setPendingRecurringDelete(undefined);
  };

  const handleDeleteSelectedTimeBlocks = async () => {
    const selectedIds =
      selectedBlockIds.length > 0
        ? selectedBlockIds
        : selectedBlockId
          ? [selectedBlockId]
          : [];

    if (selectedIds.length === 0) {
      return;
    }

    if (selectedIds.length === 1) {
      await handleDeleteTimeBlock(selectedIds[0]);
      return;
    }

    const deleteIds = [
      ...new Set(
        selectedIds.map((blockId) => {
          const selectedBlock = visibleTimeBlocks.find(
            (block) => block.id === blockId,
          );
          return selectedBlock ? getTimeBlockSeriesId(selectedBlock) : blockId;
        }),
      ),
    ];

    await Promise.all(
      deleteIds.map((blockId) => window.plannerAPI.deleteTimeBlock(blockId)),
    );
    setTimeBlocks((currentBlocks) =>
      currentBlocks.filter((block) => !deleteIds.includes(block.id)),
    );
    setSelectedBlockId(undefined);
    setSelectedBlockIds([]);
  };

  useEffect(() => {
    let isAwaitingGoKey = false;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) {
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsCommandPaletteOpen(true);
        return;
      }

      if (event.key === "Escape") {
        setIsCommandPaletteOpen(false);
        setPendingRecurringDelete(undefined);
        isAwaitingGoKey = false;
        return;
      }

      if (event.key === "ArrowLeft") {
        if (activeItem === "calendar") {
          event.preventDefault();
          handlePrevious();
        } else if (activeItem === "stats") {
          event.preventDefault();
          handleShiftStatsPeriod(-1);
        }
        return;
      }

      if (event.key === "ArrowRight") {
        if (activeItem === "calendar") {
          event.preventDefault();
          handleNext();
        } else if (activeItem === "stats") {
          event.preventDefault();
          handleShiftStatsPeriod(1);
        }
        return;
      }

      if (
        activeItem === "calendar" &&
        event.key === "Delete" &&
        !pendingRecurringUpdate &&
        !pendingRecurringDelete
      ) {
        event.preventDefault();
        void handleDeleteSelectedTimeBlocks();
        return;
      }

      const key = event.key.toLowerCase();
      if (isAwaitingGoKey) {
        const navMap: Partial<Record<string, NavItemId>> = {
          c: "calendar",
          f: "pomodoro",
          i: "timer",
          k: "tasks",
          s: "stats",
          p: "settings",
          o: "categories",
        };
        const nextItem = navMap[key];
        if (nextItem) {
          setActiveItem(nextItem);
        }
        isAwaitingGoKey = false;
        return;
      }

      if (activeItem === "stats" && key === "t") {
        event.preventDefault();
        handleCurrentStatsPeriod();
        return;
      }

      if (activeItem === "calendar" && key === "t") {
        event.preventDefault();
        handleToday();
        return;
      }

      if (activeItem === "calendar" && key === "w") {
        event.preventDefault();
        setActiveView("week");
        return;
      }

      if (activeItem === "calendar" && key === "m") {
        event.preventDefault();
        setActiveView("month");
        return;
      }

      if (activeItem === "stats" && key === "w") {
        event.preventDefault();
        handleSelectStatsRange("week");
        return;
      }

      if (activeItem === "stats" && key === "m") {
        event.preventDefault();
        handleSelectStatsRange("month");
        return;
      }

      if (activeItem === "stats" && key === "y") {
        event.preventDefault();
        handleSelectStatsRange("year");
        return;
      }

      if (["1", "2"].includes(key)) {
        setActiveView(calendarShortcutViews[Number(key) - 1]);
        return;
      }

      if (key === "g") {
        isAwaitingGoKey = true;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  if (isLoading) {
    return <div className="app-loading">Loading planner database...</div>;
  }

  if (loadError) {
    return <div className="app-loading">Database error: {loadError}</div>;
  }

  return (
    <CalendarTimeZoneProvider timeZone={settings.primaryCalendarTimeZone}>
    <div
      className={`app${activeResizeSide ? " resizing-panels" : ""}`}
      style={appStyle}
    >
      <Sidebar
        activeItem={activeItem}
        categories={categories}
        selectedCalendarCategoryId={selectedCalendarCategoryId}
        onSelectItem={setActiveItem}
        onSelectCalendarCategory={setSelectedCalendarCategoryId}
      />
      <ResizeHandle
        active={activeResizeSide === "left"}
        label={`Resize navigation sidebar. Minimum ${resizeConstraints.left.min}px, maximum ${resizeConstraints.left.max}px.`}
        onDoubleClick={() => resetWidth("left")}
        onPointerDown={startResize("left")}
        side="left"
      />

      <main className="workspace">
        {activeItem === "calendar" ? (
          <TopToolbar
            activeView={activeView}
            dateTitle={dateTitle}
            onNext={handleNext}
            onPrevious={handlePrevious}
            onSelectView={setActiveView}
            onToday={handleToday}
            onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
            onUpdateSettings={handleUpdateSettings}
            settings={settings}
          />
        ) : null}

        <div className="content">
          <MainPanel
            activeItem={activeItem}
            activeView={activeView}
            categories={categories}
            statsGroups={statsGroups}
            currentDate={currentDate}
            selectedCalendarCategoryId={selectedCalendarCategoryId}
            selectedStatsDate={selectedStatsDate}
            settings={settings}
            onSelectBlock={handleSelectBlock}
            onSelectTask={handleSelectTask}
            onToggleTask={handleToggleTask}
            onPlanSession={handleCreateTimeBlock}
            onCreateTask={handleCreateTask}
            onUpdateTask={handleUpdateTask}
            onDeleteTask={handleDeleteTask}
            onCreateCategory={handleCreateCategory}
            onUpdateCategory={handleUpdateCategory}
            onDeleteCategory={handleDeleteCategory}
            onReorderCategory={handleReorderCategory}
            onCreateTimeBlock={handleCreateTimeBlock}
            onUpdateTimeBlock={handleUpdateTimeBlock}
            onShiftCalendarDays={handleShiftCalendarDays}
            selectedBlockId={selectedBlockId}
            selectedBlockIds={selectedBlockIds}
            selectedDate={selectedDate}
            selectedTaskId={selectedTaskId}
            statsFilters={statsFilters}
            tasks={tasks}
            timeBlocks={
              activeItem === "calendar" ? calendarTimeBlocks : visibleTimeBlocks
            }
            onSelectDate={setSelectedDate}
            onSelectStatsDate={setSelectedStatsDate}
            onOpenFocusPage={() => setActiveItem("pomodoro")}
            onOpenTimerPage={() => setActiveItem("timer")}
            onUpdateSettings={handleUpdateSettings}
            onUpdateStatsGroups={handleUpdateStatsGroups}
          />
          <ResizeHandle
            active={activeResizeSide === "right"}
            label={`Resize inspector sidebar. Minimum ${resizeConstraints.right.min}px, maximum ${resizeConstraints.right.max}px.`}
            onDoubleClick={() => resetWidth("right")}
            onPointerDown={startResize("right")}
            side="right"
          />
          <InspectorPanel
            activeItem={activeItem}
            activeView={activeView}
            categories={categories}
            compactTaskList={settings.compactTodo}
            tasks={tasks}
            timeBlocks={
              activeItem === "calendar" ? calendarTimeBlocks : visibleTimeBlocks
            }
            weekStartDay={settings.weekStartDay}
            timeZone={settings.primaryCalendarTimeZone}
            timeZones={settings.calendarTimeZones}
            showHiddenCalendarCategories={showHiddenCalendarCategories}
            onToggleHiddenCalendarCategories={setShowHiddenCalendarCategories}
            onSelectBlock={handleSelectBlock}
            onSelectTask={handleSelectTask}
            onToggleTask={handleToggleTask}
            onUpdateTask={handleUpdateTask}
            onDeleteTask={handleDeleteTask}
            onUpdateCategory={handleUpdateCategory}
            onUpdateTimeBlock={handleUpdateTimeBlock}
            onDeleteTimeBlock={handleDeleteTimeBlock}
            selectedBlockId={selectedBlockId}
            selectedBlockIds={selectedBlockIds}
            selectedDate={selectedDate}
            selectedStatsDate={selectedStatsDate}
            selectedTaskId={selectedTaskId}
            statsFilters={statsFilters}
            onUpdateStatsFilters={setStatsFilters}
            onSelectStatsDate={setSelectedStatsDate}
          />
        </div>
      </main>

      {isCommandPaletteOpen ? (
        <CommandPalette
          onClose={() => setIsCommandPaletteOpen(false)}
          onSelectNav={setActiveItem}
          onSelectView={setActiveView}
          onToday={handleToday}
        />
      ) : null}

      {pendingRecurringUpdate ? (
        <div className="dialog-backdrop" role="presentation">
          <section
            aria-label="Apply recurring event change"
            className="fake-dialog recurrence-scope-dialog"
          >
            <div className="fake-dialog-header">
              <div>
                <div className="panel-kicker">Recurring event</div>
                <h2>Apply this change to</h2>
              </div>
              <button
                className="icon-button"
                onClick={cancelRecurringTimeBlockUpdate}
                type="button"
              >
                Close
              </button>
            </div>
            <div className="recurrence-scope-actions">
              <button
                className="toolbar-button"
                onClick={() => void applyRecurringTimeBlockUpdate("this")}
                type="button"
              >
                Only This Event
              </button>
              <button
                className="toolbar-button"
                onClick={() => void applyRecurringTimeBlockUpdate("future")}
                type="button"
              >
                This And Following Events
              </button>
              <button
                className="toolbar-button primary-action"
                onClick={() => void applyRecurringTimeBlockUpdate("all")}
                type="button"
              >
                All Events In Series
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {pendingRecurringDelete ? (
        <div className="dialog-backdrop" role="presentation">
          <section
            aria-label="Delete recurring event"
            className="fake-dialog recurrence-scope-dialog"
          >
            <div className="fake-dialog-header">
              <div>
                <div className="panel-kicker">Recurring event</div>
                <h2>Delete this event from</h2>
              </div>
              <button
                className="icon-button"
                onClick={cancelRecurringTimeBlockDelete}
                type="button"
              >
                Close
              </button>
            </div>
            <div className="recurrence-scope-actions">
              <button
                className="toolbar-button"
                onClick={() => void applyRecurringTimeBlockDelete("this")}
                type="button"
              >
                Only This Event
              </button>
              <button
                className="toolbar-button"
                onClick={() => void applyRecurringTimeBlockDelete("future")}
                type="button"
              >
                This And Following Events
              </button>
              <button
                className="toolbar-button danger-action"
                onClick={() => void applyRecurringTimeBlockDelete("all")}
                type="button"
              >
                All Events In Series
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
    </CalendarTimeZoneProvider>
  );
}

export default App;
