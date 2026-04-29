import {
  formatDayLabel,
  formatHour,
  calendarHourHeight,
  getBlocksForDay,
  getCalendarHours,
  getWeekDays,
  isSameCalendarDay,
} from "../../utils/calendar";
import type { Category, TimeBlock } from "../../types/domain";
import type { WeekStartDay } from "../../types/app";
import type { CreateTimeBlockInput } from "../../types/plannerApi";
import CalendarBlock from "./CalendarBlock";
import {
  useEffect,
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
) => {
  const startsAt = new Date(day);
  startsAt.setHours(
    Math.floor(startMinuteOfDay / 60),
    startMinuteOfDay % 60,
    0,
    0,
  );

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

const getDateAtMinute = (day: Date, minuteOfDay: number) => {
  const date = new Date(day);
  date.setHours(Math.floor(minuteOfDay / 60), minuteOfDay % 60, 0, 0);
  return date;
};

const getDateAtWeekMinute = (weekStart: Date, absoluteMinute: number) => {
  const dayOffset = Math.floor(absoluteMinute / (24 * 60));
  const minuteOfDay = absoluteMinute - dayOffset * 24 * 60;
  const date = new Date(weekStart);
  date.setDate(date.getDate() + dayOffset);
  date.setHours(Math.floor(minuteOfDay / 60), minuteOfDay % 60, 0, 0);
  return date;
};

const getResizedBlock = (
  block: TimeBlock,
  edge: ResizeEdge,
  day: Date,
  minuteOfDay: number,
) => {
  const startsAt = new Date(block.startsAt);
  const endsAt = new Date(block.endsAt);
  const candidate = getDateAtMinute(day, minuteOfDay);
  const minimumDurationMs = dragSnapMinutes * 60000;

  if (edge === "start") {
    const latestStart = new Date(endsAt.getTime() - minimumDurationMs);
    return {
      ...block,
      startsAt: new Date(
        Math.min(candidate.getTime(), latestStart.getTime()),
      ).toISOString(),
    };
  }

  const earliestEnd = new Date(startsAt.getTime() + minimumDurationMs);
  return {
    ...block,
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

const doBlocksOverlap = (firstBlock: TimeBlock, secondBlock: TimeBlock) =>
  new Date(firstBlock.startsAt).getTime() <
    new Date(secondBlock.endsAt).getTime() &&
  new Date(secondBlock.startsAt).getTime() <
    new Date(firstBlock.endsAt).getTime();

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
    const blockEnd = new Date(block.endsAt).getTime();
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
      const blockEnd = new Date(block.endsAt).getTime();
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
  selectedBlockId?: string;
  onSelectBlock: (blockId?: string) => void;
  onCreateBlockSelection: (block: CreateTimeBlockInput) => void;
  onShiftDays: (days: number) => void;
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
  selectedBlockId,
  onSelectBlock,
  onCreateBlockSelection,
  onShiftDays,
  onUpdateBlock,
}: WeekViewProps) {
  const horizontalScrollIntent = useRef(0);
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
  const weekDays = getWeekDays(date, weekStartDay);
  const hours = getCalendarHours(visibleStartHour, visibleEndHour);
  const today = new Date();

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
              ),
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
      );
      setResizingBlock(undefined);
      void onUpdateBlock(resizedBlock);
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
  }, [onUpdateBlock, resizingBlock, visibleEndHour, visibleStartHour]);

  useEffect(
    () => () => {
      if (horizontalScrollResetTimeout.current) {
        window.clearTimeout(horizontalScrollResetTimeout.current);
      }
    },
    [],
  );

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
    const block = blocks.find(
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
    const { startsAt, endsAt } = getDroppedDate(
      day,
      droppedMinute,
      durationMinutes,
    );

    try {
      await onUpdateBlock({
        ...block,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
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
    const { startsAt, endsAt } = getDroppedDate(
      day,
      startMinute,
      defaultCreatedBlockMinutes,
    );

    onSelectBlock(undefined);
    onCreateBlockSelection({
      title: "",
      notes: "",
      categoryId: defaultCategoryId,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
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
    const startsAt = getDateAtWeekMinute(weekDays[0], selectedStartMinute);
    const endsAt = new Date(startsAt.getTime() + durationMinutes * 60000);

    setSelection(undefined);
    onCreateBlockSelection({
      title: "",
      notes: "",
      categoryId: defaultCategoryId,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
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
      selection
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

  return (
    <div
      className="calendar-board week-board"
      onWheel={handleWheel}
      style={{ "--calendar-hours": hours.length } as CSSProperties}
    >
      <div className="week-header-spacer" />
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

      <div className="hour-labels" aria-hidden="true">
        {hours.map((hour) => (
          <div className="hour-label" key={hour}>
            {formatHour(hour)}
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
                getBlocksForDay(blocks, day).map((block) =>
                  resizingBlock?.previewBlock.id === block.id
                    ? (getBlocksForDay([resizingBlock.previewBlock], day)[0] ??
                      block)
                    : block,
                ),
                blocks,
              ).map(({ block, isCompact, layoutStyle, originalBlock }) => {
                return (
                  <CalendarBlock
                    block={block}
                    canResizeEnd={originalBlock.endsAt === block.endsAt}
                    canResizeStart={originalBlock.startsAt === block.startsAt}
                    categories={categories}
                    isCompact={isCompact}
                    isDragging={draggedBlock?.blockId === block.id}
                    isSelected={selectedBlockId === block.id}
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
