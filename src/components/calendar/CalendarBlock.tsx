import type { CSSProperties, DragEvent, PointerEvent } from "react";
import { formatTime } from "../../utils/date";
import { getBlockPosition, getCategoryColorValues } from "../../utils/calendar";
import { findCategoryById } from "../../utils/categories";
import type { Category, TimeBlock } from "../../types/domain";

type CalendarBlockProps = {
  block: TimeBlock;
  categories: Category[];
  isSelected: boolean;
  isDragging?: boolean;
  isCompact?: boolean;
  canResizeEnd?: boolean;
  canResizeStart?: boolean;
  layoutStyle?: CSSProperties;
  visibleStartHour?: number;
  onSelectBlock: (blockId: string) => void;
  onDragStart?: (blockId: string, pointerOffsetY: number) => void;
  onDragEnd?: () => void;
  onResizeStart?: (
    block: TimeBlock,
    edge: "start" | "end",
    event: PointerEvent<HTMLSpanElement>,
  ) => void;
};

function CalendarBlock({
  block,
  categories,
  isSelected,
  isDragging = false,
  isCompact = false,
  canResizeEnd = false,
  canResizeStart = false,
  layoutStyle,
  visibleStartHour,
  onSelectBlock,
  onDragStart,
  onDragEnd,
  onResizeStart,
}: CalendarBlockProps) {
  const category = findCategoryById(categories, block.categoryId);
  const colors = getCategoryColorValues(category?.color);
  const position = getBlockPosition(block, visibleStartHour);
  const isPast = new Date(block.endsAt).getTime() < Date.now();
  const hasRoomForCategory = position.height >= 30;
  const style = {
    "--block-accent": colors.accent,
    "--block-background": colors.background,
    "--block-border": colors.border,
    top: `${position.top}px`,
    height: `${position.height}px`,
    ...layoutStyle,
  } as CSSProperties;

  const handleDragStart = (event: DragEvent<HTMLButtonElement>) => {
    if (
      event.target instanceof HTMLElement &&
      event.target.closest(".calendar-block-resize-handle")
    ) {
      event.preventDefault();
      return;
    }

    const blockBounds = event.currentTarget.getBoundingClientRect();
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", block.id);
    onSelectBlock(block.id);
    onDragStart?.(block.id, event.clientY - blockBounds.top);
  };

  const handleResizePointerDown = (
    event: PointerEvent<HTMLSpanElement>,
    edge: "start" | "end",
  ) => {
    event.preventDefault();
    event.stopPropagation();
    onSelectBlock(block.id);
    onResizeStart?.(block, edge, event);
  };

  return (
    <button
      className={`calendar-block${isSelected ? " selected" : ""}${
        isDragging ? " dragging" : ""
      }${isCompact ? " compact" : ""}${
        hasRoomForCategory ? "" : " short"
      }${isPast ? " past" : ""}`}
      draggable={Boolean(onDragStart)}
      onClick={() => onSelectBlock(block.id)}
      onDragEnd={onDragEnd}
      onDragStart={handleDragStart}
      style={style}
      type="button"
    >
      {canResizeStart ? (
        <span
          aria-hidden="true"
          className="calendar-block-resize-handle top"
          onPointerDown={(event) => handleResizePointerDown(event, "start")}
        />
      ) : null}
      <span className="block-title">{block.title}</span>
      <span className="block-time">
        {formatTime(block.startsAt)} - {formatTime(block.endsAt)}
      </span>
      {hasRoomForCategory ? (
        <span className="block-category">{category?.name ?? "Uncategorized"}</span>
      ) : null}
      {canResizeEnd ? (
        <span
          aria-hidden="true"
          className="calendar-block-resize-handle bottom"
          onPointerDown={(event) => handleResizePointerDown(event, "end")}
        />
      ) : null}
    </button>
  );
}

export default CalendarBlock;
