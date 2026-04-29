import { useState } from "react";
import type { Category, Task } from "../../types/domain";
import type { CreateTaskInput } from "../../types/plannerApi";

type TaskDialogProps = {
  categories: Category[];
  defaultListId: string;
  mode: "new" | "edit";
  task?: Task;
  onClose: () => void;
  onCreateTask: (input: CreateTaskInput) => void | Promise<void>;
  onUpdateTask: (input: Task) => void | Promise<void>;
  onDeleteTask: (taskId: string) => void | Promise<void>;
};

function TaskDialog({
  categories,
  defaultListId,
  mode,
  task,
  onClose,
  onCreateTask,
  onUpdateTask,
  onDeleteTask,
}: TaskDialogProps) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [priority, setPriority] = useState<Task["priority"]>(
    task?.priority ?? "medium",
  );
  const [notes, setNotes] = useState(task?.notes ?? "");
  const [categoryId, setCategoryId] = useState(
    task?.categoryId ?? categories[0]?.id ?? "",
  );
  const listId = task?.listId ?? defaultListId;
  const [status, setStatus] = useState<Task["status"]>(task?.status ?? "todo");
  const [estimatedMinutes, setEstimatedMinutes] = useState(
    `${task?.estimatedMinutes ?? 60}`,
  );
  const [dueDate, setDueDate] = useState(
    task?.dueDate ? task.dueDate.slice(0, 10) : "",
  );

  const handleSave = async () => {
    if (!title.trim() || !categoryId || !listId) {
      onClose();
      return;
    }

    const input = {
      title: title.trim(),
      notes,
      listId,
      categoryId,
      status,
      priority,
      estimatedMinutes: Number(estimatedMinutes) || 60,
      dueDate: dueDate ? new Date(`${dueDate}T00:00:00`).toISOString() : undefined,
      plannedTimeBlockId: task?.plannedTimeBlockId,
      subtasks: task?.subtasks,
    };

    if (mode === "edit" && task) {
      await onUpdateTask({ id: task.id, ...input });
    } else {
      await onCreateTask(input);
    }
    onClose();
  };

  const handleDelete = async () => {
    if (!task) {
      return;
    }

    await onDeleteTask(task.id);
    onClose();
  };

  return (
    <div className="dialog-backdrop" role="presentation">
      <section
        aria-label={mode === "new" ? "New Task" : "Edit Task"}
        className="fake-dialog"
      >
        <div className="fake-dialog-header">
          <div>
            <div className="panel-kicker">Preview dialog</div>
            <h2>{mode === "new" ? "New Task" : "Edit Task"}</h2>
          </div>
          <button className="icon-button" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <div className="dialog-form-grid">
          <label>
            <span>Title</span>
            <input
              onChange={(event) => setTitle(event.target.value)}
              value={title}
            />
          </label>
          <label>
            <span>Priority</span>
            <select
              onChange={(event) =>
                setPriority(event.target.value as Task["priority"])
              }
              value={priority}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
          <label>
            <span>Status</span>
            <select
              onChange={(event) => setStatus(event.target.value as Task["status"])}
              value={status}
            >
              <option value="todo">To do</option>
              <option value="in-progress">In progress</option>
              <option value="done">Done</option>
            </select>
          </label>
          <label>
            <span>Estimate</span>
            <input
              min="0"
              onChange={(event) => setEstimatedMinutes(event.target.value)}
              type="number"
              value={estimatedMinutes}
            />
          </label>
          <label>
            <span>Due date</span>
            <input
              onChange={(event) => setDueDate(event.target.value)}
              type="date"
              value={dueDate}
            />
          </label>
          <label>
            <span>Category</span>
            <select
              onChange={(event) => setCategoryId(event.target.value)}
              value={categoryId}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="dialog-wide-field">
            <span>Notes</span>
            <textarea
              onChange={(event) => setNotes(event.target.value)}
              rows={4}
              value={notes}
            />
          </label>
        </div>

        <div className="fake-dialog-actions">
          {mode === "edit" && task ? (
            <button
              className="toolbar-button danger-action"
              onClick={handleDelete}
              type="button"
            >
              Delete
            </button>
          ) : null}
          <button className="toolbar-button" onClick={onClose} type="button">
            Cancel
          </button>
          <button
            className="toolbar-button primary-action"
            onClick={handleSave}
            type="button"
          >
            {mode === "new" ? "Create Task" : "Save Preview"}
          </button>
        </div>
      </section>
    </div>
  );
}

export default TaskDialog;
