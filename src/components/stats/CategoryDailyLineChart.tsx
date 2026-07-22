import { useMemo, useRef, useState, type WheelEvent } from "react";
import type { Category, StatsGroup } from "../../types/domain";
import type {
  DailyCategoryHoursDatum,
  DailyCategoryHoursSegment,
  DailyGroupHoursDatum,
  DailyGroupHoursSegment,
} from "../../utils/stats";

type CategoryDailyLineChartProps = {
  categories: Category[];
  categoryData: DailyCategoryHoursDatum[];
  emptyMessage?: string;
  statsGroupData: DailyGroupHoursDatum[];
  statsGroups: StatsGroup[];
  title?: string;
};

type ChartMode = "category" | "stats-group";

type SeriesLineItem = {
  color: string;
  id: string;
  name: string;
};

type SeriesLineSeries = SeriesLineItem & {
  points: CategoryLinePoint[];
  totalHours: number;
};

type CategoryLinePoint = {
  date: string;
  hours: number;
  label: string;
  x: number;
  y: number;
};

const chartWidth = 960;
const chartHeight = 260;
const chartPadding = {
  bottom: 34,
  left: 42,
  right: 18,
  top: 16,
};
const defaultDayWidth = 2.5;
const maximumDayWidth = 24;
const wheelZoomFactor = 1.16;

const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "short" });
const hiddenCategoryIdsKey = "planner:yearCategoryLineHiddenCategories";
const hiddenStatsGroupIdsKey = "planner:yearCategoryLineHiddenStatsGroups";

const getSeriesKey = (id: string | null) => id ?? "uncategorized";

const readHiddenSeriesIds = (key: string) => {
  try {
    const storedIds = localStorage.getItem(key);
    const parsedIds = storedIds ? JSON.parse(storedIds) : [];
    return Array.isArray(parsedIds)
      ? new Set(parsedIds.filter((id): id is string => typeof id === "string"))
      : new Set<string>();
  } catch {
    return new Set<string>();
  }
};

const writeHiddenSeriesIds = (key: string, ids: Set<string>) => {
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(ids)));
  } catch {
    // Hidden chart series are a local display preference.
  }
};

function buildLinePath(points: CategoryLinePoint[]) {
  if (points.length === 0) {
    return "";
  }

  if (points.length === 1) {
    return `M ${points[0].x - 3} ${points[0].y} L ${points[0].x + 3} ${points[0].y}`;
  }

  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
}

