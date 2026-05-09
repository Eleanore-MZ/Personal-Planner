import type { StatsHeatmapMetric } from "../types/app";

export const statsHeatmapMetrics: Array<{
  id: StatsHeatmapMetric;
  label: string;
}> = [
  { id: "productive_hours", label: "Productive time" },
  { id: "tracked_hours", label: "Tracked time" },
  { id: "sleep_hours", label: "Sleep time" },
  { id: "abandoned_hours", label: "Abandoned time" },
  { id: "focus_hours", label: "Focus time" },
  { id: "time_blocks_count", label: "Time block count" },
];
