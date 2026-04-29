import { useEffect, useMemo, useState } from "react";
import "./App.css";
import CommandPalette from "./components/CommandPalette";
import InspectorPanel from "./components/InspectorPanel";
import MainPanel from "./components/MainPanel";
import Sidebar from "./components/Sidebar";
import TopToolbar from "./components/TopToolbar";
import type { Category, Task, TaskList, TimeBlock } from "./types/domain";
import type { AppSettings, CalendarView, NavItemId } from "./types/app";
import {
  addCalendarDays,
  expandRecurringTimeBlocks,
  formatCalendarTitle,
  getTimeBlockSeriesId,
} from "./utils/calendar";
import type {
  CreateCategoryInput,
  CreateTaskInput,
  CreateTimeBlockInput,
  RecurringUpdateScope,
} from "./types/plannerApi";

const defaultSettings: AppSettings = {
  weekStartDay: "monday",
  visibleStartHour: 6,
  visibleEndHour: 22,
  compactTodo: false,
};

const readSettings = () => {
  try {
    const storedSettings = localStorage.getItem("planner-settings");
    return storedSettings
      ? { ...defaultSettings, ...JSON.parse(storedSettings) }
      : defaultSettings;
  } catch {
    return defaultSettings;
  }
};

const isTypingTarget = (target: EventTarget | null) =>
  target instanceof HTMLInputElement ||
  target instanceof HTMLTextAreaElement ||
  target instanceof HTMLSelectElement;

const calendarShortcutViews: CalendarView[] = ["week", "month", "year"];

type PendingRecurringUpdate = {
  occurrence: TimeBlock;
  updatedBlock: TimeBlock;
};

const getExpansionRange = (date: Date) => {
  const start = new Date(date.getFullYear(), 0, 1);
  const end = new Date(date.getFullYear(), 11, 31, 23, 59, 59);
  return {
    start: addCalendarDays(start, -31),
    end: addCalendarDays(end, 31),
  };
};

