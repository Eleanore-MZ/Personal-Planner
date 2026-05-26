import { useState, type DragEvent } from "react";
import type { Category } from "../../types/domain";
import type { CreateCategoryInput } from "../../types/plannerApi";
import { getCategoryAccentColor } from "../../utils/calendar";
import CategoryDialog from "./CategoryDialog";

type CategoriesViewProps = {
  categories: Category[];
  onCreateCategory: (input: CreateCategoryInput) => void | Promise<void>;
  onUpdateCategory: (input: Category) => void | Promise<void>;
  onDeleteCategory: (categoryId: string) => void | Promise<void>;
  onReorderCategory: (
    categoryId: string,
    targetCategoryId: string,
    placement: "before" | "after",
  ) => void;
};

const blockKindLabels: Record<Category["defaultBlockKind"], string> = {
  event: "Event",
  "task-session": "Task session",
  habit: "Habit",
  routine: "Routine",
};

function CategoriesView({
  categories,
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory,
  onReorderCategory,
}: CategoriesViewProps) {
  const [editingCategory, setEditingCategory] = useState<Category | undefined>();
  const [isCreating, setIsCreating] = useState(false);
  const [draggingCategoryId, setDraggingCategoryId] = useState<string>();
  const [dragTarget, setDragTarget] = useState<{
    categoryId: string;
    placement: "before" | "after";
  }>();

  const getDropPlacement = (
    event: DragEvent<HTMLElement>,
  ): "before" | "after" => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return event.clientY < bounds.top + bounds.height / 2 ? "before" : "after";
  };

  const resetDragState = () => {
    setDraggingCategoryId(undefined);
    setDragTarget(undefined);
  };

  return (
    <div className="categories-view">
      <section className="category-create-panel">
        <div>
          <div className="panel-kicker">Persistent categories</div>
          <h2>Categories</h2>
          <p>Manage colors, defaults, and Stats inclusion.</p>
        </div>
        <div className="category-create-form compact-action-form">
          <button
            className="toolbar-button primary-action"
            onClick={() => setIsCreating(true)}
            type="button"
          >
            New Category
          </button>
        </div>
      </section>

      {categories.length === 0 ? (
        <div className="empty-state">
          No categories yet.
        </div>
      ) : (
        <div className="category-list">
          {categories.map((category) => {
            const accentColor = getCategoryAccentColor(category.color);
            const isDragging = draggingCategoryId === category.id;
            const dropClass =
              dragTarget?.categoryId === category.id
                ? ` drag-over-${dragTarget.placement}`
                : "";
            return (
              <div
                className={`category-list-item${isDragging ? " dragging" : ""}${dropClass}`}
                key={category.id}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                    setDragTarget(undefined);
                  }
                }}
                onDragOver={(event) => {
                  if (!draggingCategoryId || draggingCategoryId === category.id) {
                    return;
                  }

                  event.preventDefault();
                  setDragTarget({
                    categoryId: category.id,
                    placement: getDropPlacement(event),
                  });
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const draggedCategoryId =
                    draggingCategoryId ||
                    event.dataTransfer.getData("text/plain");
                  if (draggedCategoryId && draggedCategoryId !== category.id) {
                    onReorderCategory(
                      draggedCategoryId,
                      category.id,
                      getDropPlacement(event),
                    );
                  }
                  resetDragState();
                }}
              >
                <button
                  aria-label={`Drag ${category.name} to reorder`}
                  className="category-drag-handle"
                  draggable
                  onDragEnd={resetDragState}
                  onDragStart={(event) => {
                    setDraggingCategoryId(category.id);
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", category.id);
                  }}
                  type="button"
                >
                  ::
                </button>
                <button
                  className="category-card"
                  onClick={() => setEditingCategory(category)}
                  type="button"
                >
                  <span
                    className="category-card-swatch"
                    style={{ background: accentColor }}
                  />
                  <h3>{category.name}</h3>
                  <p>{category.description}</p>
                  <div className="category-card-meta">
                    <span className="category-meta-pill">
                      Default: {blockKindLabels[category.defaultBlockKind]}
                    </span>
                    <span className={category.hiddenFromCalendar ? "muted-pill" : ""}>
                      {category.hiddenFromCalendar
                        ? "Hidden from calendar"
                        : "Shown on calendar"}
                    </span>
                    <span
                      className={category.includeInStatsByDefault ? "" : "muted-pill"}
                    >
                      {category.includeInStatsByDefault
                        ? "Included in stats"
                        : "Stats off by default"}
                    </span>
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {isCreating || editingCategory ? (
        <CategoryDialog
          category={editingCategory}
          onClose={() => {
            setIsCreating(false);
            setEditingCategory(undefined);
          }}
          onCreateCategory={onCreateCategory}
          onDeleteCategory={onDeleteCategory}
          onUpdateCategory={onUpdateCategory}
        />
      ) : null}
    </div>
  );
}

export default CategoriesView;
