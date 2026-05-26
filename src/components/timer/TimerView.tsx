import type { CSSProperties } from "react";
import type { Category, Task, TimeBlock } from "../../types/domain";
import type { CreateTimeBlockInput } from "../../types/plannerApi";
import { getCategoryColorValues } from "../../utils/calendar";
import {
  findTaskCategory,
  formatTaskDueDate,
  isTaskComplete,
  orderTasksByDueDate,
} from "../../utils/tasks";
import TimerPanel from "./TimerPanel";

type TimerViewProps = {
  categories: Category[];
  selectedTaskId?: string;
  tasks: Task[];
  timeBlocks: TimeBlock[];
  onCompleteSession: (timeBlock: CreateTimeBlockInput) => void | Promise<void>;
  onSelectTask: (taskId: string) => void;
  onToggleTask: (taskId: string) => void | Promise<void>;
};

function TimerView({
  categories,
  selectedTaskId,
  tasks,
  onCompleteSession,
  onSelectTask,
  onToggleTask,
}: TimerViewProps) {
  const selectedTask = tasks.find((task) => task.id === selectedTaskId);
  const openTasks = orderTasksByDueDate(
    tasks.filter((task) => !isTaskComplete(task)),
  );

  return (
    <div className="pomodoro-view timer-view">
      <section className="pomodoro-timer-surface">
        <TimerPanel
          categories={categories}
          onCompleteSession={onCompleteSession}
          selectedTask={selectedTask}
          tasks={tasks}
        />
      </section>

      <aside className="pomodoro-side-panel">
        <section className="stats-card">
          <div className="stats-card-header">
            <div>
              <div className="panel-kicker">Selected task</div>
              <h2>{selectedTask?.title ?? "No task selected"}</h2>
            </div>
          </div>
          <div className="focus-task-list">
            {openTasks.length > 0 ? (
              openTasks.map((task) => {
                const category = findTaskCategory(categories, task.categoryId);
                const colors = getCategoryColorValues(category?.color);
                const categoryName = category?.name ?? "Uncategorized";

                return (
                  <div
                    className={`inspector-task-row focus-task-row${
                      selectedTaskId === task.id ? " selected" : ""
                    }`}
                    key={task.id}
                    style={
                      {
                        "--task-accent": colors.accent,
                        "--task-background": colors.background,
                        "--task-border": colors.border,
                      } as CSSProperties
                    }
                  >
                    <button
                      aria-label={`Mark ${task.title} complete`}
                      className="completion-circle"
                      onClick={() => void onToggleTask(task.id)}
                      type="button"
                    />
                    <button
                      className="inspector-task-row-body"
                      onClick={() => onSelectTask(task.id)}
                      type="button"
                    >
                      <strong>{task.title}</strong>
                      <small className="inspector-task-meta">
                        <span>{categoryName}</span>
                        <span>{formatTaskDueDate(task)}</span>
                        <span>{task.status}</span>
                      </small>
                    </button>
                  </div>
                );
              })
            ) : (
              <div className="empty-state">No open tasks.</div>
            )}
          </div>
        </section>
      </aside>
    </div>
  );
}

export default TimerView;
