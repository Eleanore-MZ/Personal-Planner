import {
  formatDayLabel,
  formatHour,
  addCalendarDays,
  calendarHourHeight,
  getBlocksForDay,
  getAllDayEndDate,
  getCalendarHours,
  getCategoryColorValues,
  getWeekDays,
  isAllDayBlock,
  isSameCalendarDay,
  startOfDay,
} from "../../utils/calendar";
import {
  getTimeZoneLabel,
  getTimeZoneOffsetMinutes,
  resolveCalendarMinute,
  toTimeInputValue,
  toZonedCalendarDate,
} from "../../utils/timezone";
import type { Category, Task, TimeBlock } from "../../types/domain";
import type { WeekStartDay } from "../../types/app";
import type { CreateTimeBlockInput } from "../../types/plannerApi";
import CalendarBlock from "./CalendarBlock";
import { findCategoryById } from "../../utils/categories";
import { isTaskComplete } from "../../utils/tasks";
import {
  useEffect,
  useCallback,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type MouseEvent,
  type PointerEvent,
  type WheelEvent,
} from "react";

const dragSnapMinutes = 15;
const defaultCreatedBlockMinutes = 60;
const horizontalDayScrollThreshold = 95;
const horizontalWeekScrollResetMs = 180;
type ResizeEdge = "start" | "end";
type AllDayResizeEdge = "start" | "end";
type AllDaySegment = {
  block: TimeBlock;
  endIndex: number;
  laneIndex: number;
  startIndex: number;
};

const getBlockDurationMinutes = (block: TimeBlock) =>
  Math.max(
    dragSnapMinutes,
    Math.round(
      (new Date(block.endsAt).getTime() - new Date(block.startsAt).getTime()) /
        60000,
    ),
  );

const getSnappedMinutesFromTop = (top: number) =>
  Math.round((top / calendarHourHeight / dragSnapMinutes) * 60) *
  dragSnapMinutes;

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(Math.max(value, minimum), maximum);

const getDroppedDate = (
  day: Date,
  startMinuteOfDay: number,
  durationMinutes: number,
  timeZone: string,
) => {
  const startResolution = resolveCalendarMinute(day, startMinuteOfDay, timeZone);
  if (startResolution.status !== "valid") {
    return undefined;
  }
  const startsAt = startResolution.date;

  return {
    startsAt,
    endsAt: new Date(startsAt.getTime() + durationMinutes * 60000),
  };
};

const getMinuteFromPointer = (
  event: PointerEvent<HTMLDivElement>,
  visibleStartHour: number,
  visibleEndHour: number,
) => {
  const columnBounds = event.currentTarget.getBoundingClientRect();
  const rawTop = event.clientY - columnBounds.top;
  const visibleStartMinute = visibleStartHour * 60;
  const visibleEndMinute = (visibleEndHour + 1) * 60;
  return clamp(
    visibleStartMinute + getSnappedMinutesFromTop(rawTop),
    visibleStartMinute,
    visibleEndMinute,
  );
};

const getMinuteFromClientY = (
  clientY: number,
  columnTop: number,
  visibleStartHour: number,
  visibleEndHour: number,
) => {
  const visibleStartMinute = visibleStartHour * 60;
  const visibleEndMinute = (visibleEndHour + 1) * 60;
  return clamp(
    visibleStartMinute + getSnappedMinutesFromTop(clientY - columnTop),
    visibleStartMinute,
    visibleEndMinute,
  );
};

const getDateAtMinute = (day: Date, minuteOfDay: number, timeZone: string) => {
  const resolution = resolveCalendarMinute(day, minuteOfDay, timeZone);
  return resolution.status === "valid" ? resolution.date : undefined;
};

const getDateAtWeekMinute = (
  weekStart: Date,
  absoluteMinute: number,
  timeZone: string,
) => {
  const dayOffset = Math.floor(absoluteMinute / (24 * 60));
  const minuteOfDay = absoluteMinute - dayOffset * 24 * 60;
  const date = new Date(weekStart);
  date.setDate(date.getDate() + dayOffset);
  return getDateAtMinute(date, minuteOfDay, timeZone);
};

const getDayDistance = (start: Date, end: Date) =>
  Math.floor((startOfDay(end).getTime() - startOfDay(start).getTime()) / 86400000);

const getAllDaySegments = (
  allDayBlocks: TimeBlock[],
  days: Date[],
  timeZone: string,
): AllDaySegment[] => {
  const rangeStart = startOfDay(days[0]);
  const rangeEnd = addCalendarDays(startOfDay(days[days.length - 1]), 1);
  const segments = allDayBlocks
    .flatMap((block) => {
      const blockStart = startOfDay(toZonedCalendarDate(block.startsAt, timeZone));
      const blockEnd = getAllDayEndDate(block, timeZone);
      if (blockEnd <= rangeStart || blockStart >= rangeEnd) {
        return [];
      }

      return [
        {
          block,
          endIndex: Math.min(days.length - 1, getDayDistance(rangeStart, addCalendarDays(blockEnd, -1))),
          laneIndex: 0,
          startIndex: Math.max(0, getDayDistance(rangeStart, blockStart)),
        },
      ];
    })
    .sort(
      (first, second) =>
        first.startIndex - second.startIndex ||
        second.endIndex - first.endIndex ||
        first.block.title.localeCompare(second.block.title),
    );
  const laneEnds: number[] = [];

  return segments.map((segment) => {
    const reusableLane = laneEnds.findIndex((laneEnd) => laneEnd < segment.startIndex);
    const laneIndex = reusableLane === -1 ? laneEnds.length : reusableLane;
    laneEnds[laneIndex] = segment.endIndex;
    return { ...segment, laneIndex };
  });
};

