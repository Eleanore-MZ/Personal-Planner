import { sectionPlaceholders } from "../data/placeholders";
import type { CalendarView, NavItemId } from "../types/app";
import type { Category, Task, TimeBlock } from "../types/domain";
import { useMemo, useState } from "react";
import TimeBlockDialog from "./calendar/TimeBlockDialog";
import { getCategoryName } from "../utils/categories";
import { formatDateTimeRange } from "../utils/date";
import {
  formatMinutes,
  formatTaskDueDate,
  groupTasksByDueStatus,
  isTaskComplete,
  type DueGroupId,
} from "../utils/tasks";
import { getTimeBlockMinutes } from "../utils/stats";
import { formatDate } from "../utils/date";
import {
  formatRecurrenceLabel,
  getCategoryAccentColor,
  getBlocksForDay,
  isSameCalendarDay,
} from "../utils/calendar";

type InspectorPanelProps = {
  activeItem: NavItemId;
  activeView: CalendarView;
  categories: Category[];
  compactTaskList: boolean;
  onSelectBlock: (blockId?: string) => void;
  onSelectTask: (taskId: string) => void;
  onToggleTask: (taskId: string) => void | Promise<void>;
  selectedBlockId?: string;
  selectedDate?: Date;
  selectedTaskId?: string;
  tasks: Task[];
  timeBlocks: TimeBlock[];
  onUpdateTimeBlock: (timeBlock: TimeBlock) => void | Promise<void>;
  onDeleteTimeBlock: (timeBlockId: string) => void | Promise<void>;
};

