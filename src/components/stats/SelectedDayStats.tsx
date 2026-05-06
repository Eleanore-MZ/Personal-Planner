import type { YearHeatmapDay } from "../../utils/stats";
import { formatDate } from "../../utils/date";

type SelectedDayStatsProps = {
  day?: YearHeatmapDay;
};

function SelectedDayStats({ day }: SelectedDayStatsProps) {
  return (
    <section className="stats-card selected-day-stats">
      <div className="stats-card-header">
        <div>
          <div className="panel-kicker">Selected day</div>
          <h2>{day ? formatDate(day.date) : "No day selected"}</h2>
        </div>
      </div>
      {day ? (
        <div className="stats-detail-grid">
          <div className="info-row compact">
            <span>Normal hours</span>
            <strong>{day.activeHours.toFixed(1)}h</strong>
          </div>
          <div className="info-row compact">
            <span>Abandoned hours</span>
            <strong>{day.abandonedHours.toFixed(1)}h</strong>
          </div>
          <div className="info-row compact">
            <span>Pomodoro focus hours</span>
            <strong>{day.pomodoroHours.toFixed(1)}h</strong>
          </div>
          <div className="info-row compact">
            <span>Completed tasks</span>
            <strong>{day.completedTasks}</strong>
          </div>
          <div className="info-row compact">
            <span>Due tasks</span>
            <strong>{day.dueTasks}</strong>
          </div>
          <div className="info-row compact">
            <span>Overdue tasks</span>
            <strong>{day.overdueTasks}</strong>
          </div>
          <div className="info-row compact">
            <span>Top category</span>
            <strong>{day.topCategoryName ?? "None"}</strong>
          </div>
        </div>
      ) : (
        <div className="empty-state">Select a day in the heatmap.</div>
      )}
    </section>
  );
}

export default SelectedDayStats;
