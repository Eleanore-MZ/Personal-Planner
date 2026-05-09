import { useCallback, useEffect, useMemo, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

const LEFT_STORAGE_KEY = "planner:leftSidebarWidth";
const RIGHT_STORAGE_KEY = "planner:rightSidebarWidth";

const LEFT_DEFAULT = 260;
const LEFT_MIN = 180;
const LEFT_MAX = 420;
const RIGHT_DEFAULT = 360;
const RIGHT_MIN = 280;
const RIGHT_MAX = 560;
const CENTER_MIN = 520;

type ResizeSide = "left" | "right";

type PanelConstraints = {
  left: {
    defaultWidth: number;
    min: number;
    max: number;
  };
  right: {
    defaultWidth: number;
    min: number;
    max: number;
  };
};

const constraints: PanelConstraints = {
  left: {
    defaultWidth: LEFT_DEFAULT,
    min: LEFT_MIN,
    max: LEFT_MAX,
  },
  right: {
    defaultWidth: RIGHT_DEFAULT,
    min: RIGHT_MIN,
    max: RIGHT_MAX,
  },
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), Math.max(min, max));

const readStoredWidth = (key: string, fallback: number) => {
  const rawValue = localStorage.getItem(key);
  if (rawValue === null) {
    return fallback;
  }

  const storedValue = Number(rawValue);
  return Number.isFinite(storedValue) ? storedValue : fallback;
};

const getViewportWidth = () =>
  window.innerWidth || document.documentElement.clientWidth;

const getDynamicMax = (side: ResizeSide, otherWidth: number) => {
  const viewportWidth = getViewportWidth();
  const availableWidth = viewportWidth - otherWidth - CENTER_MIN;
  return side === "left"
    ? Math.min(LEFT_MAX, availableWidth)
    : Math.min(RIGHT_MAX, availableWidth);
};

export function useResizablePanels() {
  const [leftWidth, setLeftWidth] = useState(() =>
    clamp(readStoredWidth(LEFT_STORAGE_KEY, LEFT_DEFAULT), LEFT_MIN, LEFT_MAX),
  );
  const [rightWidth, setRightWidth] = useState(() =>
    clamp(readStoredWidth(RIGHT_STORAGE_KEY, RIGHT_DEFAULT), RIGHT_MIN, RIGHT_MAX),
  );
  const [activeResizeSide, setActiveResizeSide] = useState<ResizeSide | null>(
    null,
  );

  const setClampedLeftWidth = useCallback(
    (nextWidth: number, currentRightWidth = rightWidth) => {
      setLeftWidth(
        clamp(nextWidth, LEFT_MIN, getDynamicMax("left", currentRightWidth)),
      );
    },
    [rightWidth],
  );

  const setClampedRightWidth = useCallback(
    (nextWidth: number, currentLeftWidth = leftWidth) => {
      setRightWidth(
        clamp(nextWidth, RIGHT_MIN, getDynamicMax("right", currentLeftWidth)),
      );
    },
    [leftWidth],
  );

  useEffect(() => {
    localStorage.setItem(LEFT_STORAGE_KEY, String(Math.round(leftWidth)));
  }, [leftWidth]);

  useEffect(() => {
    localStorage.setItem(RIGHT_STORAGE_KEY, String(Math.round(rightWidth)));
  }, [rightWidth]);

  useEffect(() => {
    const handleResize = () => {
      setClampedLeftWidth(leftWidth, rightWidth);
      setClampedRightWidth(rightWidth, leftWidth);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [leftWidth, rightWidth, setClampedLeftWidth, setClampedRightWidth]);

  const startResize = useCallback(
    (side: ResizeSide) => (event: ReactPointerEvent<HTMLElement>) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      setActiveResizeSide(side);

      const handlePointerMove = (moveEvent: globalThis.PointerEvent) => {
        if (side === "left") {
          setClampedLeftWidth(moveEvent.clientX);
          return;
        }

        setClampedRightWidth(getViewportWidth() - moveEvent.clientX);
      };

      const stopResize = () => {
        setActiveResizeSide(null);
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", stopResize);
        window.removeEventListener("pointercancel", stopResize);
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", stopResize);
      window.addEventListener("pointercancel", stopResize);
    },
    [setClampedLeftWidth, setClampedRightWidth],
  );

  const resetWidth = useCallback(
    (side: ResizeSide) => {
      if (side === "left") {
        setClampedLeftWidth(LEFT_DEFAULT);
        return;
      }

      setClampedRightWidth(RIGHT_DEFAULT);
    },
    [setClampedLeftWidth, setClampedRightWidth],
  );

  return useMemo(
    () => ({
      activeResizeSide,
      constraints,
      leftWidth,
      resetWidth,
      rightWidth,
      startResize,
    }),
    [activeResizeSide, leftWidth, resetWidth, rightWidth, startResize],
  );
}
