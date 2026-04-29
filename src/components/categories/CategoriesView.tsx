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
            </button>
          );
        })}
      </div>

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