const getResizedAllDayBlock = (
  block: TimeBlock,
  edge: AllDayResizeEdge,
  day: Date,
  timeZone: string,
) => {
  const currentStart = startOfDay(toZonedCalendarDate(block.startsAt, timeZone));
  const currentEnd = getAllDayEndDate(block, timeZone);
  const candidateStart = startOfDay(day);

  if (edge === "start") {
    const latestStart = addCalendarDays(currentEnd, -1);
    const startResolution = resolveCalendarMinute(
      new Date(Math.min(candidateStart.getTime(), latestStart.getTime())),
      0,
      timeZone,
    );
    return {
      ...block,
      timeZone,
      startsAt:
        startResolution.status === "valid"
          ? startResolution.date.toISOString()
          : block.startsAt,
    };
  }

  const candidateEnd = addCalendarDays(candidateStart, 1);
  const earliestEnd = addCalendarDays(currentStart, 1);
  const endResolution = resolveCalendarMinute(
    new Date(Math.max(candidateEnd.getTime(), earliestEnd.getTime())),
    0,
    timeZone,
  );
  return {
    ...block,
    timeZone,
    endsAt:
      endResolution.status === "valid"
        ? endResolution.date.toISOString()
        : block.endsAt,
  };
};

const getResizedBlock = (
  block: TimeBlock,
  edge: ResizeEdge,
  day: Date,
  minuteOfDay: number,
  timeZone: string,
) => {
  const startsAt = new Date(block.startsAt);
  const endsAt = new Date(block.endsAt);
  const candidate = getDateAtMinute(day, minuteOfDay, timeZone);
  if (!candidate) {
    return undefined;
  }
  const minimumDurationMs = dragSnapMinutes * 60000;

  if (edge === "start") {
    const latestStart = new Date(endsAt.getTime() - minimumDurationMs);
    return {
      ...block,
      timeZone,
      startsAt: new Date(
        Math.min(candidate.getTime(), latestStart.getTime()),
      ).toISOString(),
    };
  }

  const earliestEnd = new Date(startsAt.getTime() + minimumDurationMs);
  return {
    ...block,
    timeZone,
    endsAt: new Date(
      Math.max(candidate.getTime(), earliestEnd.getTime()),
    ).toISOString(),
  };
};

const isCalendarBlockTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement && Boolean(target.closest(".calendar-block"));

const getWeekColumn = (target: Element | null) => {
  const column = target?.closest(".week-day-column");
  return column instanceof HTMLElement ? column : undefined;
};

type LaidOutBlock = {
  block: TimeBlock;
  isCompact: boolean;
  layoutStyle: CSSProperties;
  originalBlock: TimeBlock;
};

const getVisualBlockEndMs = (block: TimeBlock) => {
  const blockStart = new Date(block.startsAt).getTime();
  const blockEnd = new Date(block.endsAt).getTime();
  return Math.max(blockEnd, blockStart + dragSnapMinutes * 60000);
};

const doBlocksOverlap = (firstBlock: TimeBlock, secondBlock: TimeBlock) =>
  new Date(firstBlock.startsAt).getTime() <
    getVisualBlockEndMs(secondBlock) &&
  new Date(secondBlock.startsAt).getTime() <
    getVisualBlockEndMs(firstBlock);

const getLaidOutBlocks = (
  dayBlocks: TimeBlock[],
  allBlocks: TimeBlock[],
): LaidOutBlock[] => {
  const sortedBlocks = [...dayBlocks].sort((firstBlock, secondBlock) => {
    const startDifference =
      new Date(firstBlock.startsAt).getTime() -
      new Date(secondBlock.startsAt).getTime();
    return startDifference || firstBlock.id.localeCompare(secondBlock.id);
  });
  const clusters: TimeBlock[][] = [];
  let currentCluster: TimeBlock[] = [];
  let currentClusterEnd = 0;

  sortedBlocks.forEach((block) => {
    const blockStart = new Date(block.startsAt).getTime();
    const blockEnd = getVisualBlockEndMs(block);
    if (currentCluster.length === 0 || blockStart < currentClusterEnd) {
      currentCluster.push(block);
      currentClusterEnd = Math.max(currentClusterEnd, blockEnd);
      return;
    }

    clusters.push(currentCluster);
    currentCluster = [block];
    currentClusterEnd = blockEnd;
  });

  if (currentCluster.length > 0) {
    clusters.push(currentCluster);
  }

  return clusters.flatMap((cluster) => {
    const laneEnds: number[] = [];
    const assignedBlocks = cluster.map((block) => {
      const blockStart = new Date(block.startsAt).getTime();
      const blockEnd = getVisualBlockEndMs(block);
      const reusableLane = laneEnds.findIndex((laneEnd) => laneEnd <= blockStart);
      const laneIndex = reusableLane === -1 ? laneEnds.length : reusableLane;
      laneEnds[laneIndex] = blockEnd;
      return { block, laneIndex };
    });
    const laneCount = Math.max(1, laneEnds.length);

    return assignedBlocks.map(({ block, laneIndex }) => {
      const overlappingLaneCount = assignedBlocks.reduce(
        (count, assignedBlock) =>
          doBlocksOverlap(block, assignedBlock.block)
            ? Math.max(count, assignedBlock.laneIndex + 1)
            : count,
        laneIndex + 1,
      );
      const width = 100 / Math.max(laneCount, overlappingLaneCount);
      const horizontalInset = laneCount > 1 ? 5 : 16;

      return {
        block,
        isCompact: laneCount > 1,
        originalBlock:
          allBlocks.find((currentBlock) => currentBlock.id === block.id) ??
          block,
        layoutStyle: {
          left: `calc(${laneIndex * width}% + ${laneCount > 1 ? 4 : 8}px)`,
          right: "auto",
          width: `calc(${width}% - ${horizontalInset}px)`,
          zIndex: 2 + laneIndex,
        } as CSSProperties,
      };
    });
  });
};

