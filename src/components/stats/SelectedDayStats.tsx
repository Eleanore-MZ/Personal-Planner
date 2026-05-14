import type { YearHeatmapDay } from "../../utils/stats";
import { formatDate } from "../../utils/date";

type SelectedDayStatsProps = {
  day?: YearHeatmapDay;
  mode?: "selected" | "preview";
};

function SelectedDayStats({ day, mode = "selected" }: SelectedDayStatsProps) {
  return (
    <section className="selected-day-stats">
      <div className="selected-day-stats-header">
        <div>
          <div className="panel-kicker">
            {mode === "preview" ? "Preview day" : "Selected day"}
          </div>
          <h3>{day ? formatDate(day.date) : "Select a day"}</h3>
        </div>
      </div>
      {day ? (
        <div className="selected-day-metrics">
          <div className="selected-day-metric">
            <span>Productive time</span>
            <strong>{day.productiveHours.toFixed(1)}h</strong>
          </div>
          <div className="selected-day-metric">
            <span>Tracked time</span>
            <strong>{day.trackedHours.toFixed(1)}h</strong>
          </div>
          <div className="selected-day-metric">
            <span>Sleep time</span>
            <strong>{day.sleepHours.toFixed(1)}h</strong>
          </div>
          <div className="selected-day-metric">
            <span>Abandoned time</span>
            <strong>{day.abandonedHours.toFixed(1)}h</strong>
          </div>
          <div className="selected-day-metric">
            <span>Top Stats Group</span>
            <strong>{day.topStatsGroupName ?? "None"}</strong>
          </div>
          <div className="selected-day-metric">
            <span>Top category</span>
            <strong>{day.topCategoryName ?? "None"}</strong>
          </div>
        </div>
      ) : (
        <div className="empty-state">Select a day to inspect it.</div>
      )}
    </section>
  );
}

export default SelectedDayStats;
