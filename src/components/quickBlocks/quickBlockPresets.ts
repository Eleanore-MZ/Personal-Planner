import { useCallback, useEffect, useState } from "react";
import type { TimeBlockKind } from "../../types/domain";

export type QuickBlockPreset = {
  id: string;
  title: string;
  categoryId: string;
  kind: TimeBlockKind;
  sortOrder: number;
};

const quickBlockPresetsKey = "planner:quickBlockPresets";

export const quickBlockKindOptions: Array<{
  value: TimeBlockKind;
  label: string;
}> = [
  { value: "event", label: "Event" },
  { value: "task-session", label: "Task session" },
  { value: "habit", label: "Habit" },
  { value: "routine", label: "Routine" },
];

const isTimeBlockKind = (value: unknown): value is TimeBlockKind =>
  quickBlockKindOptions.some((option) => option.value === value);

const createQuickBlockPresetId = () =>
  `quick-block-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const normalizeQuickBlockPresets = (presets: QuickBlockPreset[]) =>
  [...presets]
    .sort((first, second) => first.sortOrder - second.sortOrder)
    .map((preset, index) => ({
      ...preset,
      sortOrder: index,
    }));

const isQuickBlockPreset = (value: unknown): value is QuickBlockPreset => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const preset = value as Partial<QuickBlockPreset>;
  return (
    typeof preset.id === "string" &&
    typeof preset.title === "string" &&
    typeof preset.categoryId === "string" &&
    isTimeBlockKind(preset.kind) &&
    typeof preset.sortOrder === "number" &&
    Number.isFinite(preset.sortOrder)
  );
};

const readQuickBlockPresets = () => {
  try {
    const storedPresets = localStorage.getItem(quickBlockPresetsKey);
    if (!storedPresets) {
      return [];
    }

    const parsedPresets = JSON.parse(storedPresets) as unknown;
    if (!Array.isArray(parsedPresets)) {
      return [];
    }

    return normalizeQuickBlockPresets(
      parsedPresets.filter(isQuickBlockPreset),
    );
  } catch {
    return [];
  }
};

const writeQuickBlockPresets = (presets: QuickBlockPreset[]) => {
  try {
    localStorage.setItem(
      quickBlockPresetsKey,
      JSON.stringify(normalizeQuickBlockPresets(presets)),
    );
  } catch {
    // Quick block preferences are best-effort local UI state.
  }
};

export function createQuickBlockPreset(
  categoryId: string,
  sortOrder: number,
): QuickBlockPreset {
  return {
    id: createQuickBlockPresetId(),
    title: "New block",
    categoryId,
    kind: "event",
    sortOrder,
  };
}

export function useQuickBlockPresets() {
  const [presets, setPresets] = useState<QuickBlockPreset[]>(() =>
    readQuickBlockPresets(),
  );

  const savePresets = useCallback((nextPresets: QuickBlockPreset[]) => {
    const normalizedPresets = normalizeQuickBlockPresets(nextPresets);
    setPresets(normalizedPresets);
    writeQuickBlockPresets(normalizedPresets);
  }, []);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === quickBlockPresetsKey) {
        setPresets(readQuickBlockPresets());
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  return { presets, savePresets };
}
