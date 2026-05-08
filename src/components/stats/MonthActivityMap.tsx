export type MonthActivityDay = {
  date: string;
  dayOfMonth: number;
  focusHours: number;
  productiveHours: number;
  trackedHours: number;
};

type MonthActivityMapProps = {
  days: MonthActivityDay[];
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  weekday: "short",
});

function getIntensity(productiveHours: number, maxHours: number) {
  if (productiveHours <= 0) {
    return 0;
  }

  return Math.max(1, Math.min(5, Math.ceil((productiveHours / maxHours) * 5)));
}

function MonthActivityMap({ days }: MonthActivityMapProps) {
  const maxHours = Math.max(...days.map((day) => day.productiveHours), 1);
  const hasData = days.some((day) => day.productiveHours > 0);

  return (
    <section className="stats-card month-activity-card">
      <div className="stats-card-header">
        <div>
          <div className="panel-kicker">Daily map</div>
          <h2>Month activity map</h2>
        </div>
      </div>

      {days.length > 0 ? (
        <>
          <div className="month-activity-strip">
            {days.map((day) => {
              const intensity = getIntensity(day.productiveHours, maxHours);
              const date = new Date(day.date);

              return (
                <div
                  className={`month-activity-day intensity-${intensity}`}
                  key={day.date}
                  title={`${dateFormatter.format(date)}\nProductive: ${day.productiveHours.toFixed(
                    1,
                  )}h\nTracked: ${day.trackedHours.toFixed(
                    1,
                  )}h\nFocus: ${day.focusHours.toFixed(1)}h`}
                >
                  <span>{day.dayOfMonth}</span>
                </div>
              );
            })}
          </div>
          <div className="heatmap-legend month-activity-legend">
            <span>Zero</span>
            {[0, 1, 2, 3, 4, 5].map((level) => (
              <span
                className={`month-activity-day intensity-${level}`}
                key={level}
              />
            ))}
            <span>More</span>
          </div>
          {!hasData ? (
            <div className="empty-state month-activity-empty">
              No productive time in this month under the current filters.
            </div>
          ) : null}
        </>
      ) : (
        <div className="empty-state">
          No days available for this month.
        </div>
      )}
    </section>
  );
}

export default MonthActivityMap;
