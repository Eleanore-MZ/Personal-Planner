import type { AppSettings, WeekStartDay } from "../../types/app";

type SettingsViewProps = {
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
};

function SettingsView({ settings, onUpdateSettings }: SettingsViewProps) {
  const updateSetting = <Key extends keyof AppSettings>(
    key: Key,
    value: AppSettings[Key],
  ) => {
    onUpdateSettings({ ...settings, [key]: value });
  };

  return (
    <div className="settings-view">
      <section className="settings-panel">
        <div>
          <div className="panel-kicker">Preferences</div>
          <h2>Calendar</h2>
          <p>These settings apply immediately and stay in this browser profile.</p>
        </div>

        <div className="settings-grid">
          <label>
            <span>Week starts on</span>
            <select
              onChange={(event) =>
                updateSetting("weekStartDay", event.target.value as WeekStartDay)
              }
              value={settings.weekStartDay}
            >
              <option value="monday">Monday</option>
              <option value="sunday">Sunday</option>
            </select>
          </label>

          <label>
            <span>Visible start hour</span>
            <input
              max={23}
              min={0}
              onChange={(event) =>
                updateSetting("visibleStartHour", Number(event.target.value))
              }
              type="number"
              value={settings.visibleStartHour}
            />
          </label>

          <label>
            <span>Visible end hour</span>
            <input
              max={23}
              min={1}
              onChange={(event) =>
                updateSetting("visibleEndHour", Number(event.target.value))
              }
              type="number"
              value={settings.visibleEndHour}
            />
          </label>
        </div>
      </section>

      <section className="settings-panel">
        <div>
          <div className="panel-kicker">Tasks</div>
          <h2>Density</h2>
        </div>
        <label className="toggle-row">
          <input
            checked={settings.compactTodo}
            onChange={(event) => updateSetting("compactTodo", event.target.checked)}
            type="checkbox"
          />
          <span>Compact task side list</span>
        </label>
      </section>
    </div>
  );
}

export default SettingsView;
