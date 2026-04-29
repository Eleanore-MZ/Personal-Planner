import type { CSSProperties } from "react";
import type { Task } from "../../types/domain";
import { getTaskCompletionStats } from "../../utils/stats";

type TaskCompletionChartProps = {
  tasks: Task[];
};

function TaskCompletionChart({ tasks }: TaskCompletionChartProps) {
  const stats = getTaskCompletionStats(tasks);
  const completedPercent =
    stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  return (
    <section className="stats-card completion-card">
      <div>
        <div className="panel-kicker">Task completion</div>
        <h2>{completedPercent}% complete</h2>
        <p>
          {stats.completed} completed, {stats.open} still open
        </p>
      </div>

      <div
        className="stats-donut"
        style={{ "--progress": `${completedPercent}%` } as CSSProperties}
      >
        <span>{completedPercent}%</span>
      </div>
    </section>
  );
}

export default TaskCompletionChart;
