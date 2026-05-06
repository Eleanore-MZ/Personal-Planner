import { useState } from "react";
import type { Category, Task } from "../../types/domain";
import type { CreateTaskInput } from "../../types/plannerApi";
import { SegmentedControl } from "../ui/ChoiceControls";

type TaskDialogProps = {
  categories: Category[];
  mode: "new" | "edit";
  task?: Task;
  onClose: () => void;
  onCreateTask: (input: CreateTaskInput) => void | Promise<void>;
  onUpdateTask: (input: Task) => void | Promise<void>;
  onDeleteTask: (taskId: string) => void | Promise<void>;
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

function TaskDialog({
  categories,
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
  const [status, setStatus] = useState<Task["status"]>(task?.status ?? "todo");
  const [dueDate, setDueDate] = useState(
    task?.dueDate ? task.dueDate.slice(0, 10) : "",
  );

  const handleSave = async () => {
    if (!title.trim() || !categoryId) {
      onClose();
      return;
    }

    const input = {
      title: title.trim(),
      notes,
      categoryId,
      status,
      priority,
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
          <div className="dialog-field">
            <span>Priority</span>
            <SegmentedControl
              ariaLabel="Task priority"
              compact
              onChange={setPriority}
              options={taskPriorityOptions}
              value={priority}
            />
          </div>
          <div className="dialog-field dialog-wide-field">
            <span>Status</span>
            <SegmentedControl
              ariaLabel="Task status"
              compact
              onChange={setStatus}
              options={taskStatusOptions}
              value={status}
            />
          </div>
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