type WeekViewProps = {
  date: Date;
  blocks: TimeBlock[];
  categories: Category[];
  defaultCategoryId: string;
  visibleEndHour: number;
  visibleStartHour: number;
  weekStartDay: WeekStartDay;
  timeZone: string;
  timeZones: string[];
  selectedBlockId?: string;
  selectedBlockIds: string[];
  selectedTaskId?: string;
  tasks: Task[];
  onSelectBlock: (blockId?: string, additive?: boolean) => void;
  onCreateBlockSelection: (block: CreateTimeBlockInput) => void;
  onSelectTask: (taskId: string) => void;
  onShiftDays: (days: number) => void;
  onToggleTask: (taskId: string) => void | Promise<void>;
  onUpdateBlock: (block: TimeBlock) => void | Promise<void>;
};

function WeekView({
  date,
  blocks,
  categories,
  defaultCategoryId,
  visibleEndHour,
  visibleStartHour,
  weekStartDay,
  timeZone,
  timeZones,
  selectedBlockId,
  selectedBlockIds,
  selectedTaskId,
  tasks,
  onSelectBlock,
  onCreateBlockSelection,
  onSelectTask,
  onShiftDays,
  onToggleTask,
  onUpdateBlock,
}: WeekViewProps) {
  const horizontalScrollIntent = useRef(0);
  const allDayRowRef = useRef<HTMLDivElement>(null);
  const horizontalScrollResetTimeout = useRef<number>();
  const [draggedBlock, setDraggedBlock] = useState<
    { blockId: string; pointerOffsetY: number } | undefined
  >();
  const [resizingBlock, setResizingBlock] = useState<
    | {
        block: TimeBlock;
        day: Date;
        edge: ResizeEdge;
        pointerId: number;
        columnTop: number;
        previewBlock: TimeBlock;
      }
    | undefined
  >();
  const [dropTargetDate, setDropTargetDate] = useState<string | undefined>();
  const [selection, setSelection] = useState<
    | {
        columnTop: number;
        endAbsoluteMinute: number;
        pointerId: number;
        startAbsoluteMinute: number;
        startDayIndex: number;
      }
    | undefined
  >();
  const [allDaySelection, setAllDaySelection] = useState<
    | {
        endDayIndex: number;
        pointerId: number;
        startDayIndex: number;
      }
    | undefined
  >();
  const [allDayResize, setAllDayResize] = useState<
    | {
        block: TimeBlock;
        dayIndex: number;
        edge: AllDayResizeEdge;
        pointerId: number;
      }
    | undefined
  >();
  const [timeZoneWarning, setTimeZoneWarning] = useState<string>();
  const weekDays = getWeekDays(date, weekStartDay);
  const hours = getCalendarHours(visibleStartHour, visibleEndHour);
  const today = toZonedCalendarDate(new Date(), timeZone);
  const orderedTimeZones = [
    ...timeZones.filter((currentTimeZone) => currentTimeZone !== timeZone),
    timeZone,
  ];
  const timedBlocks = blocks.filter((block) => !isAllDayBlock(block));
  const allDayPreviewBlocks = allDayResize
    ? blocks.map((block) =>
        block.id === allDayResize.block.id
          ? getResizedAllDayBlock(
              allDayResize.block,
              allDayResize.edge,
              weekDays[allDayResize.dayIndex],
              timeZone,
            )
          : block,
      )
    : blocks;
  const allDaySegments = getAllDaySegments(
    allDayPreviewBlocks.filter(isAllDayBlock),
    weekDays,
    timeZone,
  );
  const dueTasksByDay = weekDays.map((day) =>
    tasks
      .filter(
        (task) =>
          task.dueDate && isSameCalendarDay(new Date(task.dueDate), day),
      )
      .sort(
        (firstTask, secondTask) =>
          Number(isTaskComplete(firstTask)) - Number(isTaskComplete(secondTask)) ||
          firstTask.title.localeCompare(secondTask.title),
      ),
  );
  const allDayLaneCount = Math.max(
    1,
    ...allDaySegments.map((segment) => segment.laneIndex + 1),
  );
  const allDayVisibleLaneCount = allDayLaneCount + (allDaySelection ? 1 : 0);
  const showTimeZoneWarning = () =>
    setTimeZoneWarning(
      "That wall time is invalid or ambiguous because of a DST transition. Use Advanced Edit to choose an exact occurrence.",
    );
  const getAllDayColumnIndexFromPoint = useCallback((clientX: number) => {
    const rowBounds = allDayRowRef.current?.getBoundingClientRect();
    if (!rowBounds || clientX < rowBounds.left || clientX > rowBounds.right) {
      return undefined;
    }

    const rawIndex = Math.floor(
      ((clientX - rowBounds.left) / rowBounds.width) * weekDays.length,
    );
    return clamp(rawIndex, 0, weekDays.length - 1);
  }, [weekDays.length]);

  useEffect(() => {
    if (!resizingBlock) {
      return;
    }

    const handlePointerMove = (event: globalThis.PointerEvent) => {
      if (event.pointerId !== resizingBlock.pointerId) {
        return;
      }

      const minuteOfDay = getMinuteFromClientY(
        event.clientY,
        resizingBlock.columnTop,
        visibleStartHour,
        visibleEndHour,
      );
      setResizingBlock((currentResize) =>
        currentResize
          ? {
              ...currentResize,
              previewBlock: getResizedBlock(
                currentResize.block,
                currentResize.edge,
                currentResize.day,
                minuteOfDay,
                timeZone,
              ) ?? currentResize.previewBlock,
            }
          : undefined,
      );
    };

    const handlePointerUp = (event: globalThis.PointerEvent) => {
      if (event.pointerId !== resizingBlock.pointerId) {
        return;
      }

      const minuteOfDay = getMinuteFromClientY(
        event.clientY,
        resizingBlock.columnTop,
        visibleStartHour,
        visibleEndHour,
      );
      const resizedBlock = getResizedBlock(
        resizingBlock.block,
        resizingBlock.edge,
        resizingBlock.day,
        minuteOfDay,
        timeZone,
      );
      setResizingBlock(undefined);
      if (resizedBlock) {
        void onUpdateBlock(resizedBlock);
      } else {
        showTimeZoneWarning();
      }
    };

    const handlePointerCancel = (event: globalThis.PointerEvent) => {
      if (event.pointerId === resizingBlock.pointerId) {
        setResizingBlock(undefined);
      }
    };

    document.body.classList.add("calendar-resizing");
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerCancel);

    return () => {
      document.body.classList.remove("calendar-resizing");
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
    };
  }, [onUpdateBlock, resizingBlock, timeZone, visibleEndHour, visibleStartHour]);

  useEffect(
    () => () => {
      if (horizontalScrollResetTimeout.current) {
        window.clearTimeout(horizontalScrollResetTimeout.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!allDayResize) {
      return;
    }

    const handlePointerMove = (event: globalThis.PointerEvent) => {
      if (event.pointerId !== allDayResize.pointerId) {
        return;
      }

      const dayIndex = getAllDayColumnIndexFromPoint(event.clientX);
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
        weekDays[allDayResize.dayIndex],
        timeZone,
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
  }, [allDayResize, getAllDayColumnIndexFromPoint, onUpdateBlock, timeZone, weekDays]);

  const handleDragStart = (blockId: string, pointerOffsetY: number) => {
    if (resizingBlock) {
      return;
    }

    setDraggedBlock({ blockId, pointerOffsetY });
  };

  const handleDragEnd = () => {
    setDraggedBlock(undefined);
    setDropTargetDate(undefined);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>, day: Date) => {
    if (!draggedBlock) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropTargetDate(day.toISOString());
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (
      event.relatedTarget instanceof Node &&
      event.currentTarget.contains(event.relatedTarget)
    ) {
      return;
    }

    setDropTargetDate(undefined);
  };

  const handleDrop = async (event: DragEvent<HTMLDivElement>, day: Date) => {
    event.preventDefault();
    const block = timedBlocks.find(
      (currentBlock) => currentBlock.id === draggedBlock?.blockId,
    );
    if (!draggedBlock || !block) {
      handleDragEnd();
      return;
    }

    const columnBounds = event.currentTarget.getBoundingClientRect();
    const blockTop =
      event.clientY - columnBounds.top - draggedBlock.pointerOffsetY;
    const durationMinutes = getBlockDurationMinutes(block);
    const visibleStartMinute = visibleStartHour * 60;
    const visibleEndMinute = (visibleEndHour + 1) * 60;
    const latestStartMinute = Math.max(
      visibleStartMinute,
      visibleEndMinute - durationMinutes,
    );
    const droppedMinute = clamp(
      visibleStartMinute + getSnappedMinutesFromTop(blockTop),
      visibleStartMinute,
      latestStartMinute,
    );
    const droppedDate = getDroppedDate(
      day,
      droppedMinute,
      durationMinutes,
      timeZone,
    );
    if (!droppedDate) {
      showTimeZoneWarning();
      handleDragEnd();
      return;
    }
    const { startsAt, endsAt } = droppedDate;

    try {
      await onUpdateBlock({
        ...block,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        timeZone,
      });
    } finally {
      handleDragEnd();
    }
  };

  const handlePointerDown = (
    event: PointerEvent<HTMLDivElement>,
    dayIndex: number,
  ) => {
    if (
      draggedBlock ||
      resizingBlock ||
      event.button !== 0 ||
      isCalendarBlockTarget(event.target)
    ) {
      return;
    }

    const startMinute = getMinuteFromPointer(
      event,
      visibleStartHour,
      visibleEndHour,
    );
    const startAbsoluteMinute = dayIndex * 24 * 60 + startMinute;
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelection({
      columnTop: event.currentTarget.getBoundingClientRect().top,
      endAbsoluteMinute: startAbsoluteMinute,
      pointerId: event.pointerId,
      startAbsoluteMinute,
      startDayIndex: dayIndex,
    });
  };

  const handleDoubleClick = (
    event: MouseEvent<HTMLDivElement>,
    day: Date,
  ) => {
    if (isCalendarBlockTarget(event.target)) {
      return;
    }

    const minuteOfDay = getMinuteFromClientY(
      event.clientY,
      event.currentTarget.getBoundingClientRect().top,
      visibleStartHour,
      visibleEndHour,
    );
    const visibleEndMinute = (visibleEndHour + 1) * 60;
    const startMinute = clamp(
      minuteOfDay,
      visibleStartHour * 60,
      Math.max(
        visibleStartHour * 60,
        visibleEndMinute - defaultCreatedBlockMinutes,
      ),
    );
    const droppedDate = getDroppedDate(
      day,
      startMinute,
      defaultCreatedBlockMinutes,
      timeZone,
    );
    if (!droppedDate) {
      showTimeZoneWarning();
      return;
    }
    const { startsAt, endsAt } = droppedDate;

    onSelectBlock(undefined);
    onCreateBlockSelection({
      title: "",
      notes: "",
      categoryId: defaultCategoryId,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      timeZone,
    });
  };

  const handleAllDayDoubleClick = (
    event: MouseEvent<HTMLDivElement>,
    day: Date,
  ) => {
    if (
      event.target instanceof HTMLElement &&
      event.target.closest(".all-day-chip")
    ) {
      return;
    }

    const startsAt = resolveCalendarMinute(day, 0, timeZone);
    const endsAt = resolveCalendarMinute(addCalendarDays(day, 1), 0, timeZone);
    if (startsAt.status !== "valid" || endsAt.status !== "valid") {
      showTimeZoneWarning();
      return;
    }

    onSelectBlock(undefined);
    onCreateBlockSelection({
      title: "",
      notes: "",
      categoryId: defaultCategoryId,
      startsAt: startsAt.date.toISOString(),
      endsAt: endsAt.date.toISOString(),
      isAllDay: true,
      recurrenceFrequency: "none",
      timeZone,
    });
  };

  const getAllDaySelectionBounds = () => {
    if (!allDaySelection) {
      return undefined;
    }

    return {
      start: Math.min(
        allDaySelection.startDayIndex,
        allDaySelection.endDayIndex,
      ),
      end: Math.max(
        allDaySelection.startDayIndex,
        allDaySelection.endDayIndex,
      ),
    };
  };

  const createAllDayDraft = (startDayIndex: number, endDayIndex: number) => {
    const rangeStart = Math.min(startDayIndex, endDayIndex);
    const rangeEnd = Math.max(startDayIndex, endDayIndex);
    const startsAt = resolveCalendarMinute(weekDays[rangeStart], 0, timeZone);
    const endsAt = resolveCalendarMinute(
      addCalendarDays(weekDays[rangeEnd], 1),
      0,
      timeZone,
    );
    if (startsAt.status !== "valid" || endsAt.status !== "valid") {
      showTimeZoneWarning();
      return;
    }

    onSelectBlock(undefined);
    onCreateBlockSelection({
      title: "",
      notes: "",
      categoryId: defaultCategoryId,
      startsAt: startsAt.date.toISOString(),
      endsAt: endsAt.date.toISOString(),
      isAllDay: true,
      recurrenceFrequency: "none",
      timeZone,
    });
  };

  const handleAllDayPointerDown = (
    event: PointerEvent<HTMLDivElement>,
    dayIndex: number,
  ) => {
    if (
      allDayResize ||
      event.button !== 0 ||
      (event.target instanceof HTMLElement &&
        event.target.closest(".all-day-chip"))
    ) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    setAllDaySelection({
      endDayIndex: dayIndex,
      pointerId: event.pointerId,
      startDayIndex: dayIndex,
    });
  };

  const handleAllDayPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!allDaySelection || event.pointerId !== allDaySelection.pointerId) {
      return;
    }

    const dayIndex = getAllDayColumnIndexFromPoint(event.clientX);
    if (dayIndex === undefined) {
      return;
    }

    setAllDaySelection({ ...allDaySelection, endDayIndex: dayIndex });
  };

  const handleAllDayPointerCancel = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerId === allDaySelection?.pointerId) {
      setAllDaySelection(undefined);
    }
  };

  const handleAllDayPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!allDaySelection || event.pointerId !== allDaySelection.pointerId) {
      return;
    }

    const { startDayIndex, endDayIndex } = allDaySelection;
    setAllDaySelection(undefined);
    if (startDayIndex === endDayIndex) {
      return;
    }

    createAllDayDraft(startDayIndex, endDayIndex);
  };

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
    setAllDaySelection(undefined);
    setAllDayResize({
      block,
      dayIndex,
      edge,
      pointerId: event.pointerId,
    });
  };

  const handleResizeStart = (
    block: TimeBlock,
    edge: ResizeEdge,
    day: Date,
    event: PointerEvent<HTMLSpanElement>,
  ) => {
    if (event.button !== 0) {
      return;
    }

    const column = event.currentTarget.closest(".week-day-column");
    if (!(column instanceof HTMLElement)) {
      return;
    }

    setDraggedBlock(undefined);
    setResizingBlock({
      block,
      day,
      edge,
      pointerId: event.pointerId,
      columnTop: column.getBoundingClientRect().top,
      previewBlock: block,
    });
  };

  const getSelectionEndAbsoluteMinute = (
    event: PointerEvent<HTMLDivElement>,
  ) => {
    if (!selection) {
      return 0;
    }

    const hoveredColumn = getWeekColumn(
      document.elementFromPoint(event.clientX, event.clientY),
    );
    const hoveredDayIndex =
      hoveredColumn?.dataset.dayIndex === undefined
        ? undefined
        : Number.parseInt(hoveredColumn.dataset.dayIndex, 10);

    if (
      hoveredColumn &&
      hoveredDayIndex !== undefined &&
      Number.isFinite(hoveredDayIndex)
    ) {
      const minuteOfDay = getMinuteFromClientY(
        event.clientY,
        hoveredColumn.getBoundingClientRect().top,
        visibleStartHour,
        visibleEndHour,
      );
      return hoveredDayIndex * 24 * 60 + minuteOfDay;
    }

    const rawMinute =
      visibleStartHour * 60 +
      getSnappedMinutesFromTop(event.clientY - selection.columnTop);
    const minimumMinute = visibleStartHour * 60;
    const maximumMinute = 24 * 60 + (visibleEndHour + 1) * 60;
    return (
      selection.startDayIndex * 24 * 60 +
      clamp(rawMinute, minimumMinute, maximumMinute)
    );
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!selection || event.pointerId !== selection.pointerId) {
      return;
    }

    setSelection({
      ...selection,
      endAbsoluteMinute: getSelectionEndAbsoluteMinute(event),
    });
  };

  const handlePointerCancel = (event: PointerEvent<HTMLDivElement>) => {
    if (selection?.pointerId === event.pointerId) {
      setSelection(undefined);
    }
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!selection || event.pointerId !== selection.pointerId) {
      return;
    }

    const endAbsoluteMinute = getSelectionEndAbsoluteMinute(event);
    const selectedStartMinute = Math.min(
      selection.startAbsoluteMinute,
      endAbsoluteMinute,
    );
    const selectedEndMinute = Math.max(
      selection.startAbsoluteMinute,
      endAbsoluteMinute,
    );
    if (selectedStartMinute === selectedEndMinute) {
      setSelection(undefined);
      onSelectBlock(undefined);
      return;
    }

    const durationMinutes =
      Math.max(dragSnapMinutes, selectedEndMinute - selectedStartMinute);
    const startsAt = getDateAtWeekMinute(
      weekDays[0],
      selectedStartMinute,
      timeZone,
    );
    if (!startsAt) {
      setSelection(undefined);
      showTimeZoneWarning();
      return;
    }
    const endsAt = new Date(startsAt.getTime() + durationMinutes * 60000);

    setSelection(undefined);
    onCreateBlockSelection({
      title: "",
      notes: "",
      categoryId: defaultCategoryId,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      timeZone,
    });
  };

  const getSelectionStyle = (dayIndex: number) => {
    if (!selection) {
      return undefined;
    }

    const startMinute = Math.min(
      selection.startAbsoluteMinute,
      selection.endAbsoluteMinute,
    );
    const endMinute =
      Math.max(selection.startAbsoluteMinute, selection.endAbsoluteMinute) ||
      startMinute + dragSnapMinutes;
    const visibleDayStartMinute = dayIndex * 24 * 60 + visibleStartHour * 60;
    const visibleDayEndMinute = dayIndex * 24 * 60 + (visibleEndHour + 1) * 60;
    const segmentStartMinute = Math.max(startMinute, visibleDayStartMinute);
    const segmentEndMinute = Math.min(endMinute, visibleDayEndMinute);

    if (segmentEndMinute <= segmentStartMinute) {
      return undefined;
    }

    return {
      top: `${((segmentStartMinute - visibleDayStartMinute) / 60) * calendarHourHeight}px`,
      height: `${Math.max(
        ((segmentEndMinute - segmentStartMinute) / 60) * calendarHourHeight,
        (dragSnapMinutes / 60) * calendarHourHeight,
      )}px`,
    } as CSSProperties;
  };

  const getCurrentTimeStyle = (day: Date) => {
    if (!isSameCalendarDay(day, today)) {
      return undefined;
    }

    const currentMinute = today.getHours() * 60 + today.getMinutes();
    const visibleStartMinute = visibleStartHour * 60;
    const visibleEndMinute = (visibleEndHour + 1) * 60;
    if (
      currentMinute < visibleStartMinute ||
      currentMinute > visibleEndMinute
    ) {
      return undefined;
    }

    return {
      top: `${((currentMinute - visibleStartMinute) / 60) * calendarHourHeight}px`,
    } as CSSProperties;
  };

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (
      draggedBlock ||
      resizingBlock ||
      selection ||
      allDaySelection ||
      allDayResize
    ) {
      return;
    }

    const horizontalDelta = event.shiftKey ? event.deltaY : event.deltaX;
    const isHorizontalIntent =
      event.shiftKey || Math.abs(horizontalDelta) > Math.abs(event.deltaY) * 1.2;
    if (!isHorizontalIntent || horizontalDelta === 0) {
      horizontalScrollIntent.current = 0;
      return;
    }

    event.preventDefault();
    horizontalScrollIntent.current += horizontalDelta;

    if (horizontalScrollResetTimeout.current) {
      window.clearTimeout(horizontalScrollResetTimeout.current);
    }
    horizontalScrollResetTimeout.current = window.setTimeout(() => {
      horizontalScrollIntent.current = 0;
    }, horizontalWeekScrollResetMs);

    const daysToShift =
      horizontalScrollIntent.current > 0
        ? Math.floor(horizontalScrollIntent.current / horizontalDayScrollThreshold)
        : Math.ceil(horizontalScrollIntent.current / horizontalDayScrollThreshold);
    if (daysToShift === 0) {
      return;
    }

    horizontalScrollIntent.current -=
      daysToShift * horizontalDayScrollThreshold;
    onShiftDays(daysToShift);
  };
  const getSecondaryHourLabel = (secondaryTimeZone: string, hour: number) => {
    const resolution = resolveCalendarMinute(weekDays[0], hour * 60, timeZone);
    return resolution.status === "valid"
      ? toTimeInputValue(toZonedCalendarDate(resolution.date, secondaryTimeZone))
      : "--:--";
  };
  const getSecondaryShiftNote = (secondaryTimeZone: string) => {
    let previousRelativeOffset: number | undefined;
    for (const day of weekDays) {
      const resolution = resolveCalendarMinute(day, 12 * 60, timeZone);
      if (resolution.status !== "valid") {
        continue;
      }
      const relativeOffset =
        getTimeZoneOffsetMinutes(resolution.date, secondaryTimeZone) -
        getTimeZoneOffsetMinutes(resolution.date, timeZone);
      if (
        previousRelativeOffset !== undefined &&
        previousRelativeOffset !== relativeOffset
      ) {
        return `DST shift ${formatDayLabel(day)}`;
      }
      previousRelativeOffset = relativeOffset;
    }
    return undefined;
  };

  return (
    <div
      className="calendar-board week-board"
      onWheel={handleWheel}
      style={{
        "--calendar-hours": hours.length,
        "--timezone-rails": orderedTimeZones.length,
        "--timezone-rail-width": `${56 + (orderedTimeZones.length - 1) * 46}px`,
      } as CSSProperties}
    >
      {timeZoneWarning ? (
        <div className="calendar-timezone-warning">
          <span>{timeZoneWarning}</span>
          <button onClick={() => setTimeZoneWarning(undefined)} type="button">
            Dismiss
          </button>
        </div>
      ) : null}
      <div className="week-header-spacer">
        <div className="timezone-rail-headers">
          {orderedTimeZones.map((railTimeZone) => {
            const shiftNote =
              railTimeZone === timeZone
                ? undefined
                : getSecondaryShiftNote(railTimeZone);
            return (
              <div
                className={`timezone-rail-header${
                  railTimeZone === timeZone ? " primary" : ""
                }`}
                key={railTimeZone}
                title={railTimeZone}
              >
                <strong>{getTimeZoneLabel(railTimeZone)}</strong>
                {shiftNote ? <small>{shiftNote}</small> : null}
              </div>
            );
          })}
        </div>
      </div>
      <div className="week-header">
        {weekDays.map((day) => (
          <div
            className={`week-day-heading${
              isSameCalendarDay(day, today) ? " today" : ""
            }`}
            key={day.toISOString()}
          >
            {formatDayLabel(day)}
          </div>
        ))}
      </div>

      <div className="week-all-day-label">All day</div>
      <div
        className="week-all-day-row"
        ref={allDayRowRef}
        style={
          {
            "--all-day-lanes": allDayVisibleLaneCount,
          } as CSSProperties
        }
      >
        {weekDays.map((day, dayIndex) => {
          const allDaySelectionBounds = getAllDaySelectionBounds();
          const isInAllDaySelection =
            allDaySelectionBounds &&
            dayIndex >= allDaySelectionBounds.start &&
            dayIndex <= allDaySelectionBounds.end;

          return (
            <div
              className={`week-all-day-column${
                isInAllDaySelection ? " selecting" : ""
              }`}
              data-day-index={dayIndex}
              key={day.toISOString()}
              style={{
                gridColumn: dayIndex + 1,
                gridRow: `1 / span ${allDayVisibleLaneCount}`,
              }}
              onDoubleClick={(event) => handleAllDayDoubleClick(event, day)}
              onPointerCancel={handleAllDayPointerCancel}
              onPointerDown={(event) => handleAllDayPointerDown(event, dayIndex)}
              onPointerMove={handleAllDayPointerMove}
              onPointerUp={handleAllDayPointerUp}
            />
          );
        })}
        {allDaySelection ? (
          <div
            className="all-day-selection-preview"
            style={{
              gridColumn: `${
                Math.min(
                  allDaySelection.startDayIndex,
                  allDaySelection.endDayIndex,
                ) + 1
              } / ${
                Math.max(
                  allDaySelection.startDayIndex,
                  allDaySelection.endDayIndex,
                ) + 2
              }`,
              gridRow: `${allDayLaneCount + 1}`,
            }}
          />
        ) : null}
        {allDaySegments.map((segment) => {
          const category = findCategoryById(categories, segment.block.categoryId);
          const colors = getCategoryColorValues(category?.color);
          const segmentStartsAtBlockStart = isSameCalendarDay(
            toZonedCalendarDate(segment.block.startsAt, timeZone),
            weekDays[segment.startIndex],
          );
          const segmentEndsAtBlockEnd = isSameCalendarDay(
            addCalendarDays(getAllDayEndDate(segment.block, timeZone), -1),
            weekDays[segment.endIndex],
          );
          return (
            <button
              className={`all-day-chip${
                selectedBlockId === segment.block.id ||
                selectedBlockIds.includes(segment.block.id)
                  ? " selected"
                  : ""
              } outcome-${segment.block.outcome} kind-${segment.block.kind}${
                segment.block.taskId ? " linked-task" : ""
              }`}
              key={segment.block.id}
              onClick={(event) =>
                onSelectBlock(segment.block.id, event.shiftKey)
              }
              onDoubleClick={(event) => event.stopPropagation()}
              style={
                {
                  "--all-day-accent": colors.accent,
                  "--all-day-background": colors.background,
                  "--all-day-border": colors.border,
                  gridColumn: `${segment.startIndex + 1} / ${segment.endIndex + 2}`,
                  gridRow: `${segment.laneIndex + 1}`,
                } as CSSProperties
              }
              title={segment.block.title}
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

      <div className="week-due-task-label">Due</div>
      <div className="week-due-task-row">
        {dueTasksByDay.map((dayTasks, dayIndex) => (
          <div
            className="week-due-task-column"
            key={weekDays[dayIndex].toISOString()}
          >
            {dayTasks.map((task) => {
              const isComplete = isTaskComplete(task);
              return (
                <button
                  className={`week-due-task-chip${
                    selectedTaskId === task.id ? " selected" : ""
                  }${isComplete ? " complete" : ""}`}
                  key={task.id}
                  onClick={() => onSelectTask(task.id)}
                  title={task.title}
                  type="button"
                >
                  <input
                    aria-label={`Mark ${task.title} ${
                      isComplete ? "incomplete" : "complete"
                    }`}
                    checked={isComplete}
                    onChange={() => void onToggleTask(task.id)}
                    onClick={(event) => event.stopPropagation()}
                    type="checkbox"
                  />
                  <span>{task.title}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="hour-label-rails" aria-hidden="true">
        {orderedTimeZones.map((railTimeZone) => (
          <div
            className={`hour-labels${railTimeZone === timeZone ? " primary" : ""}`}
            key={railTimeZone}
          >
            {hours.map((hour) => (
              <div className="hour-label" key={hour}>
                {railTimeZone === timeZone
                  ? formatHour(hour)
                  : getSecondaryHourLabel(railTimeZone, hour)}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="week-grid">
        {weekDays.map((day, dayIndex) => (
          <div
            className={`week-day-column${
              dropTargetDate === day.toISOString() ? " drop-target" : ""
            }`}
            data-day-index={dayIndex}
            key={day.toISOString()}
            onDragLeave={handleDragLeave}
            onDragOver={(event) => handleDragOver(event, day)}
            onDoubleClick={(event) => handleDoubleClick(event, day)}
            onDrop={(event) => void handleDrop(event, day)}
            onPointerCancel={handlePointerCancel}
            onPointerDown={(event) => handlePointerDown(event, dayIndex)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            <div className="hour-grid">
              {hours.map((hour) => (
                <div className="hour-row" key={hour} />
              ))}
            </div>

            <div className="block-layer">
              {getCurrentTimeStyle(day) ? (
                <div
                  aria-hidden="true"
                  className="current-time-line"
                  style={getCurrentTimeStyle(day)}
                />
              ) : null}
              {getSelectionStyle(dayIndex) ? (
                <div
                  className="calendar-selection-preview"
                  style={getSelectionStyle(dayIndex)}
                />
              ) : null}
              {getLaidOutBlocks(
                getBlocksForDay(timedBlocks, day, timeZone).map((block) =>
                  resizingBlock?.previewBlock.id === block.id
                    ? (getBlocksForDay([resizingBlock.previewBlock], day, timeZone)[0] ??
                      block)
                    : block,
                ),
                timedBlocks,
              ).map(({ block, isCompact, layoutStyle, originalBlock }) => {
                return (
                  <CalendarBlock
                    block={block}
                    canResizeEnd={originalBlock.endsAt === block.endsAt}
                    canResizeStart={originalBlock.startsAt === block.startsAt}
                    categories={categories}
                    isCompact={isCompact}
                    isDragging={draggedBlock?.blockId === block.id}
                    isSelected={
                      selectedBlockId === block.id ||
                      selectedBlockIds.includes(block.id)
                    }
                    key={block.id}
                    layoutStyle={layoutStyle}
                    onDragEnd={handleDragEnd}
                    onDragStart={handleDragStart}
                    onResizeStart={(_, edge, event) =>
                      handleResizeStart(originalBlock, edge, day, event)
                    }
                    onSelectBlock={onSelectBlock}
                    visibleStartHour={visibleStartHour}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default WeekView;
