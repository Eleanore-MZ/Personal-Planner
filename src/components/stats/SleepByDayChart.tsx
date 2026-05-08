import type { DailyHoursDatum } from "../../utils/stats";

type SleepByDayChartProps = {
  data: DailyHoursDatum[];
};

const referenceHours = 8;

function SleepByDayChart({ data }: SleepByDayChartProps) {
  const maxHours = Math.max(...data.map((day) => day.hours), referenceHours, 1);
  const hasData = data.some((day) => day.hours > 0);
  const referenceBottom = (referenceHours / maxHours) * 100;

  return (
    <section className="stats-card sleep-by-day-card">
      <div className="stats-card-header">
        <div>
          <div className="panel-kicker">Sleep rhythm</div>
          <h2>Sleep by day</h2>
        </div>
      </div>

      {data.length > 0 ? (
        <>
          <div className="sleep-chart">
            <div
              className="sleep-reference-line"
              style={{ bottom: `${referenceBottom}%` }}
            >
              <span>8h</span>
            </div>
            {data.map((day) => (
              <div className="sleep-chart-column" key={day.date}>
                <div className="sleep-bar-wrap">
                  <div
                    className="sleep-bar"
                    style={{ height: `${(day.hours / maxHours) * 100}%` }}
                    title={`Day ${day.label}\nSleep: ${day.hours.toFixed(1)}h`}
                  />
                </div>
                <strong>{day.hours > 0 ? `${day.hours.toFixed(1)}h` : "0"}</strong>
                <span>{day.label}</span>
              </div>
            ))}
          </div>
          {!hasData ? (
            <div className="empty-state sleep-empty-state">
              No sleep blocks logged for this month.
            </div>
          ) : null}
        </>
      ) : (
        <div className="empty-state">
          No days available for this month.
        </div>
      )}
    </section>
  );
}

export default SleepByDayChart;
