import type { PressureDatum } from "../../utils/stats";

type PressureLevelChartProps = {
  ariaLabel?: string;
  data: PressureDatum[];
  emptyMessage?: string;
  xAxisMode?: "date" | "month";
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
const referencePressure = 100;

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
  ariaLabel = "Pressure index by day",
  data,
  emptyMessage = "No task pressure data for this period.",
  xAxisMode = "month",
}: PressureLevelChartProps) {
  const visiblePressureValues = data.reduce<number[]>((values, day) => {
    if (day.rawPressure !== null) {
      values.push(day.rawPressure);
    }

    if (day.smoothedPressure !== null) {
      values.push(day.smoothedPressure);
    }

    return values;
  }, []);
  const hasData = visiblePressureValues.length > 0;
  const visibleMax = Math.max(...visiblePressureValues, 0);
  const axisMax =
    visibleMax <= 200 ? 200 : Math.ceil((visibleMax * 1.1) / 50) * 50;
  const plotWidth = chartWidth - chartPadding.left - chartPadding.right;
  const plotHeight = chartHeight - chartPadding.top - chartPadding.bottom;
  const baselineY = chartHeight - chartPadding.bottom;
  const getPressureY = (pressure: number) =>
    baselineY - (pressure / axisMax) * plotHeight;
  const yellowOffset = (referencePressure / axisMax) * 100;
  const redOffset = (200 / axisMax) * 100;
  const points = data.map((day, index) => {
    const x =
      chartPadding.left +
      (index / Math.max(data.length - 1, 1)) * plotWidth;
    const y =
      day.smoothedPressure === null
        ? null
        : getPressureY(day.smoothedPressure);
    return { ...day, x, y };
  });
  const lineSegments = getLineSegments(points);
  const yAxisLabels = Array.from(
    { length: Math.floor(axisMax / 50) + 1 },
    (_, index) => index * 50,
  ).filter((pressure) => pressure !== referencePressure);
  const referenceY = getPressureY(referencePressure);
  const xAxisLabels =
    xAxisMode === "date"
      ? points.filter((point, index) => {
          const dayOfMonth = new Date(point.date).getDate();
          return index === 0 || index === points.length - 1 || dayOfMonth % 5 === 0;
        })
      : points.filter((point) => new Date(point.date).getDate() === 1);
  const hoverBandWidth = plotWidth / Math.max(points.length, 1);

  return (
    <section className="stats-card pressure-level-card">
      <div className="stats-card-header">
        <div>
          <div className="panel-kicker">Workload pressure</div>
          <h2>Pressure index</h2>
          <p className="pressure-level-helper">
            100 marks a high-pressure reference day; heavier days can exceed it.
          </p>
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
                <stop offset={`${yellowOffset}%`} stopColor="#facc15" />
                <stop offset={`${redOffset}%`} stopColor="#f87171" />
                {axisMax > 200 ? (
                  <stop offset="100%" stopColor="#f87171" />
                ) : null}
              </linearGradient>
            </defs>

            {yAxisLabels.map((pressure) => {
              const y = getPressureY(pressure);
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

            <line
              className="pressure-reference-line"
              x1={chartPadding.left}
              x2={chartWidth - chartPadding.right}
              y1={referenceY}
              y2={referenceY}
            />
            <text
              className="pressure-reference-label"
              x={chartWidth - chartPadding.right}
              y={referenceY - 6}
            >
              100 reference
            </text>

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

            {xAxisLabels.map((point) => (
              <text
                className="pressure-axis-label"
                key={point.date}
                textAnchor="middle"
                x={point.x}
                y={chartHeight - 9}
              >
                {xAxisMode === "date"
                  ? new Date(point.date).getDate()
                  : monthFormatter.format(new Date(point.date))}
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
                  {dayFormatter.format(new Date(point.date))}: smoothed pressure index{" "}
                  {point.smoothedPressure.toFixed(0)}, raw pressure index{" "}
                  {point.rawPressure.toFixed(0)}, due pressure{" "}
                  {point.duePressure.toFixed(1)}, due points{" "}
                  {point.duePoints.toFixed(1)}, task work{" "}
                  {point.taskWorkHours.toFixed(1)}h, work points{" "}
                  {point.workPoints.toFixed(1)}, tasks due within +/-3 days{" "}
                  {point.tasksDueWithin3DaysCount}
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
