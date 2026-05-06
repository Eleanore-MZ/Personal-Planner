import { useEffect, useState } from "react";
import type { Category, Subtask, Task, TimeBlock } from "../../types/domain";
import { formatDateTimeRange } from "../../utils/date";
import { isAllDayBlock } from "../../utils/calendar";
import {
  formatMinutes,
  getTaskPlannedMinutes,
} from "../../utils/tasks";
import { SegmentedControl } from "../ui/ChoiceControls";

type TaskDetailProps = {
  categories: Category[];
  task?: Task;
  timeBlocks: TimeBlock[];
  onDeleteTask: (taskId: string) => void | Promise<void>;
  onUpdateTask: (input: Task) => void | Promise<void>;
  onPlanSession: () => void;
  onOpenFocusPage: () => void;
};

const toDateInputValue = (date?: string) => (date ? date.slice(0, 10) : "");

const createSubtaskId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `subtask-${crypto.randomUUID()}`;
  }

  return `subtask-${Date.now().toString(36)}`;
};

const taskStatusOptions: Array<{ value: Task["status"]; label: string }> = [
  { value: "todo", label: "Todo" },
  { value: "in-progress", label: "In progress" },
  { value: "blocked", label: "Blocked" },
  { value: "done", label: "Done" },
  { value: "canceled", label: "Canceled" },
];

const taskPriorityOptions: Array<{ value: Task["priority"]; label: string }> = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

