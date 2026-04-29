import type { Category, TimeBlock } from "../../types/domain";
import { getCategoryColorValues } from "../../utils/calendar";
import { getCategoryHours } from "../../utils/stats";

type CategoryHoursChartProps = {
  categories: Category[];
  timeBlocks: TimeBlock[];
};

function CategoryHoursChart({
  categories,
  timeBlocks,
}: CategoryHoursChartProps) {
  const data = getCategoryHours(categories, timeBlocks);
  const maxHours = Math.max(...data.map((item) => item.hours), 1);

  return (
    <section className="stats-card">
      <div className="stats-card-header">
        <div>
          <div className="panel-kicker">Category hours</div>
          <h2>Planned time by category</h2>
        </div>
      </div>

      <div className="horizontal-chart">
        {data.map(({ category, hours }) => {
          const colors = getCategoryColorValues(category.color);

          return (
            <div className="chart-row" key={category.id}>
              <div className="chart-label">
                <span
                  className="chart-swatch"
                  style={{ background: colors.accent }}
                />
                {category.name}
              </div>
              <div className="chart-track">
                <div
                  className="chart-bar"
                  style={{
                    background: colors.accent,
                    width: `${(hours / maxHours) * 100}%`,
                  }}
                />
              </div>
              <strong>{hours.toFixed(1)}h</strong>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default CategoryHoursChart;
