import type { PressureDatum } from "../../utils/stats";

type PressureLevelChartProps = {
  ariaLabel?: string;
  data: PressureDatum[];
  emptyMessage?: string;
};

const chartWidth = 960;
const chartHeight = 240;
const chartPadding = {
  bottom: 34,
  left: 28,
  right: 8,
  top: 16,
};
const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "short" });
const dayFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
});

type ChartPoint = PressureDatum & {
  rawPressure: number;
  smoothedPressure: number;
  x: number;
  y: number;
};

type PositionedPressureDatum = PressureDatum & {
  x: number;
  y: number | null;
};

function buildSmoothPath(points: ChartPoint[]) {
  if (points.length === 0) {
    return "";
  }

  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y}`;
  }

  const segments = [`M ${points[0].x} ${points[0].y}`];

  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[Math.max(0, index - 1)];
    const current = points[index];
    const next = points[index + 1];
    const following = points[Math.min(points.length - 1, index + 2)];
    const controlOneX = current.x + (next.x - previous.x) / 6;
    const controlOneY = current.y + (next.y - previous.y) / 6;
    const controlTwoX = next.x - (following.x - current.x) / 6;
    const controlTwoY = next.y - (following.y - current.y) / 6;

    segments.push(
      `C ${controlOneX} ${controlOneY}, ${controlTwoX} ${controlTwoY}, ${next.x} ${next.y}`,
    );
  }

  return segments.join(" ");
}

function getLineSegments(points: PositionedPressureDatum[]) {
  const segments: ChartPoint[][] = [];
  let currentSegment: ChartPoint[] = [];

  points.forEach((point) => {
    if (
      point.rawPressure === null ||
      point.smoothedPressure === null ||
      point.y === null
    ) {
      if (currentSegment.length > 0) {
        segments.push(currentSegment);
        currentSegment = [];
      }

      return;
    }

    currentSegment.push({
      ...point,
      rawPressure: point.rawPressure,
      smoothedPressure: point.smoothedPressure,
      y: point.y,
    });
  });

  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }

  return segments;
}

function hasPressureValue(point: PositionedPressureDatum): point is ChartPoint {
  return (
    point.rawPressure !== null &&
    point.smoothedPressure !== null &&
    point.y !== null
  );
}

function PressureLevelChart({
  ariaLabel = "Pressure level by day",
  data,
  emptyMessage = "No task pressure data for this period.",
}: PressureLevelChartProps) {
  const maxPressure = 100;
  const hasData = data.some(
    (day) =>
      day.rawPressure !== null &&
      (day.dueLoad > 0 || day.taskWorkHours > 0 || day.recentTaskWorkHours > 0),
  );
  const plotWidth = chartWidth - chartPadding.left - chartPadding.right;
  const plotHeight = chartHeight - chartPadding.top - chartPadding.bottom;
  const baselineY = chartHeight - chartPadding.bottom;
  const points = data.map((day, index) => {
    const x =
      chartPadding.left +
      (index / Math.max(data.length - 1, 1)) * plotWidth;
    const y =
      day.smoothedPressure === null
        ? null
        : baselineY - (day.smoothedPressure / maxPressure) * plotHeight;
    return { ...day, x, y };
  });
  const lineSegments = getLineSegments(points);
  const yAxisLabels = [100, 50, 0];
  const monthLabels = points.filter((point) => new Date(point.date).getDate() === 1);
  const hoverBandWidth = plotWidth / Math.max(points.length, 1);

  return (
    <section className="stats-card pressure-level-card">
      <div className="stats-card-header">
        <div>
          <div className="panel-kicker">Workload pressure</div>
          <h2>Pressure level</h2>
        </div>
      </div>

      {hasData ? (
        <div className="pressure-line-chart">
          <svg
            aria-label={ariaLabel}
            role="img"
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          >
            <defs>
              <linearGradient id="pressure-area-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="currentColor" stopOpacity="0.24" />
                <stop offset="100%" stopColor="currentColor" stopOpacity="0.03" />
              </linearGradient>
              <linearGradient
                gradientUnits="userSpaceOnUse"
                id="pressure-line-gradient"
                x1="0"
                x2="0"
                y1={baselineY}
                y2={chartPadding.top}
              >
                <stop offset="0%" stopColor="#22d3ee" />
                <stop offset="54%" stopColor="#facc15" />
                <stop offset="100%" stopColor="#f87171" />
              </linearGradient>
            </defs>

            {yAxisLabels.map((pressure) => {
              const y = baselineY - (pressure / maxPressure) * plotHeight;
              return (
                <g className="pressure-axis-row" key={pressure}>
                  <line
                    x1={chartPadding.left}
                    x2={chartWidth - chartPadding.right}
                    y1={y}
                    y2={y}
                  />
                  <text x={chartPadding.left - 10} y={y + 4}>
                    {pressure}
                  </text>
                </g>
              );
            })}

            {lineSegments.map((segment) => {
              const linePath = buildSmoothPath(segment);
              const areaPath = `${linePath} L ${
                segment[segment.length - 1].x
              } ${baselineY} L ${segment[0].x} ${baselineY} Z`;

              return (
                <path
                  className="pressure-area-fill"
                  d={areaPath}
                  key={`area-${segment[0].date}-${segment[segment.length - 1].date}`}
                />
              );
            })}
            {lineSegments.map((segment) => (
              <path
                className="pressure-line"
                d={buildSmoothPath(segment)}
                key={`line-${segment[0].date}-${segment[segment.length - 1].date}`}
              />
            ))}

            {monthLabels.map((point) => (
              <text
                className="pressure-axis-label"
                key={point.date}
                textAnchor="middle"
                x={point.x}
                y={chartHeight - 9}
              >
                {monthFormatter.format(new Date(point.date))}
              </text>
            ))}

            {points.filter(hasPressureValue).map((point) => (
              <rect
                className="pressure-hover-target"
                height={plotHeight}
                key={point.date}
                width={hoverBandWidth}
                x={point.x - hoverBandWidth / 2}
                y={chartPadding.top}
              >
                <title>
                  {dayFormatter.format(new Date(point.date))}: pressure{" "}
                  {point.rawPressure.toFixed(0)}, smoothed{" "}
                  {point.smoothedPressure.toFixed(0)}, due load{" "}
                  {point.dueLoad.toFixed(1)}, task work{" "}
                  {point.taskWorkHours.toFixed(1)}h, overdue{" "}
                  {point.overdueTaskCount}, due within 7 days{" "}
                  {point.dueWithin7DaysCount}
                </title>
              </rect>
            ))}
          </svg>
        </div>
      ) : (
        <div className="empty-state">
          {emptyMessage}
        </div>
      )}
    </section>
  );
}

export default PressureLevelChart;
