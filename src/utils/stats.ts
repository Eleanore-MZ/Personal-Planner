import type { Category, Task, TimeBlock } from "../types/domain";
import { addCalendarDays, startOfDay } from "./calendar";
import { isTaskComplete } from "./tasks";

const shortDayFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
});

export function getTimeBlockMinutes(block: TimeBlock) {
  const startsAt = new Date(block.startsAt).getTime();
  const endsAt = new Date(block.endsAt).getTime();
  return Math.max((endsAt - startsAt) / 60000, 0);
}

export function getCategoryHours(categories: Category[], blocks: TimeBlock[]) {
  return categories.map((category) => {
    const minutes = blocks
      .filter((block) => block.categoryId === category.id)
      .reduce((total, block) => total + getTimeBlockMinutes(block), 0);

    return {
      category,
      hours: minutes / 60,
    };
  });
}

export function getDailyPlannedHours(blocks: TimeBlock[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(date.getDate() + index);
    const dayStart = date.getTime();
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    const dayEnd = nextDay.getTime();
    const minutes = blocks
      .reduce((total, block) => {
        const startsAt = new Date(block.startsAt).getTime();
        const endsAt = new Date(block.endsAt).getTime();
        const overlapStart = Math.max(startsAt, dayStart);
        const overlapEnd = Math.min(endsAt, dayEnd);
        return total + Math.max((overlapEnd - overlapStart) / 60000, 0);
      }, 0);

    return {
      label: shortDayFormatter.format(date),
      hours: minutes / 60,
    };
  });
}

export function getTimeBlocksForDay(blocks: TimeBlock[], date: Date) {
  const dayStart = startOfDay(date).getTime();
  const dayEnd = addCalendarDays(startOfDay(date), 1).getTime();
  return blocks.filter((block) => {
    const startsAt = new Date(block.startsAt).getTime();
    const endsAt = new Date(block.endsAt).getTime();
    return endsAt > dayStart && startsAt < dayEnd;
  });
}

export function getTaskCompletionStats(tasks: Task[]) {
  const completed = tasks.filter(isTaskComplete).length;
  const open = tasks.length - completed;

  return {
    completed,
    open,
    total: tasks.length,
  };
}
