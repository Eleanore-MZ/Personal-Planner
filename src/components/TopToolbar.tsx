import { calendarViews } from "../data/navigation";
import type { CalendarView } from "../types/app";
import type { AppSettings } from "../types/app";
import { useState } from "react";
import TimeZoneManager from "./TimeZoneManager";
import { getTimeZoneLabel } from "../utils/timezone";

type TopToolbarProps = {
  activeView: CalendarView;
  dateTitle: string;
  onNext: () => void;
  onPrevious: () => void;
  onToday: () => void;
  onSelectView: (view: CalendarView) => void;
  onOpenCommandPalette: () => void;
  onUpdateSettings: (settings: AppSettings) => void;
  settings: AppSettings;
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
  onUpdateSettings,
  settings,
  showViewSwitcher = true,
}: TopToolbarProps) {
  const [isManagingTimeZones, setIsManagingTimeZones] = useState(false);

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

      <div className="timezone-toolbar">
        <div className="timezone-chip-list" aria-label="Calendar timezone">
          {settings.calendarTimeZones.map((timeZone) => (
            <button
              className={`timezone-chip${
                timeZone === settings.primaryCalendarTimeZone ? " active" : ""
              }`}
              key={timeZone}
              onClick={() =>
                onUpdateSettings({
                  ...settings,
                  primaryCalendarTimeZone: timeZone,
                })
              }
              title={timeZone}
              type="button"
            >
              {getTimeZoneLabel(timeZone)}
            </button>
          ))}
        </div>
        <button
          className="toolbar-button"
          onClick={() => setIsManagingTimeZones((isOpen) => !isOpen)}
          type="button"
        >
          Zones
        </button>
        {isManagingTimeZones ? (
          <div className="timezone-toolbar-popover">
            <TimeZoneManager
              compact
              onChange={(calendarTimeZones, primaryCalendarTimeZone) =>
                onUpdateSettings({
                  ...settings,
                  calendarTimeZones,
                  primaryCalendarTimeZone,
                })
              }
              primaryTimeZone={settings.primaryCalendarTimeZone}
              timeZones={settings.calendarTimeZones}
            />
          </div>
        ) : null}
      </div>

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