function InspectorPanel({
  activeItem,
  activeView,
  categories,
  compactTaskList,
  onSelectBlock,
  onSelectTask,
  onToggleTask,
  selectedBlockId,
  selectedDate,
  selectedTaskId,
  tasks,
  timeBlocks,
  onUpdateTimeBlock,
  onDeleteTimeBlock,
}: InspectorPanelProps) {
  const [isEditingBlock, setIsEditingBlock] = useState(false);
  const [collapsedTaskGroups, setCollapsedTaskGroups] = useState<
    Record<DueGroupId, boolean>
  >({
    overdue: false,
    today: false,
    tomorrow: false,
    week: false,
    later: false,
    none: false,
  });
  const [taskCategoryFilter, setTaskCategoryFilter] = useState("all");
  const section = sectionPlaceholders[activeItem];
  const selectedBlock = timeBlocks.find(
    (block) => block.id === selectedBlockId,
  );
  const selectedBlockIsRecurring =
    selectedBlock &&
    (selectedBlock.recurringTimeBlockId ||
      selectedBlock.recurrenceFrequency !== "none");
  const linkedTask = selectedBlock?.taskId
    ? tasks.find((task) => task.id === selectedBlock.taskId)
    : undefined;
  const selectedDateBlocks = selectedDate
    ? getBlocksForDay(timeBlocks, selectedDate)
    : [];
  const selectedDateTasks = selectedDate
    ? tasks.filter(
        (task) =>
          task.dueDate && isSameCalendarDay(new Date(task.dueDate), selectedDate),
      )
    : [];
  const selectedDateMinutes = selectedDateBlocks.reduce(
    (total, block) => total + getTimeBlockMinutes(block),
    0,
  );
  const upcomingBlocks = timeBlocks
    .filter((block) => new Date(block.endsAt).getTime() >= Date.now())
    .sort(
      (firstBlock, secondBlock) =>
        new Date(firstBlock.startsAt).getTime() -
        new Date(secondBlock.startsAt).getTime(),
    )
    .slice(0, 3);
  const filteredSidebarTasks = useMemo(
    () =>
      tasks.filter(
        (task) =>
          taskCategoryFilter === "all" ||
          task.categoryId === taskCategoryFilter,
      ),
    [taskCategoryFilter, tasks],
  );
  const incompleteSidebarTasks = useMemo(
    () => filteredSidebarTasks.filter((task) => !isTaskComplete(task)),
    [filteredSidebarTasks],
  );
  const taskDueGroups = useMemo(
    () => groupTasksByDueStatus(incompleteSidebarTasks),
    [incompleteSidebarTasks],
  );
  const categoryProgressRings = useMemo(
    () =>
      categories
        .map((category) => {
          const categoryTasks = filteredSidebarTasks.filter(
            (task) => task.categoryId === category.id,
          );
          const completedTasks = categoryTasks.filter(isTaskComplete).length;
          return {
            category,
            completedTasks,
            totalTasks: categoryTasks.length,
          };
        })
        .filter((ring) => ring.totalTasks > 0),
    [categories, filteredSidebarTasks],
  );
  const completedTaskCount = filteredSidebarTasks.filter(isTaskComplete).length;
  const toggleTaskGroup = (groupId: DueGroupId) => {
    setCollapsedTaskGroups((currentGroups) => ({
      ...currentGroups,
      [groupId]: !currentGroups[groupId],
    }));
  };

  return (
    <aside className="inspector" aria-label="Inspector panel">
      <div className="inspector-header">
        <div className="panel-kicker">Inspector</div>
        <h2>{section.title}</h2>
        <p className="muted">
          Contextual details for the selected item will appear here in a later
          phase.
        </p>
      </div>

      {activeItem === "tasks" ? (
        <div
          className={`inspector-section task-sidebar-workflow${
            compactTaskList ? " compact" : ""
          }`}
        >
          <div className="section-title">Due list</div>
          <div className="task-sidebar-summary">
            <div>
              <strong>
                {completedTaskCount}/{filteredSidebarTasks.length}
              </strong>
              <span>completed</span>
            </div>
            <svg
              aria-hidden="true"
              className="task-sidebar-progress"
              viewBox="0 0 56 56"
            >
              {categoryProgressRings.length > 0 ? (
                categoryProgressRings.map((ring, index) => {
                  const radius = Math.max(5, 24 - index * 3);
                  const circumference = 2 * Math.PI * radius;
                  const progress = ring.completedTasks / ring.totalTasks;

                  return (
                    <g key={ring.category.id}>
                      <circle
                        className="task-sidebar-progress-track"
                        cx="28"
                        cy="28"
                        r={radius}
                      />
                      <circle
                        className="task-sidebar-progress-ring"
                        cx="28"
                        cy="28"
                        r={radius}
                        stroke={getCategoryAccentColor(ring.category.color)}
                        strokeDasharray={`${circumference} ${circumference}`}
                        strokeDashoffset={circumference * (1 - progress)}
                      />
                    </g>
                  );
                })
              ) : (
                <circle
                  className="task-sidebar-progress-track"
                  cx="28"
                  cy="28"
                  r="22"
                />
              )}
            </svg>
          </div>

          <div className="task-sidebar-controls">
            <label>
              <span>Category</span>
              <select
                onChange={(event) => setTaskCategoryFilter(event.target.value)}
                value={taskCategoryFilter}
              >
                <option value="all">All categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="todo-groups inspector-todo-groups">
            {incompleteSidebarTasks.length > 0 ? (
              taskDueGroups.map((group) => (
                <section className="todo-group" key={group.id}>
                  <button
                    className="todo-group-header"
                    onClick={() => toggleTaskGroup(group.id)}
                    type="button"
                  >
                    <span
                      className={`collapse-indicator${
                        collapsedTaskGroups[group.id] ? " collapsed" : ""
                      }`}
                    >
                      v
                    </span>
                    <span>{group.title}</span>
                    <span className="count-badge">{group.tasks.length}</span>
                  </button>
                  {!collapsedTaskGroups[group.id] ? (
                    <div className="todo-card-list">
                      {group.tasks.length > 0 ? (
                        group.tasks.map((task) => (
                          <div
                            className={`inspector-task-row${
                              selectedTaskId === task.id ? " selected" : ""
                            }${isTaskComplete(task) ? " complete" : ""}`}
                            key={task.id}
                          >
                            <button
                              aria-label={`Mark ${task.title} ${
                                isTaskComplete(task)
                                  ? "incomplete"
                                  : "complete"
                              }`}
                              className={`completion-circle${
                                isTaskComplete(task) ? " complete" : ""
                              }`}
                              onClick={() => void onToggleTask(task.id)}
                              type="button"
                            />
                            <button
                              className="inspector-task-row-body"
                              onClick={() => onSelectTask(task.id)}
                              type="button"
                            >
                              <strong>{task.title}</strong>
                              <small>{formatTaskDueDate(task)}</small>
                            </button>
                          </div>
                        ))
                      ) : (
                        <div className="todo-empty">No tasks in this group.</div>
                      )}
                    </div>
                  ) : null}
                </section>
              ))
            ) : (
              <div className="todo-empty">No open tasks match the current filters.</div>
            )}
          </div>
        </div>
      ) : activeItem === "calendar" &&
      (activeView === "month" || activeView === "year") ? (
        <div className="inspector-section">
          <div className="section-title">Selected day</div>
          {selectedDate ? (
            <div className="detail-card">
              <h3>{formatDate(selectedDate)}</h3>
              <div className="info-row compact">
                <span>Planned</span>
                <strong>{formatMinutes(selectedDateMinutes)}</strong>
              </div>
              <div className="info-row compact">
                <span>Blocks</span>
                <strong>{selectedDateBlocks.length}</strong>
              </div>
              <div className="info-row compact">
                <span>Due tasks</span>
                <strong>{selectedDateTasks.length}</strong>
              </div>
              <div className="selected-day-list">
                {selectedDateBlocks.map((block) => (
                  <button
                    className="mini-block"
                    key={block.id}
                    onClick={() => onSelectBlock(block.id)}
                    type="button"
                  >
                    <span>{block.title}</span>
                    <small>{formatDateTimeRange(block.startsAt, block.endsAt)}</small>
                  </button>
                ))}
                {selectedDateTasks.map((task) => (
                  <button
                    className="mini-block"
                    key={task.id}
                    onClick={() => onSelectTask(task.id)}
                    type="button"
                  >
                    <span>{task.title}</span>
                    <small>{isTaskComplete(task) ? "Complete" : "Open"}</small>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="empty-state">Select a day in the heatmap.</div>
          )}
        </div>
      ) : (
        <div className="inspector-section">
          <div className="section-title">Selected block</div>
          {selectedBlock ? (
          <div className="detail-card">
            <h3>{selectedBlock.title}</h3>
            <div className="detail-meta">
              {formatDateTimeRange(selectedBlock.startsAt, selectedBlock.endsAt)}
            </div>
            <p>{selectedBlock.notes}</p>
            <div className="info-row compact">
              <span>Category</span>
              <strong>
                {getCategoryName(categories, selectedBlock.categoryId)}
              </strong>
            </div>
            {linkedTask ? (
              <div className="info-row compact">
                <span>Linked task</span>
                <strong>{linkedTask.title}</strong>
              </div>
            ) : null}
            <div className="info-row compact">
              <span>Repeats</span>
              <strong>{formatRecurrenceLabel(selectedBlock)}</strong>
            </div>
            <div className="detail-actions">
              <button
                className="toolbar-button"
                onClick={() => setIsEditingBlock(true)}
                type="button"
              >
                Edit Block
              </button>
              <button
                className="toolbar-button danger-action"
                onClick={() => onDeleteTimeBlock(selectedBlock.id)}
                type="button"
              >
                {selectedBlockIsRecurring ? "Delete Series" : "Delete"}
              </button>
            </div>
          </div>
          ) : (
            <div className="empty-state">Select a time block to see details.</div>
          )}
        </div>
      )}

      {activeItem !== "tasks" ? (
      <div className="inspector-section">
        <div className="section-title">
          Upcoming blocks
        </div>
        <div className="mini-list">
          {upcomingBlocks.map((block) => (
                <button
                  className={`mini-block${
                    selectedBlockId === block.id ? " selected" : ""
                  }`}
                  key={block.id}
                  onClick={() => onSelectBlock(block.id)}
                  type="button"
                >
                  <span>{block.title}</span>
                  <small>
                    {formatDateTimeRange(block.startsAt, block.endsAt)}
                  </small>
                </button>
              ))}
        </div>
      </div>
      ) : null}

      {isEditingBlock && selectedBlock ? (
        <TimeBlockDialog
          block={selectedBlock}
          categories={categories}
          onClose={() => setIsEditingBlock(false)}
          onSave={(input) => onUpdateTimeBlock(input as TimeBlock)}
          tasks={tasks}
        />
      ) : null}
    </aside>
  );
}

export default InspectorPanel;
