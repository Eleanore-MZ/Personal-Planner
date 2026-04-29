import type { CalendarView, NavItemId } from "../types/app";

export const viewPlaceholders: Record<
  CalendarView,
  { title: string; eyebrow: string; description: string; cells: string[] }
> = {
  week: {
    title: "Week View",
    eyebrow: "Planning grid",
    description:
      "The weekly planner will show time blocks across the current week.",
    cells: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  },
  month: {
    title: "Month View",
    eyebrow: "Monthly overview",
    description:
      "Month cells summarize planned blocks, due tasks, and daily workload at a glance.",
    cells: ["1", "5", "9", "13", "17", "21", "25", "29"],
  },
  year: {
    title: "Year View",
    eyebrow: "Long-range map",
    description:
      "A compact year overview will help scan seasons, milestones, and trends.",
    cells: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"],
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
      "Switch between week, month, and year views from the toolbar.",
  },
  tasks: {
    title: "Tasks",
    kicker: "Work queue",
    description:
      "Project tasks and lightweight planning states will be added later.",
  },
  stats: {
    title: "Stats",
    kicker: "Personal analytics",
    description:
      "Planning totals, completion trends, and category balance will appear here.",
  },
  categories: {
    title: "Categories",
    kicker: "Color system",
    description:
      "Category labels, colors, and defaults will be configured in this space.",
  },
  settings: {
    title: "Settings",
    kicker: "Local preferences",
    description:
      "Theme, calendar defaults, and local app settings will be managed here.",
  },
};
