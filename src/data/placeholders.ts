import type { CalendarView, NavItemId } from "../types/app";

export const viewPlaceholders: Record<
  CalendarView,
  { title: string; eyebrow: string; description: string; cells: string[] }
> = {
  week: {
    title: "Week View",
    eyebrow: "Planning grid",
    description:
      "Plan time blocks across the current week.",
    cells: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  },
  month: {
    title: "Month View",
    eyebrow: "Monthly overview",
    description:
      "Month cells summarize calendar blocks, due tasks, and daily workload at a glance.",
    cells: ["1", "5", "9", "13", "17", "21", "25", "29"],
  },
};

export const sectionPlaceholders: Record<
  NavItemId,
  { title: string; kicker: string; description: string }
> = {
  calendar: {
    title: "Calendar",
    kicker: "Time planning",
    description:
      "Switch between week and month views from the toolbar.",
  },
  tasks: {
    title: "Tasks",
    kicker: "Work queue",
    description:
      "Track open tasks, blocked work, and completed items.",
  },
  pomodoro: {
    title: "Focus",
    kicker: "Pomodoro timer",
    description:
      "Run timed focus sessions and save completed work as calendar records.",
  },
  stats: {
    title: "Stats",
    kicker: "Personal analytics",
    description:
      "Review your time, tasks, and routines.",
  },
  categories: {
    title: "Categories",
    kicker: "Color system",
    description:
      "Manage category colors, defaults, and Stats inclusion.",
  },
  settings: {
    title: "Settings",
    kicker: "Local preferences",
    description:
      "Tune calendar defaults and local app preferences.",
  },
};