function App() {
  const [activeItem, setActiveItem] = useState<NavItemId>("calendar");
  const [activeView, setActiveView] = useState<CalendarView>("week");
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCalendarCategoryId, setSelectedCalendarCategoryId] =
    useState<string>();
  const [taskLists, setTaskLists] = useState<TaskList[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState<string | undefined>();
  const [selectedTaskId, setSelectedTaskId] = useState<string | undefined>();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    () => new Date(),
  );
  const [settings, setSettings] = useState<AppSettings>(() => readSettings());
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | undefined>();
  const [pendingRecurringUpdate, setPendingRecurringUpdate] =
    useState<PendingRecurringUpdate>();
  const dateTitle = useMemo(
    () => formatCalendarTitle(currentDate, activeView),
    [activeView, currentDate],
  );
  const visibleTimeBlocks = useMemo(() => {
    const range = getExpansionRange(currentDate);
    return expandRecurringTimeBlocks(timeBlocks, range.start, range.end);
  }, [currentDate, timeBlocks]);

  useEffect(() => {
    if (categories.length === 0) {
      setSelectedCalendarCategoryId(undefined);
      return;
    }

    if (
      !selectedCalendarCategoryId ||
      !categories.some((category) => category.id === selectedCalendarCategoryId)
    ) {
      setSelectedCalendarCategoryId(categories[0].id);
    }
  }, [categories, selectedCalendarCategoryId]);

  const handleToday = () => {
    setCurrentDate(new Date());
    setActiveItem("calendar");
  };

  const handlePrevious = () => {
    const step =
      activeView === "week"
          ? -7
          : activeView === "year"
            ? -365
            : -30;
    setCurrentDate((date) => addCalendarDays(date, step));
  };

  const handleNext = () => {
    const step =
      activeView === "week"
          ? 7
          : activeView === "year"
            ? 365
            : 30;
    setCurrentDate((date) => addCalendarDays(date, step));
  };

  const handleShiftCalendarDays = (days: number) => {
    setCurrentDate((date) => addCalendarDays(date, days));
  };

  const handleSelectTask = (taskId: string) => {
    setSelectedTaskId(taskId);
  };

  const handleUpdateSettings = (nextSettings: AppSettings) => {
    const normalizedSettings = {
      ...nextSettings,
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
        setCategories(snapshot.categories);
        setTaskLists(snapshot.taskLists);
        setTasks(snapshot.tasks);
        setTimeBlocks(snapshot.timeBlocks);
        setSelectedTaskId(snapshot.tasks[0]?.id);
        setSelectedBlockId(snapshot.timeBlocks[0]?.id);
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
    setSelectedTaskId(task.id);
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
    setCategories((currentCategories) => [...currentCategories, category]);
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
    setTaskLists(snapshot.taskLists);
    setTasks(snapshot.tasks);
    setTimeBlocks(snapshot.timeBlocks);
    setCategories((currentCategories) =>
      currentCategories.filter((category) => category.id !== categoryId),
    );
  };

  const handleCreateTimeBlock = async (timeBlock: CreateTimeBlockInput) => {
    const createdBlock = await window.plannerAPI.createTimeBlock(timeBlock);
    setTimeBlocks((currentBlocks) => [...currentBlocks, createdBlock]);
    setSelectedBlockId(createdBlock.id);
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
    setCategories(snapshot.categories);
    setTaskLists(snapshot.taskLists);
    setTasks(snapshot.tasks);
    setTimeBlocks(snapshot.timeBlocks);
    setSelectedBlockId(undefined);
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
    await window.plannerAPI.deleteTimeBlock(seriesId);
    setTimeBlocks((currentBlocks) => {
      const nextBlocks = currentBlocks.filter(
        (block) => block.id !== seriesId,
      );
      setSelectedBlockId(nextBlocks[0]?.id);
      return nextBlocks;
    });
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
        isAwaitingGoKey = false;
        return;
      }

      if (event.key === "ArrowLeft") {
        handlePrevious();
        return;
      }

      if (event.key === "ArrowRight") {
        handleNext();
        return;
      }

      const key = event.key.toLowerCase();
      if (isAwaitingGoKey) {
        const navMap: Partial<Record<string, NavItemId>> = {
          c: "calendar",
          k: "tasks",
          s: "stats",
          p: "settings",
        };
        const nextItem = navMap[key];
        if (nextItem) {
          setActiveItem(nextItem);
        }
        isAwaitingGoKey = false;
        return;
      }

      if (key === "t") {
        handleToday();
        return;
      }

      if (["1", "2", "3"].includes(key)) {
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
    <div className="app">
      <Sidebar
        activeItem={activeItem}
        categories={categories}
        selectedCalendarCategoryId={selectedCalendarCategoryId}
        onSelectItem={setActiveItem}
        onSelectCalendarCategory={setSelectedCalendarCategoryId}
      />

      <main className="workspace">
        <TopToolbar
          activeView={activeView}
          dateTitle={dateTitle}
          onNext={handleNext}
          onPrevious={handlePrevious}
          onSelectView={setActiveView}
          onToday={handleToday}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          showViewSwitcher={activeItem !== "tasks"}
        />

        <div className="content">
          <MainPanel
            activeItem={activeItem}
            activeView={activeView}
            categories={categories}
            currentDate={currentDate}
            defaultTaskListId={taskLists[0]?.id ?? ""}
            selectedCalendarCategoryId={selectedCalendarCategoryId}
            settings={settings}
            onSelectBlock={setSelectedBlockId}
            onSelectTask={handleSelectTask}
            onToggleTask={handleToggleTask}
            onPlanSession={handleCreateTimeBlock}
            onCreateTask={handleCreateTask}
            onUpdateTask={handleUpdateTask}
            onDeleteTask={handleDeleteTask}
            onCreateCategory={handleCreateCategory}
            onUpdateCategory={handleUpdateCategory}
            onDeleteCategory={handleDeleteCategory}
            onCreateTimeBlock={handleCreateTimeBlock}
            onUpdateTimeBlock={handleUpdateTimeBlock}
            onShiftCalendarDays={handleShiftCalendarDays}
            selectedBlockId={selectedBlockId}
            selectedDate={selectedDate}
            selectedTaskId={selectedTaskId}
            tasks={tasks}
            timeBlocks={visibleTimeBlocks}
            onSelectDate={setSelectedDate}
            onUpdateSettings={handleUpdateSettings}
          />
          <InspectorPanel
            activeItem={activeItem}
            activeView={activeView}
            categories={categories}
            compactTaskList={settings.compactTodo}
            tasks={tasks}
            timeBlocks={visibleTimeBlocks}
            onSelectBlock={setSelectedBlockId}
            onSelectTask={handleSelectTask}
            onToggleTask={handleToggleTask}
            onUpdateTimeBlock={handleUpdateTimeBlock}
            onDeleteTimeBlock={handleDeleteTimeBlock}
            selectedBlockId={selectedBlockId}
            selectedDate={selectedDate}
            selectedTaskId={selectedTaskId}
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
    </div>
  );
}

export default App;
