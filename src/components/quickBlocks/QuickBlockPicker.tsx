import { useState, type CSSProperties, type DragEvent } from "react";
import type { Category } from "../../types/domain";
import { getCategoryColorValues } from "../../utils/calendar";
import {
  createQuickBlockPreset,
  quickBlockKindOptions,
  type QuickBlockPreset,
  useQuickBlockPresets,
} from "./quickBlockPresets";

type QuickBlockPickerProps = {
  categories: Category[];
  disabled?: boolean;
  onApplyPreset: (preset: QuickBlockPreset) => void;
};

type DropPlacement = "before" | "after";

const getPresetCategory = (preset: QuickBlockPreset, categories: Category[]) =>
  categories.find((category) => category.id === preset.categoryId);

const getPresetDisplayTitle = (preset: QuickBlockPreset) =>
  preset.title.trim() || "Untitled block";

function QuickBlockPicker({
  categories,
  disabled = false,
  onApplyPreset,
}: QuickBlockPickerProps) {
  const { presets, savePresets } = useQuickBlockPresets();
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [draggingPresetId, setDraggingPresetId] = useState<string>();
  const [dragTarget, setDragTarget] = useState<{
    presetId: string;
    placement: DropPlacement;
  }>();

  const updatePreset = (
    presetId: string,
    input: Partial<QuickBlockPreset>,
  ) => {
    savePresets(
      presets.map((preset) =>
        preset.id === presetId ? { ...preset, ...input } : preset,
      ),
    );
  };

  const addPreset = () => {
    savePresets([
      ...presets,
      createQuickBlockPreset(categories[0]?.id ?? "", presets.length),
    ]);
  };

  const deletePreset = (presetId: string) => {
    savePresets(presets.filter((preset) => preset.id !== presetId));
  };

  const getDropPlacement = (event: DragEvent<HTMLElement>): DropPlacement => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return event.clientY < bounds.top + bounds.height / 2 ? "before" : "after";
  };

  const resetDragState = () => {
    setDraggingPresetId(undefined);
    setDragTarget(undefined);
  };

  const reorderPreset = (
    presetId: string,
    targetPresetId: string,
    placement: DropPlacement,
  ) => {
    if (presetId === targetPresetId) {
      return;
    }

    const currentIndex = presets.findIndex((preset) => preset.id === presetId);
    const targetIndex = presets.findIndex(
      (preset) => preset.id === targetPresetId,
    );
    if (currentIndex === -1 || targetIndex === -1) {
      return;
    }

    const nextPresets = [...presets];
    const [movedPreset] = nextPresets.splice(currentIndex, 1);
    const adjustedTargetIndex =
      currentIndex < targetIndex ? targetIndex - 1 : targetIndex;
    const insertIndex =
      placement === "after" ? adjustedTargetIndex + 1 : adjustedTargetIndex;
    nextPresets.splice(insertIndex, 0, movedPreset);
    savePresets(
      nextPresets.map((preset, index) => ({
        ...preset,
        sortOrder: index,
      })),
    );
  };

  return (
    <section className="quick-block-panel">
      <div className="quick-block-header">
        <div>
          <div className="mini-label">Quick blocks</div>
        </div>
        <button
          className="toolbar-button"
          onClick={() => setIsConfigOpen(true)}
          type="button"
        >
          Config
        </button>
      </div>

      {presets.length > 0 ? (
        <div className="quick-block-chip-list">
          {presets.map((preset) => {
            const category = getPresetCategory(preset, categories);
            const colors = getCategoryColorValues(category?.color);
            const canApply = Boolean(category) && !disabled;
            const presetTitle = getPresetDisplayTitle(preset);
            return (
              <button
                aria-label={
                  category
                    ? `Apply quick block ${presetTitle}, ${category.name}`
                    : `${presetTitle} has a missing category`
                }
                className="quick-block-chip"
                disabled={!canApply}
                key={preset.id}
                onClick={() =>
                  onApplyPreset({
                    ...preset,
                    title: presetTitle,
                  })
                }
                style={
                  {
                    "--quick-block-accent": colors.accent,
                    "--quick-block-background": colors.background,
                    "--quick-block-border": colors.border,
                  } as CSSProperties
                }
                type="button"
              >
                <span aria-hidden="true" />
                <strong>{presetTitle}</strong>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="detail-meta">
          No quick blocks yet.
        </div>
      )}

      {isConfigOpen ? (
        <div className="dialog-backdrop" role="presentation">
          <section
            aria-label="Quick block configuration"
            className="fake-dialog quick-block-dialog"
          >
            <div className="fake-dialog-header">
              <div>
                <div className="panel-kicker">Quick blocks</div>
                <h2>Configure quick blocks</h2>
              </div>
              <button
                className="icon-button"
                onClick={() => setIsConfigOpen(false)}
                type="button"
              >
                Close
              </button>
            </div>

            <div className="quick-block-config-list">
              {presets.map((preset) => {
                const category = getPresetCategory(preset, categories);
                const presetTitle = getPresetDisplayTitle(preset);
                const isDragging = draggingPresetId === preset.id;
                const dropClass =
                  dragTarget?.presetId === preset.id
                    ? ` drag-over-${dragTarget.placement}`
                    : "";
                return (
                  <div
                    className={`quick-block-config-row${isDragging ? " dragging" : ""}${dropClass}`}
                    key={preset.id}
                    onDragLeave={(event) => {
                      if (
                        !event.currentTarget.contains(
                          event.relatedTarget as Node | null,
                        )
                      ) {
                        setDragTarget(undefined);
                      }
                    }}
                    onDragOver={(event) => {
                      if (!draggingPresetId || draggingPresetId === preset.id) {
                        return;
                      }

                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                      setDragTarget({
                        presetId: preset.id,
                        placement: getDropPlacement(event),
                      });
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      const draggedPresetId =
                        draggingPresetId ||
                        event.dataTransfer.getData("text/plain");
                      if (draggedPresetId && draggedPresetId !== preset.id) {
                        reorderPreset(
                          draggedPresetId,
                          preset.id,
                          getDropPlacement(event),
                        );
                      }
                      resetDragState();
                    }}
                  >
                    <button
                      aria-label={`Drag ${presetTitle} to reorder`}
                      className="quick-block-drag-handle"
                      draggable
                      onDragEnd={resetDragState}
                      onDragStart={(event) => {
                        setDraggingPresetId(preset.id);
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", preset.id);
                      }}
                      type="button"
                    >
                      ::
                    </button>
                    <input
                      aria-label={`${presetTitle} title`}
                      onChange={(event) =>
                        updatePreset(preset.id, {
                          title: event.target.value,
                        })
                      }
                      placeholder="Quick block"
                      value={preset.title}
                    />
                    <select
                      aria-label={`${presetTitle} category`}
                      onChange={(event) =>
                        updatePreset(preset.id, {
                          categoryId: event.target.value,
                        })
                      }
                      value={preset.categoryId}
                    >
                      {!category && preset.categoryId ? (
                        <option disabled value={preset.categoryId}>
                          Missing category
                        </option>
                      ) : null}
                      {!preset.categoryId ? (
                        <option disabled value="">
                          {categories.length === 0
                            ? "No categories"
                            : "Select category"}
                        </option>
                      ) : null}
                      {categories.map((currentCategory) => (
                        <option
                          key={currentCategory.id}
                          value={currentCategory.id}
                        >
                          {currentCategory.name}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label={`${presetTitle} block type`}
                      onChange={(event) =>
                        updatePreset(preset.id, {
                          kind: event.target.value as QuickBlockPreset["kind"],
                        })
                      }
                      value={preset.kind}
                    >
                      {quickBlockKindOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <button
                      className="toolbar-button danger-action quick-block-delete-action"
                      onClick={() => deletePreset(preset.id)}
                      type="button"
                    >
                      Delete
                    </button>
                  </div>
                );
              })}

              {presets.length === 0 ? (
                <div className="empty-state">
                  No quick block presets yet.
                </div>
              ) : null}
            </div>

            <div className="fake-dialog-actions">
              <button
                className="toolbar-button"
                onClick={addPreset}
                type="button"
              >
                Add quick block
              </button>
              <button
                className="toolbar-button primary-action"
                onClick={() => setIsConfigOpen(false)}
                type="button"
              >
                Done
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

export default QuickBlockPicker;
