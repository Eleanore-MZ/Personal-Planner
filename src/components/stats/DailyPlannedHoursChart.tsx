export type PlannedHoursDatum = {
  label: string;
  hours: number;
};

type DailyPlannedHoursChartProps = {
  data: PlannedHoursDatum[];
  emptyMessage?: string;
  highlightMax?: boolean;
  kicker?: string;
  title?: string;
};

function DailyPlannedHoursChart({
  data,
  emptyMessage = "No block time for this period under the current filters.",
  highlightMax = false,
  kicker = "Daily plan",
  title = "Planned hours this week",
}: DailyPlannedHoursChartProps) {
  const maxHours = Math.max(...data.map((item) => item.hours), 1);
  const hasData = data.some((item) => item.hours > 0);

  return (
    <section className="stats-card">
      <div className="stats-card-header">
        <div>
          <div className="panel-kicker">{kicker}</div>
          <h2>{title}</h2>
        </div>
      </div>

      {hasData ? (
        <div className="vertical-chart">
          {data.map((day, index) => (
            <div
              className={`vertical-chart-column${
                highlightMax && day.hours === maxHours ? " busiest" : ""
              }`}
              key={`${day.label}-${index}`}
            >
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
      ) : (
        <div className="empty-state">{emptyMessage}</div>
      )}
    </section>
  );
}

export default DailyPlannedHoursChart;
