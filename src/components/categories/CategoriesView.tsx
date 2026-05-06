import { useState } from "react";
import type { Category } from "../../types/domain";
import type { CreateCategoryInput } from "../../types/plannerApi";
import { getCategoryAccentColor } from "../../utils/calendar";
import CategoryDialog from "./CategoryDialog";

type CategoriesViewProps = {
  categories: Category[];
  onCreateCategory: (input: CreateCategoryInput) => void | Promise<void>;
  onUpdateCategory: (input: Category) => void | Promise<void>;
  onDeleteCategory: (categoryId: string) => void | Promise<void>;
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
}: CategoriesViewProps) {
  const [editingCategory, setEditingCategory] = useState<Category | undefined>();
  const [isCreating, setIsCreating] = useState(false);

  return (
    <div className="categories-view">
      <section className="category-create-panel">
        <div>
          <div className="panel-kicker">Persistent categories</div>
          <h2>Categories</h2>
          <p>Create, edit, and delete local SQLite-backed categories.</p>
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
          No visible categories yet. Create one to color-code calendar blocks and
          stats.
        </div>
      ) : (
        <div className="category-grid">
          {categories.map((category) => {
          const accentColor = getCategoryAccentColor(category.color);
          return (
            <button
              className="category-card"
              key={category.id}
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
                <span className={category.includeInStatsByDefault ? "" : "muted-pill"}>
                  {category.includeInStatsByDefault
                    ? "Included in stats"
                    : "Stats off by default"}
                </span>
              </div>
            </button>
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