function CategoryDailyLineChart({
  categories,
  categoryData,
  emptyMessage = "No active tracked category time for this year.",
  statsGroupData,
  statsGroups,
  title = "Daily hours by category",
}: CategoryDailyLineChartProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeMode, setActiveMode] = useState<ChartMode>("category");
  const [hiddenCategoryIds, setHiddenCategoryIds] = useState<Set<string>>(
    () => readHiddenSeriesIds(hiddenCategoryIdsKey),
  );
  const [hiddenStatsGroupIds, setHiddenStatsGroupIds] = useState<Set<string>>(
    () => readHiddenSeriesIds(hiddenStatsGroupIdsKey),
  );
  const [dayWidth, setDayWidth] = useState(defaultDayWidth);
  const categoryLegendItems = useMemo(() => {
    const itemsByCategoryId = categoryData
      .flatMap((day) => day.segments)
      .reduce((items, segment) => {
        const categoryKey = getSeriesKey(segment.categoryId);
        if (!items.has(categoryKey)) {
          items.set(categoryKey, segment);
        }
        return items;
      }, new Map<string, DailyCategoryHoursSegment>());
    const orderedItems = categories
      .map((category) => itemsByCategoryId.get(category.id))
      .filter((segment): segment is DailyCategoryHoursSegment => Boolean(segment));
    const uncategorizedItem = itemsByCategoryId.get("uncategorized");

    return uncategorizedItem
      ? [...orderedItems, uncategorizedItem]
      : orderedItems;
  }, [categories, categoryData]);
  const statsGroupLegendItems = useMemo(() => {
    const itemsByGroupId = statsGroupData
      .flatMap((day) => day.segments)
      .reduce((items, segment) => {
        if (!items.has(segment.groupId)) {
          items.set(segment.groupId, segment);
        }
        return items;
      }, new Map<string, DailyGroupHoursSegment>());
    const orderedGroups = [...statsGroups].sort(
      (firstGroup, secondGroup) => firstGroup.sortOrder - secondGroup.sortOrder,
    );
    const orderedItems = orderedGroups
      .map((group) => itemsByGroupId.get(group.id))
      .filter((segment): segment is DailyGroupHoursSegment => Boolean(segment))
      .map<SeriesLineItem>((segment) => ({
        color: segment.color,
        id: segment.groupId,
        name: segment.groupName,
      }));
    const orderedIds = new Set(orderedItems.map((item) => item.id));
    const remainingItems = Array.from(itemsByGroupId.values())
      .filter((segment) => !orderedIds.has(segment.groupId))
      .map<SeriesLineItem>((segment) => ({
        color: segment.color,
        id: segment.groupId,
        name: segment.groupName,
      }));

    return [...orderedItems, ...remainingItems];
  }, [statsGroupData, statsGroups]);
  const legendItems: SeriesLineItem[] = useMemo(
    () =>
      activeMode === "category"
        ? categoryLegendItems.map((segment) => ({
            color: segment.color,
            id: getSeriesKey(segment.categoryId),
            name: segment.categoryName,
          }))
        : statsGroupLegendItems,
    [activeMode, categoryLegendItems, statsGroupLegendItems],
  );
  const activeData = useMemo(
    () =>
      activeMode === "category"
        ? categoryData.map((day) => ({
            date: day.date,
            label: day.label,
            segments: day.segments.map((segment) => ({
              color: segment.color,
              hours: segment.hours,
              id: getSeriesKey(segment.categoryId),
              name: segment.categoryName,
            })),
          }))
        : statsGroupData.map((day) => ({
            date: day.date,
            label: day.label,
            segments: day.segments.map((segment) => ({
              color: segment.color,
              hours: segment.hours,
              id: segment.groupId,
              name: segment.groupName,
            })),
          })),
    [activeMode, categoryData, statsGroupData],
  );
  const hiddenSeriesIds =
    activeMode === "category" ? hiddenCategoryIds : hiddenStatsGroupIds;
  const visibleSeriesIds = useMemo(
    () =>
      new Set(
        legendItems
          .map((item) => item.id)
          .filter((seriesId) => !hiddenSeriesIds.has(seriesId)),
      ),
    [hiddenSeriesIds, legendItems],
  );
  const maxHours = activeData.reduce(
    (currentMax, day) =>
      day.segments.reduce(
        (dayMax, segment) =>
          visibleSeriesIds.has(segment.id)
            ? Math.max(dayMax, segment.hours)
            : dayMax,
        currentMax,
      ),
    1,
  );
  const hasSourceData = activeData.some((day) => day.segments.length > 0);
  const plotWidth = (Math.max(activeData.length, 1) - 1) * dayWidth;
  const svgWidth = Math.max(
    chartWidth,
    chartPadding.left + plotWidth + chartPadding.right,
  );
  const plotHeight = chartHeight - chartPadding.top - chartPadding.bottom;
  const baselineY = chartHeight - chartPadding.bottom;
  const series = legendItems
    .filter((item) => visibleSeriesIds.has(item.id))
    .map<SeriesLineSeries>((item) => {
      const points = activeData.map((day, index) => {
        const segment = day.segments.find(
          (currentSegment) => currentSegment.id === item.id,
        );
        const hours = segment?.hours ?? 0;
        const x = chartPadding.left + index * dayWidth;
        const y = baselineY - (hours / maxHours) * plotHeight;

        return {
          date: day.date,
          hours,
          label: day.label,
          x,
          y,
        };
      });

      return {
        color: item.color,
        id: item.id,
        name: item.name,
        points,
        totalHours: points.reduce((total, point) => total + point.hours, 0),
      };
    })
    .filter((item) => item.totalHours > 0);
  const yAxisLabels = [maxHours, maxHours / 2, 0];
  const xAxisLabels = activeData.flatMap((day, index) => {
    const date = new Date(day.date);
    const shouldShowLabel = (() => {
      if (dayWidth >= 16) {
        return index % 2 === 0 || index === activeData.length - 1;
      }

      if (dayWidth >= 9) {
        return index % 7 === 0 || index === activeData.length - 1;
      }

      if (dayWidth >= 5) {
        return date.getDate() === 1 || date.getDate() === 15;
      }

      return date.getDate() === 1;
    })();

    return shouldShowLabel ? [{ day, index }] : [];
  });
  const displayTitle =
    activeMode === "category"
      ? title
      : "Daily hours by stats group";

  const toggleSeries = (seriesId: string) => {
    if (activeMode === "category") {
      setHiddenCategoryIds((currentCategoryIds) => {
        const nextCategoryIds = new Set(currentCategoryIds);
        if (nextCategoryIds.has(seriesId)) {
          nextCategoryIds.delete(seriesId);
        } else {
          nextCategoryIds.add(seriesId);
        }
        writeHiddenSeriesIds(hiddenCategoryIdsKey, nextCategoryIds);
        return nextCategoryIds;
      });
      return;
    }

    setHiddenStatsGroupIds((currentGroupIds) => {
      const nextGroupIds = new Set(currentGroupIds);
      if (nextGroupIds.has(seriesId)) {
        nextGroupIds.delete(seriesId);
      } else {
        nextGroupIds.add(seriesId);
      }
      writeHiddenSeriesIds(hiddenStatsGroupIdsKey, nextGroupIds);
      return nextGroupIds;
    });
  };

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    const container = scrollRef.current;
    if (!container) {
      return;
    }

    if (!event.ctrlKey) {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
        return;
      }

      event.preventDefault();
      container.scrollLeft += event.deltaY;
      return;
    }

    event.preventDefault();
    const bounds = container?.getBoundingClientRect();
    const cursorOffset = bounds ? event.clientX - bounds.left : 0;
    const anchorDayIndex = container
      ? Math.max(
          0,
          Math.min(
            activeData.length - 1,
            (container.scrollLeft + cursorOffset - chartPadding.left) / dayWidth,
          ),
        )
      : 0;

    setDayWidth((currentDayWidth) => {
      const nextDayWidth = Math.min(
        Math.max(
          event.deltaY < 0
            ? currentDayWidth * wheelZoomFactor
            : currentDayWidth / wheelZoomFactor,
          defaultDayWidth,
        ),
        maximumDayWidth,
      );

      window.requestAnimationFrame(() => {
        if (!container) {
          return;
        }

        container.scrollLeft =
          chartPadding.left + anchorDayIndex * nextDayWidth - cursorOffset;
      });

      return nextDayWidth;
    });
  };

  return (
    <section className="stats-card year-category-line-card">
      <div className="stats-card-header">
        <div>
          <div className="panel-kicker">
            {activeMode === "category" ? "Daily categories" : "Daily stats groups"}
          </div>
          <h2>{displayTitle}</h2>
        </div>
      </div>

      {hasSourceData ? (
        <>
          <div
            className="category-line-scroll"
            onWheel={handleWheel}
            ref={scrollRef}
          >
            <div className="category-line-chart" style={{ width: `${svgWidth}px` }}>
              <svg
                aria-label="Daily active tracked hours by category"
                role="img"
                viewBox={`0 0 ${svgWidth} ${chartHeight}`}
              >
                {yAxisLabels.map((hours) => {
                  const y = baselineY - (hours / maxHours) * plotHeight;
                  return (
                    <g className="category-line-axis-row" key={hours}>
                      <line
                        x1={chartPadding.left}
                        x2={svgWidth - chartPadding.right}
                        y1={y}
                        y2={y}
                      />
                      <text x={chartPadding.left - 10} y={y + 4}>
                        {hours > 0 ? `${hours.toFixed(1)}h` : "0h"}
                      </text>
                    </g>
                  );
                })}

                {series.map((categorySeries) => (
                  <path
                    className="category-line-path"
                    d={buildLinePath(categorySeries.points)}
                    key={categorySeries.id}
                    style={{ stroke: categorySeries.color }}
                  >
                    <title>
                      {categorySeries.name}: {categorySeries.totalHours.toFixed(1)}h
                    </title>
                  </path>
                ))}

                {xAxisLabels.map(({ day, index }) => {
                  const x = chartPadding.left + index * dayWidth;
                  const date = new Date(day.date);
                  return (
                    <text
                      className="category-line-axis-label"
                      key={`${day.date}-${index}`}
                      textAnchor="middle"
                      x={x}
                      y={chartHeight - 9}
                    >
                      {dayWidth < 5
                        ? monthFormatter.format(date)
                        : `${monthFormatter.format(date)} ${date.getDate()}`}
                    </text>
                  );
                })}
              </svg>
            </div>
          </div>
          <div className="category-line-footer">
            <div className="stacked-chart-legend">
            {legendItems.map((item) => {
              const isIncluded = !hiddenSeriesIds.has(item.id);
              return (
                <button
                  aria-pressed={isIncluded}
                  className={!isIncluded ? "muted" : undefined}
                  key={item.id}
                  onClick={() => toggleSeries(item.id)}
                  title={`${isIncluded ? "Hide" : "Show"} ${item.name}`}
                  type="button"
                >
                  <i style={{ background: item.color }} />
                  {item.name}
                </button>
              );
            })}
            </div>
            <div className="category-line-mode-toggle" aria-label="Line chart mode">
              <button
                aria-pressed={activeMode === "category"}
                className={activeMode === "category" ? "active" : undefined}
                onClick={() => setActiveMode("category")}
                type="button"
              >
                Category
              </button>
              <button
                aria-pressed={activeMode === "stats-group"}
                className={activeMode === "stats-group" ? "active" : undefined}
                onClick={() => setActiveMode("stats-group")}
                type="button"
              >
                Stats group
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="empty-state">{emptyMessage}</div>
      )}
    </section>
  );
}

export default CategoryDailyLineChart;
