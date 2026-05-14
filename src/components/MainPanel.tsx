import { sectionPlaceholders, viewPlaceholders } from "../data/placeholders";
import type {
  AppSettings,
  CalendarView,
  NavItemId,
  StatsFilters,
} from "../types/app";
import type { Category, StatsGroup, Task, TimeBlock } from "../types/domain";
import type {
  CreateCategoryInput,
  CreateTaskInput,
  CreateTimeBlockInput,
} from "../types/plannerApi";
import TimeBlockDialog from "./calendar/TimeBlockDialog";
import MonthView from "./calendar/MonthView";
import CategoriesView from "./categories/CategoriesView";
import PomodoroView from "./pomodoro/PomodoroView";
import SettingsView from "./settings/SettingsView";
import StatsView from "./stats/StatsView";
import TasksView from "./tasks/TasksView";
import WeekView from "./calendar/WeekView";
import { useState } from "react";

type MainPanelProps = {
  activeItem: NavItemId;
  activeView: CalendarView;
  categories: Category[];
  statsGroups: StatsGroup[];
  currentDate: Date;
  selectedCalendarCategoryId?: string;
  selectedStatsDate: Date;
  settings: AppSettings;
  selectedBlockId?: string;
  selectedBlockIds: string[];
  selectedDate?: Date;
  selectedTaskId?: string;
  statsFilters: StatsFilters;
  tasks: Task[];
  timeBlocks: TimeBlock[];
  onSelectBlock: (blockId?: string, additive?: boolean) => void;
  onSelectTask: (taskId: string) => void;
  onToggleTask: (taskId: string) => void | Promise<void>;
  onPlanSession: (timeBlock: CreateTimeBlockInput) => void | Promise<void>;
  onCreateTask: (input: CreateTaskInput) => void | Promise<void>;
  onUpdateTask: (input: Task) => void | Promise<void>;
  onDeleteTask: (taskId: string) => void | Promise<void>;
  onCreateCategory: (input: CreateCategoryInput) => void | Promise<void>;
  onUpdateCategory: (input: Category) => void | Promise<void>;
  onDeleteCategory: (categoryId: string) => void | Promise<void>;
  onCreateTimeBlock: (input: CreateTimeBlockInput) => void | Promise<void>;
  onUpdateTimeBlock: (input: TimeBlock) => void | Promise<void>;
  onShiftCalendarDays: (days: number) => void;
  onSelectDate: (date: Date) => void;
  onSelectStatsDate: (date: Date) => void;
  onOpenFocusPage: () => void;
  onUpdateSettings: (settings: AppSettings) => void;
};

