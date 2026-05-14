import type { CSSProperties } from "react";
import type { Category, Task, TimeBlock } from "../../types/domain";
import type { CreateTimeBlockInput } from "../../types/plannerApi";
import PomodoroPanel from "./PomodoroPanel";
import { formatDateTimeRange } from "../../utils/date";
import { getCategoryColorValues } from "../../utils/calendar";
import {
  findTaskCategory,
  formatTaskDueDate,
  isTaskComplete,
} from "../../utils/tasks";

type PomodoroViewProps = {
  categories: Category[];
  selectedTaskId?: string;
  tasks: Task[];
  timeBlocks: TimeBlock[];
  onCompleteSession: (timeBlock: CreateTimeBlockInput) => void | Promise<void>;
  onSelectTask: (taskId: string) => void;
  onToggleTask: (taskId: string) => void | Promise<void>;
};

function PomodoroView({
  categories,
  selectedTaskId,
  tasks,
  timeBlocks,
  onCompleteSession,
  onSelectTask,
  onToggleTask,
}: PomodoroViewProps) {
  const selectedTask = tasks.find((task) => task.id === selectedTaskId);
  const openTasks = tasks.filter((task) => !isTaskComplete(task));
  const recentPomodoros = timeBlocks
    .filter((block) => block.source === "pomodoro")
    .sort(
      (firstBlock, secondBlock) =>
        new Date(secondBlock.endsAt).getTime() -
        new Date(firstBlock.endsAt).getTime(),
    )
    .slice(0, 6);

  return (
    <div className="pomodoro-view">
      <section className="pomodoro-timer-surface">
        <PomodoroPanel
          categories={categories}
          onCompleteSession={onCompleteSession}
          onMarkTaskDone={onToggleTask}
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

        <section className="stats-card">
          <div className="stats-card-header">
            <div>
              <div className="panel-kicker">Recent focus</div>
              <h2>Saved sessions</h2>
            </div>
          </div>
          <div className="planned-session-list">
            {recentPomodoros.length > 0 ? (
              recentPomodoros.map((session) => (
                <div className="planned-session" key={session.id}>
                  <strong>{session.title}</strong>
                  <span>{formatDateTimeRange(session.startsAt, session.endsAt)}</span>
                </div>
              ))
            ) : (
              <div className="empty-state">No focus sessions yet.</div>
            )}
          </div>
        </section>
      </aside>
    </div>
  );
}

export default PomodoroView;
