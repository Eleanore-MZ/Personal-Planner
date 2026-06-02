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
const singletonSegmentHalfWidth = 4;

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
    return `M ${points[0].x - singletonSegmentHalfWidth} ${
      points[0].y
    } L ${points[0].x + singletonSegmentHalfWidth} ${points[0].y}`;
  }

  const slopes = points.slice(0, -1).map((point, index) => {
    const nextPoint = points[index + 1];
    return (nextPoint.y - point.y) / (nextPoint.x - point.x);
  });
  const tangents = points.map((_, index) => {
    if (index === 0) {
      return slopes[0];
    }

    if (index === points.length - 1) {
      return slopes[slopes.length - 1];
    }

    return (slopes[index - 1] + slopes[index]) / 2;
  });

  slopes.forEach((slope, index) => {
    if (slope === 0) {
      tangents[index] = 0;
      tangents[index + 1] = 0;
      return;
    }

    const tangentRatio = tangents[index] / slope;
    const nextTangentRatio = tangents[index + 1] / slope;
    const squaredRatioTotal =
      tangentRatio * tangentRatio + nextTangentRatio * nextTangentRatio;

    if (squaredRatioTotal > 9) {
      const scale = 3 / Math.sqrt(squaredRatioTotal);
      tangents[index] = scale * tangentRatio * slope;
      tangents[index + 1] = scale * nextTangentRatio * slope;
    }
  });

  const segments = [`M ${points[0].x} ${points[0].y}`];

  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const width = next.x - current.x;
    const minimumY = Math.min(current.y, next.y);
    const maximumY = Math.max(current.y, next.y);
    const controlOneX = current.x + width / 3;
    const controlOneY = Math.min(
      maximumY,
      Math.max(minimumY, current.y + (tangents[index] * width) / 3),
    );
    const controlTwoX = next.x - width / 3;
    const controlTwoY = Math.min(
      maximumY,
      Math.max(minimumY, next.y - (tangents[index + 1] * width) / 3),
    );

    segments.push(
      `C ${controlOneX} ${controlOneY}, ${controlTwoX} ${controlTwoY}, ${next.x} ${next.y}`,
    );
  }

  return segments.join(" ");
}

function getSegmentXBounds(segment: ChartPoint[]) {
  if (segment.length === 1) {
    return {
      end: segment[0].x + singletonSegmentHalfWidth,
      start: segment[0].x - singletonSegmentHalfWidth,
    };
  }

  return {
    end: segment[segment.length - 1].x,
    start: segment[0].x,
  };
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
              const segmentBounds = getSegmentXBounds(segment);
              const areaPath = `${linePath} L ${segmentBounds.end} ${baselineY} L ${segmentBounds.start} ${baselineY} Z`;

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
            {points
              .filter(
                (point): point is ChartPoint =>
                  hasPressureValue(point) &&
                  point.examsOnDayCount > 0 &&
                  Boolean(point.examMarkerColor),
              )
              .map((point) => (
                <circle
                  className="pressure-exam-marker"
                  cx={point.x}
                  cy={point.y}
                  fill={point.examMarkerColor ?? undefined}
                  key={`exam-${point.date}`}
                  r="4"
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
                  {point.duePoints.toFixed(1)}, exam pressure{" "}
                  {point.examPressure.toFixed(1)}, upcoming exams within 3 days{" "}
                  {point.examsWithin3DaysCount}, exams today{" "}
                  {point.examsOnDayCount}, task work{" "}
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
