import type { DailyHoursDatum } from "../../utils/stats";

type SleepByDayChartProps = {
  ariaLabel?: string;
  data: DailyHoursDatum[];
  emptyMessage?: string;
  kicker?: string;
  pointLabelPrefix?: string;
  title?: string;
};

const chartWidth = 720;
const chartHeight = 220;
const chartPadding = {
  bottom: 34,
  left: 42,
  right: 18,
  top: 16,
};
const referenceHours = 8;

function buildLineSegments(points: Array<DailyHoursDatum & { x: number; y: number }>) {
  const segments: Array<Array<DailyHoursDatum & { x: number; y: number }>> = [];
  let currentSegment: Array<DailyHoursDatum & { x: number; y: number }> = [];

  points.forEach((point) => {
    if (point.hours > 0) {
      currentSegment.push(point);
      return;
    }

    if (currentSegment.length > 0) {
      segments.push(currentSegment);
      currentSegment = [];
    }
  });

  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }

  return segments;
}

function SleepByDayChart({
  ariaLabel = "Sleep hours by day of month",
  data,
  emptyMessage = "No sleep blocks logged for this month.",
  kicker = "Sleep rhythm",
  pointLabelPrefix = "Day",
  title = "Sleep by day",
}: SleepByDayChartProps) {
  const maxHours = Math.max(...data.map((day) => day.hours), referenceHours, 1);
  const hasData = data.some((day) => day.hours > 0);
  const plotWidth = chartWidth - chartPadding.left - chartPadding.right;
  const plotHeight = chartHeight - chartPadding.top - chartPadding.bottom;
  const baselineY = chartHeight - chartPadding.bottom;
  const points = data.map((day, index) => {
    const x =
      chartPadding.left +
      (index / Math.max(data.length - 1, 1)) * plotWidth;
    const y = baselineY - (day.hours / maxHours) * plotHeight;
    return { ...day, x, y };
  });
  const lineSegments = buildLineSegments(points);
  const referenceY = baselineY - (referenceHours / maxHours) * plotHeight;
  const yAxisLabels = [maxHours, referenceHours, 0].filter(
    (hours, index, labels) => labels.indexOf(hours) === index,
  );
  const labeledPoints = points.filter((point, index) => {
    const lastIndex = points.length - 1;
    const numericLabel = Number(point.label);
    return (
      index === 0 ||
      index === lastIndex ||
      (Number.isFinite(numericLabel) ? numericLabel % 7 === 0 : true)
    );
  });

  return (
    <section className="stats-card sleep-by-day-card">
      <div className="stats-card-header">
        <div>
          <div className="panel-kicker">{kicker}</div>
          <h2>{title}</h2>
        </div>
      </div>

      {data.length > 0 ? (
        <>
          {hasData ? (
            <div className="sleep-line-chart">
              <svg
                aria-label={ariaLabel}
                role="img"
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              >
                <defs>
                  <linearGradient id="sleep-area-fill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="currentColor" stopOpacity="0.24" />
                    <stop offset="100%" stopColor="currentColor" stopOpacity="0.03" />
                  </linearGradient>
                </defs>

                {yAxisLabels.map((hours) => {
                  const y = baselineY - (hours / maxHours) * plotHeight;
                  return (
                    <g className="sleep-axis-row" key={hours}>
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

                <line
                  className="sleep-reference-line"
                  x1={chartPadding.left}
                  x2={chartWidth - chartPadding.right}
                  y1={referenceY}
                  y2={referenceY}
                />
                <text
                  className="sleep-reference-label"
                  x={chartWidth - chartPadding.right}
                  y={referenceY - 6}
                >
                  8h
                </text>

                {lineSegments.map((segment) => {
                  const linePath = segment
                    .map(
                      (point, index) =>
                        `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`,
                    )
                    .join(" ");
                  const areaPath =
                    segment.length > 0
                      ? `M ${segment[0].x} ${baselineY} ${segment
                          .map((point) => `L ${point.x} ${point.y}`)
                          .join(" ")} L ${segment[segment.length - 1].x} ${baselineY} Z`
                      : "";

                  return (
                    <g key={`${segment[0].date}-${segment[segment.length - 1].date}`}>
                      <path className="sleep-area-fill" d={areaPath} />
                      <path className="sleep-line" d={linePath} />
                    </g>
                  );
                })}

                {points
                  .filter((point) => point.hours > 0)
                  .map((point) => (
                    <circle
                      className="sleep-point"
                      cx={point.x}
                      cy={point.y}
                      key={point.date}
                      r="3"
                    >
                      <title>
                        {pointLabelPrefix} {point.label}: {point.hours.toFixed(1)}h sleep
                      </title>
                    </circle>
                  ))}

                {labeledPoints.map((point) => (
                  <text
                    className="sleep-axis-label"
                    key={point.date}
                    textAnchor="middle"
                    x={point.x}
                    y={chartHeight - 9}
                  >
                    {point.label}
                  </text>
                ))}
              </svg>
            </div>
          ) : (
            <div className="empty-state sleep-empty-state">
              {emptyMessage}
            </div>
          )}
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
