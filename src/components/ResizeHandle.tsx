import type { PointerEvent } from "react";

type ResizeHandleProps = {
  active: boolean;
  label: string;
  onDoubleClick: () => void;
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  side: "left" | "right";
};

function ResizeHandle({
  active,
  label,
  onDoubleClick,
  onPointerDown,
  side,
}: ResizeHandleProps) {
  return (
    <div
      aria-label={label}
      className={`resize-handle resize-handle-${side}${active ? " active" : ""}`}
      onDoubleClick={onDoubleClick}
      onPointerDown={onPointerDown}
      role="separator"
      tabIndex={0}
      title="Drag to resize. Double-click to reset."
    />
  );
}

export default ResizeHandle;
