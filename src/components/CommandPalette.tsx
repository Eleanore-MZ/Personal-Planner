import type { CalendarView, NavItemId } from "../types/app";

type CommandPaletteProps = {
  onClose: () => void;
  onSelectNav: (item: NavItemId) => void;
  onSelectView: (view: CalendarView) => void;
  onToday: () => void;
};

const commands: Array<{
  label: string;
  hint: string;
  action: (api: CommandPaletteProps) => void;
}> = [
  {
    label: "Go to Calendar",
    hint: "G then C",
    action: ({ onSelectNav }) => onSelectNav("calendar"),
  },
  {
    label: "Go to Tasks",
    hint: "G then K",
    action: ({ onSelectNav }) => onSelectNav("tasks"),
  },
  {
    label: "Go to Focus",
    hint: "G then F",
    action: ({ onSelectNav }) => onSelectNav("pomodoro"),
  },
  {
    label: "Go to Timer",
    hint: "G then I",
    action: ({ onSelectNav }) => onSelectNav("timer"),
  },
  {
    label: "Go to Stats",
    hint: "G then S",
    action: ({ onSelectNav }) => onSelectNav("stats"),
  },
  {
    label: "Show Today",
    hint: "T",
    action: ({ onToday }) => onToday(),
  },
  {
    label: "Switch to Week View",
    hint: "1",
    action: ({ onSelectView }) => onSelectView("week"),
  },
  {
    label: "Switch to Month View",
    hint: "2",
    action: ({ onSelectView }) => onSelectView("month"),
  },
];

function CommandPalette(props: CommandPaletteProps) {
  return (
    <div className="dialog-backdrop" role="presentation">
      <section aria-label="Command Palette" className="command-palette">
        <div className="fake-dialog-header">
          <div>
            <div className="panel-kicker">Command palette</div>
            <h2>Quick actions</h2>
          </div>
          <button className="icon-button" onClick={props.onClose} type="button">
            Close
          </button>
        </div>
        <div className="command-search-placeholder">Type a command...</div>
        <div className="command-list">
          {commands.map((command) => (
            <button
              className="command-row"
              key={command.label}
              onClick={() => {
                command.action(props);
                props.onClose();
              }}
              type="button"
            >
              <span>{command.label}</span>
              <kbd>{command.hint}</kbd>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

export default CommandPalette;
