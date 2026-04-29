import { sectionPlaceholders, viewPlaceholders } from "../data/placeholders";
import type { AppSettings, CalendarView, NavItemId } from "../types/app";
import type { Category, Task, TimeBlock } from "../types/domain";
import type {
  CreateCategoryInput,
  CreateTaskInput,
  CreateTimeBlockInput,
} from "../types/plannerApi";
import TimeBlockDialog from "./calendar/TimeBlockDialog";
import MonthView from "./calendar/MonthView";
import YearHeatmap from "./calendar/YearHeatmap";
import CategoriesView from "./categories/CategoriesView";
import SettingsView from "./settings/SettingsView";
import StatsView from "./stats/StatsView";
import TasksView from "./tasks/TasksView";
import WeekView from "./calendar/WeekView";
import { useState } from "react";

type MainPanelProps = {
  activeItem: NavItemId;
  activeView: CalendarView;
  categories: Category[];
  currentDate: Date;
  defaultTaskListId: string;
  selectedCalendarCategoryId?: string;
  settings: AppSettings;
  selectedBlockId?: string;
  selectedDate?: Date;
  selectedTaskId?: string;
  tasks: Task[];
  timeBlocks: TimeBlock[];
  onSelectBlock: (blockId?: string) => void;
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
  onUpdateSettings: (settings: AppSettings) => void;
};

function MainPanel({
  activeItem,
  activeView,
  categories,
  currentDate,
  defaultTaskListId,
  selectedCalendarCategoryId,
  settings,
  selectedBlockId,
  selectedDate,
  selectedTaskId,
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
  onUpdateSettings,
}: MainPanelProps) {
  const [isTimeBlockDialogOpen, setIsTimeBlockDialogOpen] = useState(false);
  const [draftTimeBlock, setDraftTimeBlock] =
    useState<CreateTimeBlockInput>();
  const section = sectionPlaceholders[activeItem];
  const view = viewPlaceholders[activeView];
  const isCalendarSurface = activeItem === "calendar";
  const isImplementedCalendarView =
    isCalendarSurface &&
    (activeView === "week" || activeView === "month" || activeView === "year");

  const openNewTimeBlockDialog = (draftBlock?: CreateTimeBlockInput) => {
    if (draftBlock) {
      setDraftTimeBlock(draftBlock);
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
    <section className="main-panel">
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
          tasks={tasks}
          timeBlocks={timeBlocks}
        />
      ) : activeItem === "settings" ? (
        <SettingsView
          onUpdateSettings={onUpdateSettings}
          settings={settings}
        />
      ) : activeItem === "tasks" ? (
        <TasksView
          categories={categories}
          defaultListId={defaultTaskListId}
          onCreateTask={onCreateTask}
          onUpdateTask={onUpdateTask}
          onDeleteTask={onDeleteTask}
          onSelectTask={onSelectTask}
          onToggleTask={onToggleTask}
          selectedTaskId={selectedTaskId}
          tasks={tasks}
          timeBlocks={timeBlocks}
          onPlanSession={onPlanSession}
        />
      ) : activeItem === "categories" ? (
        <CategoriesView
          categories={categories}
          onCreateCategory={onCreateCategory}
          onUpdateCategory={onUpdateCategory}
          onDeleteCategory={onDeleteCategory}
        />
      ) : isImplementedCalendarView ? (
        activeView === "week" ? (
          <WeekView
            blocks={timeBlocks}
            categories={categories}
            date={currentDate}
            defaultCategoryId={selectedCalendarCategoryId ?? categories[0]?.id ?? ""}
            onSelectBlock={onSelectBlock}
            onCreateBlockSelection={openNewTimeBlockDialog}
            onShiftDays={onShiftCalendarDays}
            selectedBlockId={selectedBlockId}
            visibleEndHour={settings.visibleEndHour}
            visibleStartHour={settings.visibleStartHour}
            weekStartDay={settings.weekStartDay}
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
            selectedBlockId={selectedBlockId}
            selectedDate={selectedDate}
            selectedTaskId={selectedTaskId}
            tasks={tasks}
            weekStartDay={settings.weekStartDay}
          />
        ) : (
          <YearHeatmap
            categories={categories}
            date={currentDate}
            onSelectDate={onSelectDate}
            selectedDate={selectedDate}
            tasks={tasks}
            timeBlocks={timeBlocks}
          />
        )
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
