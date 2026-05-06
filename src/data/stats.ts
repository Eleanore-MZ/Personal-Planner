import type { StatsHeatmapMetric } from "../types/app";

export const statsHeatmapMetrics: Array<{
  id: StatsHeatmapMetric;
  label: string;
}> = [
  { id: "active_hours", label: "Normal hours" },
  { id: "abandoned_hours", label: "Abandoned hours" },
  { id: "pomodoro_hours", label: "Pomodoro focus hours" },
  { id: "completed_tasks", label: "Completed tasks" },
];