function MainPanel({
  activeItem,
  activeView,
  categories,
  statsGroups,
  currentDate,
  selectedCalendarCategoryId,
  selectedStatsDate,
  settings,
  selectedBlockId,
  selectedBlockIds,
  selectedDate,
  selectedTaskId,
  statsFilters,
  tasks,
  timeBlocks,
  onSelectBlock,
  onSelectTask,
  onToggleTask,
  onPlanSession,
  onCreateTask,
  onUpdateTask,
  onDeleteTask,
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory,
  onCreateTimeBlock,
  onUpdateTimeBlock,
  onShiftCalendarDays,
  onSelectDate,
  onSelectStatsDate,
  onOpenFocusPage,
  onUpdateSettings,
}: MainPanelProps) {
  const [isTimeBlockDialogOpen, setIsTimeBlockDialogOpen] = useState(false);
  const [draftTimeBlock, setDraftTimeBlock] =
    useState<CreateTimeBlockInput>();
  const section = sectionPlaceholders[activeItem];
  const view = viewPlaceholders[activeView];
  const isCalendarSurface = activeItem === "calendar";
  const isImplementedCalendarView =
    isCalendarSurface && (activeView === "week" || activeView === "month");
  const getDefaultBlockKind = (categoryId: string) =>
    categories.find((category) => category.id === categoryId)
      ?.defaultBlockKind ?? "event";

  const openNewTimeBlockDialog = (draftBlock?: CreateTimeBlockInput) => {
    if (draftBlock) {
      setDraftTimeBlock({
        ...draftBlock,
        kind: draftBlock.kind ?? getDefaultBlockKind(draftBlock.categoryId),
        outcome: draftBlock.outcome ?? "active",
        source: draftBlock.source ?? "manual",
      });
    } else {
      const startsAt = new Date(currentDate);
      startsAt.setHours(9, 0, 0, 0);
      const endsAt = new Date(startsAt);
      endsAt.setHours(10, 0, 0, 0);

      setDraftTimeBlock({
        title: "",
        notes: "",
        categoryId: selectedCalendarCategoryId ?? categories[0]?.id ?? "",
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        kind: getDefaultBlockKind(selectedCalendarCategoryId ?? categories[0]?.id ?? ""),
        outcome: "active",
        source: "manual",
        recurrenceFrequency: "none",
      });
    }
    setIsTimeBlockDialogOpen(true);
  };

  const closeTimeBlockDialog = () => {
    setDraftTimeBlock(undefined);
    setIsTimeBlockDialogOpen(false);
  };

  return (
    <section className={`main-panel${isCalendarSurface ? " calendar-main-panel" : ""}`}>
      <div className="panel-header">
        <div>
          <div className="panel-kicker">{section.kicker}</div>
          <h1>{isCalendarSurface ? view.title : section.title}</h1>
          <p>{isCalendarSurface ? view.description : section.description}</p>
        </div>
        {isCalendarSurface ? (
          <button
            className="toolbar-button primary-action"
            onClick={() => openNewTimeBlockDialog()}
            type="button"
          >
            New Block
          </button>
        ) : null}
      </div>

      {activeItem === "stats" ? (
        <StatsView
          categories={categories}
          statsGroups={statsGroups}
          filters={statsFilters}
          onSelectStatsDate={onSelectStatsDate}
          selectedStatsDate={selectedStatsDate}
          tasks={tasks}
          timeBlocks={timeBlocks}
          weekStartDay={settings.weekStartDay}
        />
      ) : activeItem === "settings" ? (
        <SettingsView
          onUpdateSettings={onUpdateSettings}
          settings={settings}
        />
      ) : activeItem === "tasks" ? (
        <TasksView
          categories={categories}
          onCreateTask={onCreateTask}
          onUpdateTask={onUpdateTask}
          onDeleteTask={onDeleteTask}
          onSelectTask={onSelectTask}
          onToggleTask={onToggleTask}
          selectedTaskId={selectedTaskId}
          tasks={tasks}
          timeBlocks={timeBlocks}
          onPlanSession={onPlanSession}
          onOpenFocusPage={onOpenFocusPage}
        />
      ) : activeItem === "pomodoro" ? (
        <PomodoroView
          categories={categories}
          onCompleteSession={onPlanSession}
          onSelectTask={onSelectTask}
          onToggleTask={onToggleTask}
          selectedTaskId={selectedTaskId}
          tasks={tasks}
          timeBlocks={timeBlocks}
        />
      ) : activeItem === "categories" ? (
        <CategoriesView
          categories={categories}
          onCreateCategory={onCreateCategory}
          onUpdateCategory={onUpdateCategory}
          onDeleteCategory={onDeleteCategory}
        />
      ) : isImplementedCalendarView ? (
        <>
          {categories.length === 0 ? (
            <div className="empty-state calendar-surface-empty">
              No categories yet.
            </div>
          ) : timeBlocks.length === 0 ? (
            <div className="empty-state calendar-surface-empty">
              No time blocks in this view.
            </div>
          ) : null}
          {activeView === "week" ? (
            <WeekView
              blocks={timeBlocks}
              categories={categories}
              date={currentDate}
              defaultCategoryId={selectedCalendarCategoryId ?? categories[0]?.id ?? ""}
              onSelectTask={onSelectTask}
              onSelectBlock={onSelectBlock}
              onCreateBlockSelection={openNewTimeBlockDialog}
              onShiftDays={onShiftCalendarDays}
            selectedBlockId={selectedBlockId}
            selectedBlockIds={selectedBlockIds}
            selectedTaskId={selectedTaskId}
              tasks={tasks}
              visibleEndHour={settings.visibleEndHour}
              visibleStartHour={settings.visibleStartHour}
              weekStartDay={settings.weekStartDay}
              onToggleTask={onToggleTask}
              onUpdateBlock={onUpdateTimeBlock}
            />
          ) : activeView === "month" ? (
            <MonthView
              blocks={timeBlocks}
              categories={categories}
              date={currentDate}
              defaultCategoryId={selectedCalendarCategoryId ?? categories[0]?.id ?? ""}
              onSelectBlock={onSelectBlock}
              onCreateBlockSelection={openNewTimeBlockDialog}
              onSelectDate={onSelectDate}
              onSelectTask={onSelectTask}
              onUpdateBlock={onUpdateTimeBlock}
            selectedBlockId={selectedBlockId}
            selectedBlockIds={selectedBlockIds}
            selectedDate={selectedDate}
              selectedTaskId={selectedTaskId}
              tasks={tasks}
              weekStartDay={settings.weekStartDay}
            />
          ) : null}
        </>
      ) : (
        <div className="placeholder-surface">
          <div className="placeholder-card">
            <div className="placeholder-icon" aria-hidden="true" />
            <h2>{section.title}</h2>
            <p>{section.description}</p>
          </div>
        </div>
      )}

      {isTimeBlockDialogOpen ? (
        <TimeBlockDialog
          categories={categories}
          initialBlock={draftTimeBlock}
          onClose={closeTimeBlockDialog}
          onSave={onCreateTimeBlock}
          tasks={tasks}
        />
      ) : null}
    </section>
  );
}

export default MainPanel;
