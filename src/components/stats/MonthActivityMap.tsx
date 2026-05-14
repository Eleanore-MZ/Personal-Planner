export type MonthActivityDay = {
  date: string;
  dayOfMonth: number;
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
const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getIntensity(productiveHours: number, maxHours: number) {
  if (productiveHours <= 0) {
    return 0;
  }

  return Math.max(1, Math.min(5, Math.ceil((productiveHours / maxHours) * 5)));
}

function MonthActivityMap({ days }: MonthActivityMapProps) {
  const maxHours = Math.max(...days.map((day) => day.productiveHours), 1);
  const hasData = days.some((day) => day.productiveHours > 0);
  const leadingEmptyDays = days.length > 0 ? new Date(days[0].date).getDay() : 0;
  const cells = [
    ...Array.from({ length: leadingEmptyDays }, (_, index) => ({
      id: `empty-start-${index}`,
      type: "empty" as const,
    })),
    ...days.map((day) => ({
      day,
      id: day.date,
      type: "day" as const,
    })),
  ];
  const trailingEmptyDays = (7 - (cells.length % 7)) % 7;
  const calendarCells = [
    ...cells,
    ...Array.from({ length: trailingEmptyDays }, (_, index) => ({
      id: `empty-end-${index}`,
      type: "empty" as const,
    })),
  ];

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
          <div className="month-activity-weekdays">
            {weekdayLabels.map((weekday) => (
              <span key={weekday}>{weekday}</span>
            ))}
          </div>
          <div className="month-activity-calendar">
            {calendarCells.map((cell) => {
              if (cell.type === "empty") {
                return <div className="month-activity-empty-cell" key={cell.id} />;
              }

              const { day } = cell;
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
                  )}h`}
                >
                  <span className="month-activity-date">{day.dayOfMonth}</span>
                  <strong className="month-activity-hours">
                    {day.productiveHours > 0
                      ? `${day.productiveHours.toFixed(1)}h`
                      : "0h"}
                  </strong>
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
              No productive time for this month.
            </div>
          ) : null}
        </>
      ) : (
        <div className="empty-state">
          No days in this month.
        </div>
      )}
    </section>
  );
}

export default MonthActivityMap;
