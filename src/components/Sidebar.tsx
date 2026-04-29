import { navItems } from "../data/navigation";
import type { CSSProperties } from "react";
import type { NavItemId } from "../types/app";
import type { Category } from "../types/domain";
import { getCategoryColorValues } from "../utils/calendar";

type SidebarProps = {
  activeItem: NavItemId;
  categories: Category[];
  selectedCalendarCategoryId?: string;
  onSelectItem: (item: NavItemId) => void;
  onSelectCalendarCategory: (categoryId: string) => void;
};

function Sidebar({
  activeItem,
  categories,
  selectedCalendarCategoryId,
  onSelectItem,
  onSelectCalendarCategory,
}: SidebarProps) {
  return (
    <aside className="sidebar" aria-label="Primary navigation">
      <div className="brand">
        <div className="brand-mark" aria-hidden="true">
          P
        </div>
        <div>
          <div className="brand-title">Planner</div>
          <div className="brand-subtitle">Local calendar app</div>
        </div>
      </div>

      <nav className="nav">
        {navItems.map((item) => (
          <button
            className={`nav-item${activeItem === item.id ? " active" : ""}`}
            key={item.id}
            onClick={() => onSelectItem(item.id)}
            type="button"
          >
            <span className="nav-glyph" aria-hidden="true" />
            {item.label}
          </button>
        ))}
      </nav>

      {activeItem === "calendar" ? (
        <section className="sidebar-category-panel" aria-label="Calendar category defaults">
          <div className="mini-label">Default category</div>
          <div className="sidebar-category-list">
            {categories.map((category) => {
              const colors = getCategoryColorValues(category.color);
              return (
                <button
                  className={`sidebar-category-item${
                    selectedCalendarCategoryId === category.id ? " active" : ""
                  }`}
                  key={category.id}
                  onClick={() => onSelectCalendarCategory(category.id)}
                  style={
                    {
                      "--sidebar-category-accent": colors.accent,
                      "--sidebar-category-background": colors.background,
                      "--sidebar-category-border": colors.border,
                    } as CSSProperties
                  }
                  type="button"
                >
                  <span className="sidebar-category-swatch" aria-hidden="true" />
                  <span>{category.name}</span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      <div className="sidebar-footer">
        <div>
          <div className="mini-label">Local workspace</div>
          <div className="mini-date">Phase 1 shell</div>
        </div>
        <button
          aria-label="Settings"
          className={`settings-icon-button${
            activeItem === "settings" ? " active" : ""
          }`}
          onClick={() => onSelectItem("settings")}
          title="Settings"
          type="button"
        >
          <span aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
