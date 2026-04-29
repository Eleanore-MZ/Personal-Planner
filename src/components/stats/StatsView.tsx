import { useState } from "react";
import type { Category, Task, TimeBlock } from "../../types/domain";
import CategoryHoursChart from "./CategoryHoursChart";
import DailyPlannedHoursChart from "./DailyPlannedHoursChart";
import TaskCompletionChart from "./TaskCompletionChart";

type StatsViewProps = {
  categories: Category[];
  tasks: Task[];
  timeBlocks: TimeBlock[];
};

type RangeId = "week" | "month" | "custom";

function StatsView({ categories, tasks, timeBlocks }: StatsViewProps) {
  const [range, setRange] = useState<RangeId>("week");

  return (
    <div className="stats-view">
      <section className="stats-toolbar">
        <div>
          <div className="panel-kicker">Analytics</div>
          <h2>Planning insights</h2>
          <p>Fake-data analytics from task and calendar samples.</p>
        </div>

        <div className="range-switcher" aria-label="Stats date range">
          {(["week", "month", "custom"] as RangeId[]).map((item) => (
            <button
              className={range === item ? "active" : ""}
              key={item}
              onClick={() => setRange(item)}
              type="button"
            >
              {item}
            </button>
          ))}
        </div>
      </section>

      <div className="stats-grid">
        <CategoryHoursChart categories={categories} timeBlocks={timeBlocks} />
        <DailyPlannedHoursChart timeBlocks={timeBlocks} />
        <TaskCompletionChart tasks={tasks} />
      </div>
    </div>
  );
}

export default StatsView;

