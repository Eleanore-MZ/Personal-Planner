import type { CSSProperties } from "react";
import type { Category, Task } from "../../types/domain";
import { getCategoryColorValues } from "../../utils/calendar";
import {
  findTaskCategory,
  formatTaskDueDate,
  isTaskComplete,
} from "../../utils/tasks";

type TaskCardProps = {
  categories: Category[];
  isSelected: boolean;
  task: Task;
  onSelectTask: (taskId: string) => void;
  onToggleTask: (taskId: string) => void;
};

function TaskCard({
  categories,
  isSelected,
  task,
  onSelectTask,
  onToggleTask,
}: TaskCardProps) {
  const category = findTaskCategory(categories, task.categoryId);
  const colors = getCategoryColorValues(category?.color);
  const isComplete = isTaskComplete(task);
  const completedSubtasks =
    task.subtasks?.filter((subtask) => subtask.completed).length ?? 0;
  const totalSubtasks = task.subtasks?.length ?? 0;

  return (
    <article
      className={`task-card${isSelected ? " selected" : ""}${
        isComplete ? " complete" : ""
      }`}
      style={
        {
          "--task-accent": colors.accent,
          "--task-background": colors.background,
          "--task-border": colors.border,
        } as CSSProperties
      }
    >
      <button
        aria-label={`Mark ${task.title} ${
          isComplete ? "incomplete" : "complete"
        }`}
        className={`completion-circle${isComplete ? " complete" : ""}`}
        onClick={() => onToggleTask(task.id)}
        type="button"
      />

      <button
        className="task-card-body"
        onClick={() => onSelectTask(task.id)}
        type="button"
      >
        <span className="task-context">
          {category?.name ?? "Uncategorized"}
        </span>
        <span className="task-title">{task.title}</span>
        <span className="task-meta-row">
          <span>{formatTaskDueDate(task)}</span>
          <span className={`priority-pill priority-${task.priority}`}>
            {task.priority}
          </span>
          <span>{task.status}</span>
        </span>
        {totalSubtasks > 0 ? (
          <span className="subtask-count">
            {completedSubtasks}/{totalSubtasks} subtasks
          </span>
        ) : null}
      </button>
    </article>
  );
}

export default TaskCard;
