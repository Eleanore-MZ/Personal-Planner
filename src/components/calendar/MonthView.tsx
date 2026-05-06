import type { Category, Task, TimeBlock } from "../../types/domain";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, PointerEvent } from "react";
import {
  addCalendarDays,
  getAllDayEndDate,
  getBlocksForDay,
  getCategoryColorValues,
  getWeekDays,
  isAllDayBlock,
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
  onSelectBlock: (blockId?: string, additive?: boolean) => void;
  onCreateBlockSelection: (block: CreateTimeBlockInput) => void;
  onSelectDate: (date: Date) => void;
  onSelectTask: (taskId: string) => void;
  onUpdateBlock: (block: TimeBlock) => void | Promise<void>;
  selectedBlockId?: string;
  selectedBlockIds: string[];
  selectedDate?: Date;
  selectedTaskId?: string;
  tasks: Task[];
  weekStartDay: WeekStartDay;
};

type AllDayResizeEdge = "start" | "end";
type MonthAllDaySegment = {
  block: TimeBlock;
  endIndex: number;
  laneIndex: number;
  startIndex: number;
  weekIndex: number;
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

const getDayDistance = (start: Date, end: Date) =>
  Math.floor((startOfDay(end).getTime() - startOfDay(start).getTime()) / 86400000);

const getMonthAllDaySegments = (
  blocks: TimeBlock[],
  days: Date[],
): MonthAllDaySegment[] => {
  const rangeStart = startOfDay(days[0]);
  const rangeEnd = addCalendarDays(startOfDay(days[days.length - 1]), 1);
  const segments = blocks
    .filter(isAllDayBlock)
    .flatMap((block) => {
      const blockStart = startOfDay(new Date(block.startsAt));
      const blockEnd = getAllDayEndDate(block);
      if (blockEnd <= rangeStart || blockStart >= rangeEnd) {
        return [];
      }

      const visibleStartIndex = Math.max(0, getDayDistance(rangeStart, blockStart));
      const visibleEndIndex = Math.min(
        days.length - 1,
        getDayDistance(rangeStart, addCalendarDays(blockEnd, -1)),
      );
      const weekSegments: MonthAllDaySegment[] = [];
      for (
        let weekStartIndex = Math.floor(visibleStartIndex / 7) * 7;
        weekStartIndex <= visibleEndIndex;
        weekStartIndex += 7
      ) {
        const weekEndIndex = weekStartIndex + 6;
        weekSegments.push({
          block,
          endIndex: Math.min(visibleEndIndex, weekEndIndex),
          laneIndex: 0,
          startIndex: Math.max(visibleStartIndex, weekStartIndex),
          weekIndex: Math.floor(weekStartIndex / 7),
        });
      }
      return weekSegments;
    })
    .sort(
      (first, second) =>
        first.weekIndex - second.weekIndex ||
        first.startIndex - second.startIndex ||
        second.endIndex - first.endIndex ||
        first.block.title.localeCompare(second.block.title),
    );
  const laneEndsByWeek = new Map<number, number[]>();

  return segments.map((segment) => {
    const laneEnds = laneEndsByWeek.get(segment.weekIndex) ?? [];
    const reusableLane = laneEnds.findIndex((laneEnd) => laneEnd < segment.startIndex);
    const laneIndex = reusableLane === -1 ? laneEnds.length : reusableLane;
    laneEnds[laneIndex] = segment.endIndex;
    laneEndsByWeek.set(segment.weekIndex, laneEnds);
    return { ...segment, laneIndex };
  });
};

const getResizedAllDayBlock = (
  block: TimeBlock,
  edge: AllDayResizeEdge,
  day: Date,
) => {
  const currentStart = startOfDay(new Date(block.startsAt));
  const currentEnd = getAllDayEndDate(block);
  const candidateStart = startOfDay(day);

  if (edge === "start") {
    const latestStart = addCalendarDays(currentEnd, -1);
    return {
      ...block,
      startsAt: new Date(
        Math.min(candidateStart.getTime(), latestStart.getTime()),
      ).toISOString(),
    };
  }

  const candidateEnd = addCalendarDays(candidateStart, 1);
  const earliestEnd = addCalendarDays(currentStart, 1);
  return {
    ...block,
    endsAt: new Date(
      Math.max(candidateEnd.getTime(), earliestEnd.getTime()),
    ).toISOString(),
  };
};

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
  onUpdateBlock,
  selectedBlockId,
  selectedBlockIds,
  selectedDate,
  selectedTaskId,
  tasks,
  weekStartDay,
}: MonthViewProps) {
  const monthGridRef = useRef<HTMLDivElement>(null);
  const [allDayResize, setAllDayResize] = useState<
    | {
        block: TimeBlock;
        dayIndex: number;
        edge: AllDayResizeEdge;
        pointerId: number;
      }
    | undefined
  >();
  const monthDays = getMonthGridDays(date, weekStartDay);
  const allDayPreviewBlocks = allDayResize
    ? blocks.map((block) =>
        block.id === allDayResize.block.id
          ? getResizedAllDayBlock(
              allDayResize.block,
              allDayResize.edge,
              monthDays[allDayResize.dayIndex],
            )
          : block,
      )
    : blocks;
  const allDaySegments = getMonthAllDaySegments(allDayPreviewBlocks, monthDays);
  const weekLaneCounts = Array.from({ length: 6 }, (_, weekIndex) =>
    Math.max(
      0,
      ...allDaySegments
        .filter((segment) => segment.weekIndex === weekIndex)
        .map((segment) => segment.laneIndex + 1),
    ),
  );
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

  const getMonthDayIndexFromPoint = (clientX: number, clientY: number) => {
    const gridBounds = monthGridRef.current?.getBoundingClientRect();
    if (!gridBounds) {
      return undefined;
    }

    const column = Math.floor(((clientX - gridBounds.left) / gridBounds.width) * 7);
    const row = Math.floor(((clientY - gridBounds.top) / gridBounds.height) * 6);
    if (column < 0 || column > 6 || row < 0 || row > 5) {
      return undefined;
    }

    return row * 7 + column;
  };

  useEffect(() => {
    if (!allDayResize) {
      return;
    }

    const handlePointerMove = (event: globalThis.PointerEvent) => {
      if (event.pointerId !== allDayResize.pointerId) {
        return;
      }

      const dayIndex = getMonthDayIndexFromPoint(event.clientX, event.clientY);
      if (dayIndex !== undefined) {
        setAllDayResize((currentResize) =>
          currentResize ? { ...currentResize, dayIndex } : undefined,
        );
      }
    };

    const handlePointerUp = (event: globalThis.PointerEvent) => {
      if (event.pointerId !== allDayResize.pointerId) {
        return;
      }

      const resizedBlock = getResizedAllDayBlock(
        allDayResize.block,
        allDayResize.edge,
        monthDays[allDayResize.dayIndex],
      );
      setAllDayResize(undefined);
      void onUpdateBlock(resizedBlock);
    };

    const handlePointerCancel = (event: globalThis.PointerEvent) => {
      if (event.pointerId === allDayResize.pointerId) {
        setAllDayResize(undefined);
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerCancel);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
    };
  }, [allDayResize, monthDays, onUpdateBlock]);

  const handleAllDayResizeStart = (
    block: TimeBlock,
    edge: AllDayResizeEdge,
    dayIndex: number,
    event: PointerEvent<HTMLSpanElement>,
  ) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    onSelectBlock(block.id);
    setAllDayResize({
      block,
      dayIndex,
      edge,
      pointerId: event.pointerId,
    });
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

      <div className="month-grid" ref={monthGridRef}>
        {monthDays.map((day, dayIndex) => {
          const allDayCount = getBlocksForDay(allDayPreviewBlocks, day).filter(
            isAllDayBlock,
          ).length;
          const dayBlocks = getBlocksForDay(blocks, day).filter(
            (block) => !isAllDayBlock(block),
          ).sort(
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
              style={
                {
                  "--month-all-day-lanes": weekLaneCounts[Math.floor(dayIndex / 7)],
                  gridColumn: (dayIndex % 7) + 1,
                  gridRow: Math.floor(dayIndex / 7) + 1,
                } as CSSProperties
              }
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
                <strong>{allDayCount + dayBlocks.length + dueTasks.length}</strong>
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
                        selectedBlockId === block.id ||
                        selectedBlockIds.includes(block.id)
                          ? " selected"
                          : ""
                      } outcome-${block.outcome} kind-${block.kind}${
                        block.taskId ? " linked-task" : ""
                      }`}
                      key={block.id}
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelectDate(day);
                        onSelectBlock(block.id, event.shiftKey);
                      }}
                      style={{
                        "--month-block-accent": colors.accent,
                        "--month-block-background": colors.background,
                        "--month-block-border": colors.border,
                      } as CSSProperties}
                      title={
                        isAllDayBlock(block)
                          ? `All day ${block.title}`
                          : `${formatTime(block.startsAt)} ${block.title}`
                      }
                      type="button"
                    >
                      <small>
                        {isAllDayBlock(block) ? "All day" : formatTime(block.startsAt)}
                      </small>
                      <span>
                        {block.kind === "habit" ? "Habit: " : ""}
                        {block.kind === "routine" ? "Routine: " : ""}
                        {block.kind === "task-session" && block.taskId
                          ? "Task: "
                          : ""}
                        {block.title}
                      </span>
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
        {allDaySegments.map((segment) => {
          const category = findCategoryById(categories, segment.block.categoryId);
          const colors = getCategoryColorValues(category?.color);
          const segmentStartsAtBlockStart = isSameCalendarDay(
            new Date(segment.block.startsAt),
            monthDays[segment.startIndex],
          );
          const segmentEndsAtBlockEnd = isSameCalendarDay(
            addCalendarDays(getAllDayEndDate(segment.block), -1),
            monthDays[segment.endIndex],
          );

          return (
            <button
              className={`month-all-day-span${
                selectedBlockId === segment.block.id ||
                selectedBlockIds.includes(segment.block.id)
                  ? " selected"
                  : ""
              } outcome-${segment.block.outcome} kind-${segment.block.kind}${
                segment.block.taskId ? " linked-task" : ""
              }`}
              key={`${segment.block.id}-${segment.startIndex}-${segment.endIndex}`}
              onClick={(event) => {
                event.stopPropagation();
                onSelectDate(monthDays[segment.startIndex]);
                onSelectBlock(segment.block.id, event.shiftKey);
              }}
              onDoubleClick={(event) => event.stopPropagation()}
              style={
                {
                  "--month-block-accent": colors.accent,
                  "--month-block-background": colors.background,
                  "--month-block-border": colors.border,
                  gridColumn: `${(segment.startIndex % 7) + 1} / ${
                    (segment.endIndex % 7) + 2
                  }`,
                  gridRow: Math.floor(segment.startIndex / 7) + 1,
                  marginTop: `${34 + segment.laneIndex * 27}px`,
                } as CSSProperties
              }
              title={`All day ${segment.block.title}`}
              type="button"
            >
              {segmentStartsAtBlockStart ? (
                <span
                  aria-hidden="true"
                  className="all-day-chip-resize-handle start"
                  onPointerDown={(event) =>
                    handleAllDayResizeStart(
                      segment.block,
                      "start",
                      segment.startIndex,
                      event,
                    )
                  }
                />
              ) : null}
              <span>
                {segment.block.kind === "habit" ? "Habit: " : ""}
                {segment.block.kind === "routine" ? "Routine: " : ""}
                {segment.block.kind === "task-session" && segment.block.taskId
                  ? "Task: "
                  : ""}
                {segment.block.title}
              </span>
              {segmentEndsAtBlockEnd ? (
                <span
                  aria-hidden="true"
                  className="all-day-chip-resize-handle end"
                  onPointerDown={(event) =>
                    handleAllDayResizeStart(
                      segment.block,
                      "end",
                      segment.endIndex,
                      event,
                    )
                  }
                />
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default MonthView;
