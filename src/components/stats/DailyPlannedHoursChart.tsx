import type { TimeBlock } from "../../types/domain";
import { getDailyPlannedHours } from "../../utils/stats";

type DailyPlannedHoursChartProps = {
  timeBlocks: TimeBlock[];
};

function DailyPlannedHoursChart({ timeBlocks }: DailyPlannedHoursChartProps) {
  const data = getDailyPlannedHours(timeBlocks);
  const maxHours = Math.max(...data.map((item) => item.hours), 1);

  return (
    <section className="stats-card">
      <div className="stats-card-header">
        <div>
          <div className="panel-kicker">Daily plan</div>
          <h2>Planned hours this week</h2>
        </div>
      </div>

      <div className="vertical-chart">
        {data.map((day) => (
          <div className="vertical-chart-column" key={day.label}>
            <div className="vertical-bar-wrap">
              <div
                className="vertical-bar"
                style={{ height: `${(day.hours / maxHours) * 100}%` }}
              />
            </div>
            <strong>{day.hours.toFixed(1)}h</strong>
            <span>{day.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export default DailyPlannedHoursChart;

