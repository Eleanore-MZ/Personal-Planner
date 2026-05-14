import { useState } from "react";
import type { Category, Task, TimeBlock } from "../../types/domain";
import type { CreateTaskInput, CreateTimeBlockInput } from "../../types/plannerApi";
import TaskDetail from "./TaskDetail";
import TaskDialog from "./TaskDialog";
import PlanSessionDialog from "./PlanSessionDialog";
import TaskCard from "./TaskCard";
import { isTaskComplete } from "../../utils/tasks";

type TasksViewProps = {
  categories: Category[];
  selectedTaskId?: string;
  tasks: Task[];
  timeBlocks: TimeBlock[];
  onCreateTask: (input: CreateTaskInput) => void | Promise<void>;
  onUpdateTask: (input: Task) => void | Promise<void>;
  onDeleteTask: (taskId: string) => void | Promise<void>;
  onSelectTask: (taskId: string) => void;
  onToggleTask: (taskId: string) => void;
  onPlanSession: (timeBlock: CreateTimeBlockInput) => void | Promise<void>;
  onOpenFocusPage: () => void;
};

function TasksView({
  categories,
  selectedTaskId,
  tasks,
  timeBlocks,
  onCreateTask,
  onUpdateTask,
  onDeleteTask,
  onSelectTask,
  onToggleTask,
  onPlanSession,
  onOpenFocusPage,
}: TasksViewProps) {
  const [dialogMode, setDialogMode] = useState<"new" | "edit" | undefined>();
  const [isPlanDialogOpen, setIsPlanDialogOpen] = useState(false);
  const [isCompletedCollapsed, setIsCompletedCollapsed] = useState(true);
  const selectedTask = tasks.find((task) => task.id === selectedTaskId);
  const openTasks = tasks.filter((task) => !isTaskComplete(task));
  const completedTasks = tasks.filter(isTaskComplete);
  const getDueTime = (task: Task, fallback: number) =>
    task.dueDate ? new Date(task.dueDate).getTime() : fallback;
  const orderedOpenTasks = [...openTasks].sort(
    (firstTask, secondTask) =>
      getDueTime(firstTask, Number.POSITIVE_INFINITY) -
        getDueTime(secondTask, Number.POSITIVE_INFINITY) ||
      firstTask.title.localeCompare(secondTask.title),
  );
  const orderedCompletedTasks = [...completedTasks].sort(
    (firstTask, secondTask) =>
      getDueTime(secondTask, Number.NEGATIVE_INFINITY) -
        getDueTime(firstTask, Number.NEGATIVE_INFINITY) ||
      firstTask.title.localeCompare(secondTask.title),
  );

  return (
    <div className="tasks-view">
      <section className="tasks-command-bar">
        <div>
          <div className="panel-kicker">Task management</div>
          <h2>{openTasks.length} open tasks</h2>
          <p>Manage tasks, inspect subtasks, and review planned sessions.</p>
        </div>
        <button
          className="toolbar-button primary-action"
          onClick={() => setDialogMode("new")}
          type="button"
        >
          New Task
        </button>
      </section>

      <div className="tasks-layout">
        <div className="tasks-list-pane">
          <section className="task-list-section">
            <div className="task-list-header">
              <div>
                <h2>Tasks</h2>
                <p>{openTasks.length} open tasks</p>
              </div>
            </div>
            <div className="task-list-cards">
              {orderedOpenTasks.length > 0 ? (
                orderedOpenTasks.map((task) => (
                  <TaskCard
                    categories={categories}
                    isSelected={selectedTaskId === task.id}
                    key={task.id}
                    onSelectTask={onSelectTask}
                    onToggleTask={onToggleTask}
                    task={task}
                  />
                ))
              ) : (
                <div className="todo-empty">No open tasks yet.</div>
              )}
            </div>
          </section>

          <section className="task-list-section">
            <button
              className="task-list-header task-list-toggle"
              onClick={() =>
                setIsCompletedCollapsed(
                  (currentCollapsed) => !currentCollapsed,
                )
              }
              type="button"
            >
              <div>
                <h2>Completed</h2>
                <p>{completedTasks.length} completed tasks</p>
              </div>
              <span
                className={`collapse-indicator${
                  isCompletedCollapsed ? " collapsed" : ""
                }`}
              >
                v
              </span>
            </button>
            {!isCompletedCollapsed ? (
              <div className="task-list-cards">
                {orderedCompletedTasks.length > 0 ? (
                  orderedCompletedTasks.map((task) => (
                    <TaskCard
                      categories={categories}
                      isSelected={selectedTaskId === task.id}
                      key={task.id}
                      onSelectTask={onSelectTask}
                      onToggleTask={onToggleTask}
                      task={task}
                    />
                  ))
                ) : (
                  <div className="todo-empty">No completed tasks yet.</div>
                )}
              </div>
            ) : null}
          </section>
        </div>

        <TaskDetail
          categories={categories}
          onDeleteTask={onDeleteTask}
          onOpenFocusPage={onOpenFocusPage}
          onPlanSession={() => setIsPlanDialogOpen(true)}
          onUpdateTask={onUpdateTask}
          task={selectedTask}
          timeBlocks={timeBlocks}
        />
      </div>

      {dialogMode ? (
        <TaskDialog
          mode={dialogMode}
          onClose={() => setDialogMode(undefined)}
          onCreateTask={onCreateTask}
          onUpdateTask={onUpdateTask}
          onDeleteTask={onDeleteTask}
          categories={categories}
          task={dialogMode === "edit" ? selectedTask : undefined}
        />
      ) : null}

      {isPlanDialogOpen && selectedTask ? (
        <PlanSessionDialog
          onClose={() => setIsPlanDialogOpen(false)}
          onPlanSession={onPlanSession}
          task={selectedTask}
        />
      ) : null}
    </div>
  );
}

export default TasksView;
