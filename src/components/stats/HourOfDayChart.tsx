import type { HourOfDayDatum, TimeOfDayDatum } from "../../utils/stats";

type HourOfDayChartProps = {
  data: HourOfDayDatum[];
  emptyMessage?: string;
  metricLabel: string;
  summaries: TimeOfDayDatum[];
  title: string;
};

const labeledHours = new Set([0, 6, 12, 18, 23]);
const chartWidth = 720;
const chartHeight = 220;
const chartPadding = {
  bottom: 34,
  left: 42,
  right: 18,
  top: 16,
};

function HourOfDayChart({
  data,
  emptyMessage = "No hourly tracked time for this period.",
  metricLabel,
  summaries,
  title,
}: HourOfDayChartProps) {
  const maxHours = Math.max(...data.map((hour) => hour.hours), 1);
  const hasData = data.some((hour) => hour.hours > 0);
  const plotWidth = chartWidth - chartPadding.left - chartPadding.right;
  const plotHeight = chartHeight - chartPadding.top - chartPadding.bottom;
  const baselineY = chartHeight - chartPadding.bottom;
  const peakHour = data.reduce(
    (peak, hour) => (hour.hours > peak.hours ? hour : peak),
    data[0] ?? { hour: 0, hours: 0, label: "00:00" },
  );
  const points = data.map((hour, index) => {
    const x =
      chartPadding.left +
      (index / Math.max(data.length - 1, 1)) * plotWidth;
    const y = baselineY - (hour.hours / maxHours) * plotHeight;
    return { ...hour, x, y };
  });
  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const areaPath =
    points.length > 0
      ? `M ${points[0].x} ${baselineY} ${points
          .map((point) => `L ${point.x} ${point.y}`)
          .join(" ")} L ${points[points.length - 1].x} ${baselineY} Z`
      : "";
  const yAxisLabels = [maxHours, maxHours / 2, 0];

  return (
    <section className="stats-card hour-of-day-card">
      <div className="stats-card-header">
        <div>
          <div className="panel-kicker">Hourly rhythm</div>
          <h2>{title}</h2>
        </div>
      </div>

      {hasData ? (
        <>
          <div className="hour-area-chart">
            <svg
              aria-label={`${metricLabel} time by hour of day`}
              role="img"
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            >
              <defs>
                <linearGradient id="hour-area-fill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="currentColor" stopOpacity="0.03" />
                </linearGradient>
              </defs>

              {yAxisLabels.map((hours) => {
                const y = baselineY - (hours / maxHours) * plotHeight;
                return (
                  <g className="hour-axis-row" key={hours}>
                    <line
                      x1={chartPadding.left}
                      x2={chartWidth - chartPadding.right}
                      y1={y}
                      y2={y}
                    />
                    <text x={chartPadding.left - 10} y={y + 4}>
                      {hours > 0 ? `${hours.toFixed(1)}h` : "0h"}
                    </text>
                  </g>
                );
              })}

              <path className="hour-area-fill" d={areaPath} />
              <path className="hour-area-line" d={linePath} />

              {points
                .filter((point) => point.hours > 0)
                .map((point) => (
                  <circle
                    className={
                      point.hour === peakHour.hour
                        ? "hour-area-point peak"
                        : "hour-area-point"
                    }
                    cx={point.x}
                    cy={point.y}
                    key={point.hour}
                    r={point.hour === peakHour.hour ? 4 : 2.5}
                  />
                ))}

              {points
                .filter((point) => labeledHours.has(point.hour))
                .map((point) => (
                  <text
                    className="hour-axis-label"
                    key={point.hour}
                    textAnchor="middle"
                    x={point.x}
                    y={chartHeight - 9}
                  >
                    {point.label}
                  </text>
                ))}
            </svg>
          </div>

          <div className="time-of-day-summary">
            {summaries.map((summary) => (
              <div className="time-of-day-item" key={summary.id}>
                <span>{summary.name}</span>
                <strong>{summary.hours.toFixed(1)}h</strong>
                <small>
                  {summary.label} - {Math.round(summary.percent)}%
                </small>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="empty-state">{emptyMessage}</div>
      )}
    </section>
  );
}

export default HourOfDayChart;
