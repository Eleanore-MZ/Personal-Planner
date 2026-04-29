import type { Category, Task, TimeBlock } from "../../types/domain";
import type { CSSProperties, KeyboardEvent } from "react";
import {
  addCalendarDays,
  getBlocksForDay,
  getCategoryColorValues,
  getWeekDays,
  isSameCalendarDay,
  startOfDay,
  startOfWeek,
} from "../../utils/calendar";
import { findCategoryById } from "../../utils/categories";
import { formatTime } from "../../utils/date";
import { formatTaskDueDate, isTaskComplete } from "../../utils/tasks";
import type { WeekStartDay } from "../../types/app";
import type { CreateTimeBlockInput } from "../../types/plannerApi";

type MonthViewProps = {
  blocks: TimeBlock[];
  categories: Category[];
  date: Date;
  defaultCategoryId: string;
  onSelectBlock: (blockId?: string) => void;
  onCreateBlockSelection: (block: CreateTimeBlockInput) => void;
  onSelectDate: (date: Date) => void;
  onSelectTask: (taskId: string) => void;
  selectedBlockId?: string;
  selectedDate?: Date;
  selectedTaskId?: string;
  tasks: Task[];
  weekStartDay: WeekStartDay;
};

const weekdayFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
});

function getMonthGridDays(date: Date, weekStartDay: WeekStartDay) {
  const firstOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const start = startOfWeek(firstOfMonth, weekStartDay);
  return Array.from({ length: 42 }, (_, index) =>
    addCalendarDays(start, index),
  );
}

function getDueTasksForDay(tasks: Task[], date: Date) {
  return tasks.filter(
    (task) => task.dueDate && isSameCalendarDay(new Date(task.dueDate), date),
  );
}

function getDraftTimeBlockForDay(
  date: Date,
  categoryId: string,
): CreateTimeBlockInput {
  const startsAt = new Date(date);
  startsAt.setHours(9, 0, 0, 0);
  const endsAt = new Date(startsAt);
  endsAt.setHours(10, 0, 0, 0);

  return {
    title: "",
    notes: "",
    categoryId,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    recurrenceFrequency: "none",
  };
}

function handleDayKeyDown(
  event: KeyboardEvent<HTMLDivElement>,
  onSelect: () => void,
) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    onSelect();
  }
}

function MonthView({
  blocks,
  categories,
  date,
  defaultCategoryId,
  onSelectBlock,
  onCreateBlockSelection,
  onSelectDate,
  onSelectTask,
  selectedBlockId,
  selectedDate,
  selectedTaskId,
  tasks,
  weekStartDay,
}: MonthViewProps) {
  const monthDays = getMonthGridDays(date, weekStartDay);
  const weekdayLabels = getWeekDays(new Date(2026, 0, 5), weekStartDay).map(
    (day) => weekdayFormatter.format(day),
  );
  const today = startOfDay(new Date());
  const handleCreateBlockForDay = (day: Date) => {
    onSelectDate(day);
    onSelectBlock(undefined);
    onCreateBlockSelection(getDraftTimeBlockForDay(day, defaultCategoryId));
  };

  const handleSelectEmptyDay = (day: Date) => {
    onSelectDate(day);
    onSelectBlock(undefined);
  };

  return (
    <section className="month-view-panel">
      <div className="month-weekday-row" aria-hidden="true">
        {weekdayLabels.map((label) => (
          <div className="month-weekday" key={label}>
            {label}
          </div>
        ))}
      </div>

      <div className="month-grid">
        {monthDays.map((day) => {
          const dayBlocks = getBlocksForDay(blocks, day).sort(
            (first, second) =>
              new Date(first.startsAt).getTime() -
              new Date(second.startsAt).getTime(),
          );
          const dueTasks = getDueTasksForDay(tasks, day);
          const overflowCount = Math.max(
            0,
            dayBlocks.length + dueTasks.length - 4,
          );
          const isOutsideMonth = day.getMonth() !== date.getMonth();
          const isSelected =
            selectedDate && isSameCalendarDay(selectedDate, day);

          return (
            <div
              className={`month-day-cell${
                isOutsideMonth ? " outside-month" : ""
              }${isSameCalendarDay(today, day) ? " today" : ""}${
                isSelected ? " selected" : ""
              }`}
              key={day.toISOString()}
              onClick={() => handleSelectEmptyDay(day)}
              onDoubleClick={() => handleCreateBlockForDay(day)}
              onKeyDown={(event) =>
                handleDayKeyDown(event, () => handleSelectEmptyDay(day))
              }
              role="button"
              tabIndex={0}
            >
              <div className="month-day-header">
                <span>{day.getDate()}</span>
                <strong>{dayBlocks.length + dueTasks.length}</strong>
              </div>

              <div className="month-day-items">
                {dayBlocks.slice(0, 3).map((block) => {
                  const category = findCategoryById(
                    categories,
                    block.categoryId,
                  );
                  const colors = getCategoryColorValues(category?.color);

                  return (
                    <button
                      className={`month-block-chip${
                        selectedBlockId === block.id ? " selected" : ""
                      }`}
                      key={block.id}
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelectDate(day);
                        onSelectBlock(block.id);
                      }}
                      style={{
                        "--month-block-accent": colors.accent,
                        "--month-block-background": colors.background,
                        "--month-block-border": colors.border,
                      } as CSSProperties}
                      title={`${formatTime(block.startsAt)} ${block.title}`}
                      type="button"
                    >
                      <small>{formatTime(block.startsAt)}</small>
                      <span>{block.title}</span>
                    </button>
                  );
                })}

                {dueTasks.slice(0, Math.max(0, 4 - dayBlocks.length)).map(
                  (task) => (
                    <button
                      className={`month-task-chip${
                        selectedTaskId === task.id ? " selected" : ""
                      }${isTaskComplete(task) ? " complete" : ""}`}
                      key={task.id}
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelectDate(day);
                        onSelectTask(task.id);
                      }}
                      title={`${task.title} - ${formatTaskDueDate(task)}`}
                      type="button"
                    >
                      <small>Due</small>
                      <span>{task.title}</span>
                    </button>
                  ),
                )}

                {overflowCount > 0 ? (
                  <div className="month-overflow-count">
                    +{overflowCount} more
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default MonthView;
