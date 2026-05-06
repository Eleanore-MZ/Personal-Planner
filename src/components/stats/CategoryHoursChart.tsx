import type { CategoryHoursDatum } from "../../utils/stats";

type CategoryHoursChartProps = {
  data: CategoryHoursDatum[];
  kicker?: string;
  title?: string;
};

function CategoryHoursChart({
  data,
  kicker = "Category hours",
  title = "Normal time by category",
}: CategoryHoursChartProps) {
  const maxHours = Math.max(...data.map((item) => item.hours), 1);

  return (
    <section className="stats-card">
      <div className="stats-card-header">
        <div>
          <div className="panel-kicker">{kicker}</div>
          <h2>{title}</h2>
        </div>
      </div>

      {data.some((category) => category.hours > 0) ? (
        <div className="horizontal-chart">
          {data.map((category) => (
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
        <div className="empty-state">
          No time block hours match the selected period and filters.
        </div>
      )}
    </section>
  );
}

export default CategoryHoursChart;