function TaskDetail({
  categories,
  task,
  timeBlocks,
  onDeleteTask,
  onUpdateTask,
  onPlanSession,
  onOpenFocusPage,
}: TaskDetailProps) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");

  useEffect(() => {
    setTitle(task?.title ?? "");
    setNotes(task?.notes ?? "");
    setDueDate(toDateInputValue(task?.dueDate));
    setNewSubtaskTitle("");
  }, [task]);

  if (!task) {
    return (
      <aside className="task-detail-panel">
        <div className="empty-state">Select a task to see full details.</div>
      </aside>
    );
  }

  const plannedSessions = timeBlocks.filter(
    (block) => block.taskId === task.id || block.id === task.plannedTimeBlockId,
  );
  const plannedMinutes = getTaskPlannedMinutes(task, timeBlocks);
  const updateTask = (input: Partial<Task>) => {
    void onUpdateTask({ ...task, ...input });
  };
  const updateSubtasks = (subtasks: Subtask[]) => {
    updateTask({ subtasks: subtasks.length > 0 ? subtasks : undefined });
  };

  const commitTitle = () => {
    const nextTitle = title.trim();
    if (!nextTitle) {
      setTitle(task.title);
      return;
    }

    if (nextTitle !== task.title) {
      updateTask({ title: nextTitle });
    }
  };

  const commitNotes = () => {
    if (notes !== task.notes) {
      updateTask({ notes });
    }
  };

  const commitDueDate = (nextDueDate: string) => {
    setDueDate(nextDueDate);
    const normalizedDueDate = nextDueDate
      ? new Date(`${nextDueDate}T00:00:00`).toISOString()
      : undefined;
    if ((task.dueDate ?? undefined) !== normalizedDueDate) {
      updateTask({ dueDate: normalizedDueDate });
    }
  };
  const addSubtask = () => {
    const nextTitle = newSubtaskTitle.trim();
    if (!nextTitle) {
      return;
    }

    updateSubtasks([
      ...(task.subtasks ?? []),
      { id: createSubtaskId(), title: nextTitle, completed: false },
    ]);
    setNewSubtaskTitle("");
  };
  const toggleSubtask = (subtaskId: string) => {
    updateSubtasks(
      (task.subtasks ?? []).map((subtask) =>
        subtask.id === subtaskId
          ? { ...subtask, completed: !subtask.completed }
          : subtask,
      ),
    );
  };
  const renameSubtask = (subtaskId: string, title: string) => {
    const nextTitle = title.trim();
    if (!nextTitle) {
      return;
    }

    updateSubtasks(
      (task.subtasks ?? []).map((subtask) =>
        subtask.id === subtaskId ? { ...subtask, title: nextTitle } : subtask,
      ),
    );
  };
  const deleteSubtask = (subtaskId: string) => {
    updateSubtasks(
      (task.subtasks ?? []).filter((subtask) => subtask.id !== subtaskId),
    );
  };

  return (
    <aside className="task-detail-panel">
      <div className="task-detail-header">
        <div>
          <div className="panel-kicker">Task detail</div>
          <input
            aria-label="Task title"
            className="task-detail-title-input"
            onBlur={commitTitle}
            onChange={(event) => setTitle(event.target.value)}
            value={title}
          />
        </div>
        <div className="task-detail-actions">
          <button
            className="toolbar-button primary-action"
            onClick={onOpenFocusPage}
            type="button"
          >
            Start Focus
          </button>
          <button
            className="toolbar-button"
            onClick={onPlanSession}
            type="button"
          >
            Plan Session
          </button>
          <button
            className="toolbar-button danger-action"
            onClick={() => onDeleteTask(task.id)}
            type="button"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="task-detail-grid">
        <div className="info-row compact">
          <span>Status</span>
          <SegmentedControl
            ariaLabel="Task status"
            compact
            onChange={(status) => updateTask({ status })}
            options={taskStatusOptions}
            value={task.status}
          />
        </div>
        <div className="info-row compact">
          <span>Priority</span>
          <SegmentedControl
            ariaLabel="Task priority"
            compact
            onChange={(priority) => updateTask({ priority })}
            options={taskPriorityOptions}
            value={task.priority}
          />
        </div>
        <div className="info-row compact">
          <span>Due</span>
          <input
            onChange={(event) => commitDueDate(event.target.value)}
            type="date"
            value={dueDate}
          />
        </div>
        <div className="info-row compact">
          <span>Category</span>
          <select
            onChange={(event) => updateTask({ categoryId: event.target.value })}
            value={task.categoryId}
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <div className="info-row compact">
          <span>Planned time</span>
          <strong>{formatMinutes(plannedMinutes)}</strong>
        </div>
      </div>

      <section className="task-detail-section">
        <h3>Planned time blocks</h3>
        {plannedSessions.length > 0 ? (
          <div className="planned-session-list">
            {plannedSessions.map((session) => (
              <div className="planned-session" key={session.id}>
                <strong>{session.title}</strong>
                <span>
                  {isAllDayBlock(session)
                    ? "All day"
                    : formatDateTimeRange(session.startsAt, session.endsAt)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">No linked time blocks yet.</div>
        )}
      </section>

      <section className="task-detail-section">
        <div className="task-detail-section-header">
          <h3>Subtasks</h3>
          {task.subtasks && task.subtasks.length > 0 ? (
            <span>
              {task.subtasks.filter((subtask) => subtask.completed).length}/
              {task.subtasks.length}
            </span>
          ) : null}
        </div>
        <form
          className="subtask-form"
          onSubmit={(event) => {
            event.preventDefault();
            addSubtask();
          }}
        >
          <input
            aria-label="New subtask"
            onChange={(event) => setNewSubtaskTitle(event.target.value)}
            placeholder="Add subtask"
            value={newSubtaskTitle}
          />
          <button className="toolbar-button" type="submit">
            Add
          </button>
        </form>
        {task.subtasks && task.subtasks.length > 0 ? (
          <div className="subtask-list">
            {task.subtasks.map((subtask) => (
              <div className="subtask-row" key={subtask.id}>
                <button
                  aria-label={`Mark ${subtask.title} ${
                    subtask.completed ? "incomplete" : "complete"
                  }`}
                  className={`subtask-dot${subtask.completed ? " complete" : ""}`}
                  onClick={() => toggleSubtask(subtask.id)}
                  type="button"
                />
                <input
                  aria-label={`Rename ${subtask.title}`}
                  defaultValue={subtask.title}
                  key={subtask.title}
                  onBlur={(event) =>
                    renameSubtask(subtask.id, event.target.value)
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.currentTarget.blur();
                    }
                  }}
                />
                <button
                  aria-label={`Delete ${subtask.title}`}
                  className="toolbar-button subtask-delete-button"
                  onClick={() => deleteSubtask(subtask.id)}
                  type="button"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">No subtasks yet.</div>
        )}
      </section>

      <label className="task-detail-notes-field">
        <span>Notes</span>
        <textarea
          onBlur={commitNotes}
          onChange={(event) => setNotes(event.target.value)}
          rows={4}
          value={notes}
        />
      </label>
    </aside>
  );
}

export default TaskDetail;
