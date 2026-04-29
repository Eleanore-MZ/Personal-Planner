import { calendarViews } from "../data/navigation";
import type { CalendarView } from "../types/app";

type TopToolbarProps = {
  activeView: CalendarView;
  dateTitle: string;
  onNext: () => void;
  onPrevious: () => void;
  onToday: () => void;
  onSelectView: (view: CalendarView) => void;
  onOpenCommandPalette: () => void;
  showViewSwitcher?: boolean;
};

function TopToolbar({
  activeView,
  dateTitle,
  onNext,
  onPrevious,
  onToday,
  onSelectView,
  onOpenCommandPalette,
  showViewSwitcher = true,
}: TopToolbarProps) {
  return (
    <header className="topbar">
      <div className="toolbar-group" aria-label="Calendar navigation">
        <button className="icon-button" onClick={onPrevious} type="button">
          Previous
        </button>
        <button className="toolbar-button" onClick={onToday} type="button">
          Today
        </button>
        <button className="icon-button" onClick={onNext} type="button">
          Next
        </button>
      </div>

      <div className="date-title">{dateTitle}</div>

      {showViewSwitcher ? (
        <div className="view-switcher" aria-label="Calendar view switcher">
          {calendarViews.map((view) => (
            <button
              className={activeView === view.id ? "active" : ""}
              key={view.id}
              onClick={() => onSelectView(view.id)}
              type="button"
            >
              {view.label}
            </button>
          ))}
        </div>
      ) : null}

      <button
        className="toolbar-button command-button"
        onClick={onOpenCommandPalette}
        type="button"
      >
        Command
      </button>
    </header>
  );
}

export default TopToolbar;
