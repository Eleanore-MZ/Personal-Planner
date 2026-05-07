import type { CategoryHoursDatum } from "../../utils/stats";

type CategoryHoursChartProps = {
  data: CategoryHoursDatum[];
  emptyMessage?: string;
  hideZeroHours?: boolean;
  kicker?: string;
  title?: string;
};

function CategoryHoursChart({
  data,
  emptyMessage = "No time block hours match the selected period and filters.",
  hideZeroHours = false,
  kicker = "Category hours",
  title = "Normal time by category",
}: CategoryHoursChartProps) {
  const chartData = hideZeroHours
    ? data.filter((category) => category.hours > 0)
    : data;
  const maxHours = Math.max(...chartData.map((item) => item.hours), 1);

  return (
    <section className="stats-card">
      <div className="stats-card-header">
        <div>
          <div className="panel-kicker">{kicker}</div>
          <h2>{title}</h2>
        </div>
      </div>

      {chartData.some((category) => category.hours > 0) ? (
        <div className="horizontal-chart">
          {chartData.map((category) => (
            <div className="chart-row" key={category.categoryId ?? "uncategorized"}>
              <div className="chart-label">
                <span
                  className="chart-swatch"
                  style={{ background: category.color }}
                />
                <span>
                  {category.categoryName}
                  {category.detail ? <small>{category.detail}</small> : null}
                </span>
              </div>
              <div className="chart-track">
                <div
                  className="chart-bar"
                  style={{
                    background: category.color,
                    width: `${(category.hours / maxHours) * 100}%`,
                  }}
                />
              </div>
              <strong>{category.hours.toFixed(1)}h</strong>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">{emptyMessage}</div>
      )}
    </section>
  );
}

export default CategoryHoursChart;
