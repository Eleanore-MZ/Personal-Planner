import type { Category, Task, TimeBlock } from "../../types/domain";
import type { CreateTimeBlockInput } from "../../types/plannerApi";
import PomodoroPanel from "./PomodoroPanel";
import { formatDateTimeRange } from "../../utils/date";

type PomodoroViewProps = {
  categories: Category[];
  selectedTaskId?: string;
  tasks: Task[];
  timeBlocks: TimeBlock[];
  onCompleteSession: (timeBlock: CreateTimeBlockInput) => void | Promise<void>;
  onSelectTask: (taskId: string) => void;
};

function PomodoroView({
  categories,
  selectedTaskId,
  tasks,
  timeBlocks,
  onCompleteSession,
  onSelectTask,
}: PomodoroViewProps) {
  const selectedTask = tasks.find((task) => task.id === selectedTaskId);
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
            {tasks.length > 0 ? (
              tasks.map((task) => (
                <button
                  className={`mini-block${
                    selectedTaskId === task.id ? " selected" : ""
                  }`}
                  key={task.id}
                  onClick={() => onSelectTask(task.id)}
                  type="button"
                >
                  <span>{task.title}</span>
                  <small>{task.status}</small>
                </button>
              ))
            ) : (
              <div className="empty-state">No tasks available.</div>
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
              <div className="empty-state">No completed focus sessions yet.</div>
            )}
          </div>
        </section>
      </aside>
    </div>
  );
}

export default PomodoroView;
