import { useState } from "react";
import type { Category } from "../../types/domain";
import type { CreateCategoryInput } from "../../types/plannerApi";
import { getCategoryAccentColor } from "../../utils/calendar";

type CategoryDialogProps = {
  category?: Category;
  onClose: () => void;
  onCreateCategory: (input: CreateCategoryInput) => void | Promise<void>;
  onUpdateCategory: (input: Category) => void | Promise<void>;
  onDeleteCategory: (categoryId: string) => void | Promise<void>;
};

function CategoryDialog({
  category,
  onClose,
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory,
}: CategoryDialogProps) {
  const initialColor = getCategoryAccentColor(category?.color ?? "#22d3ee");
  const [name, setName] = useState(category?.name ?? "");
  const [description, setDescription] = useState(category?.description ?? "");
  const [color, setColor] = useState(initialColor);

  const handleColorTextChange = (value: string) => {
    if (/^#[0-9a-f]{0,6}$/i.test(value)) {
      setColor(value);
    }
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName || !/^#[0-9a-f]{6}$/i.test(color)) {
      return;
    }

    if (category) {
      await onUpdateCategory({
        ...category,
        name: trimmedName,
        description,
        color,
      });
    } else {
      await onCreateCategory({
        name: trimmedName,
        description,
        color,
      });
    }

    onClose();
  };

  const handleDelete = async () => {
    if (!category) {
      return;
    }

    await onDeleteCategory(category.id);
    onClose();
  };

  return (
    <div className="dialog-backdrop" role="presentation">
      <section
        aria-label={category ? "Edit Category" : "New Category"}
        className="fake-dialog"
      >
        <div className="fake-dialog-header">
          <div>
            <div className="panel-kicker">Category</div>
            <h2>{category ? "Edit Category" : "New Category"}</h2>
          </div>
          <button className="icon-button" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <div className="dialog-form-grid">
          <label>
            <span>Name</span>
            <input
              onChange={(event) => setName(event.target.value)}
              value={name}
            />
          </label>
          <label>
            <span>Color</span>
            <div className="category-color-inputs">
              <input
                aria-label="Category color"
                onChange={(event) => setColor(event.target.value)}
                type="color"
                value={/^#[0-9a-f]{6}$/i.test(color) ? color : "#22d3ee"}
              />
              <input
                aria-label="Category color hex value"
                maxLength={7}
                onChange={(event) => handleColorTextChange(event.target.value)}
                value={color}
              />
            </div>
          </label>
          <label className="dialog-wide-field">
            <span>Description</span>
            <textarea
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              value={description}
            />
          </label>
        </div>

        <div className="fake-dialog-actions">
          {category ? (
            <button
              className="toolbar-button danger-action"
              onClick={handleDelete}
              type="button"
            >
              Delete
            </button>
          ) : null}
          <button className="toolbar-button" onClick={onClose} type="button">
            Cancel
          </button>
          <button
            className="toolbar-button primary-action"
            onClick={handleSave}
            type="button"
          >
            Save Category
          </button>
        </div>
      </section>
    </div>
  );
}

export default CategoryDialog;
