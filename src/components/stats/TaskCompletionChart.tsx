import type { TaskStatusStats } from "../../utils/stats";

type TaskCompletionChartProps = {
  emptyMessage?: string;
  stats: TaskStatusStats;
};

function TaskCompletionChart({ emptyMessage, stats }: TaskCompletionChartProps) {
  const rows = [
    { label: "Not started", value: stats.notStarted },
    { label: "In progress", value: stats.inProgress },
    { label: "Blocked", value: stats.blocked },
    { label: "Done", value: stats.done },
    { label: "Canceled", value: stats.canceled },
    { label: "Overdue", value: stats.overdue },
  ];
  const maxValue = Math.max(...rows.map((row) => row.value), 1);
  const hasData = rows.some((row) => row.value > 0);

  return (
    <section className="stats-card">
      <div className="stats-card-header">
        <div>
          <div className="panel-kicker">Task status</div>
          <h2>Status breakdown</h2>
        </div>
      </div>

      {hasData ? (
        <div className="task-status-chart">
          {rows.map((row) => (
            <div className="task-status-row" key={row.label}>
              <span>{row.label}</span>
              <div className="chart-track">
                <div
                  className="chart-bar"
                  style={{ width: `${(row.value / maxValue) * 100}%` }}
                />
              </div>
              <strong>{row.value}</strong>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          {emptyMessage ?? "No task status changes for this period."}
        </div>
      )}
    </section>
  );
}

export default TaskCompletionChart;
