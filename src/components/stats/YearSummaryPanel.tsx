type YearSummaryPanelProps = {
  averageSleepHours: number;
  highestProductiveDay: {
    hours: number;
    label: string;
  } | null;
  mostProductiveMonth: {
    hours: number;
    label: string;
  } | null;
  productiveDays: number;
  sleepDaysLogged: number;
  topProductiveGroup: {
    hours: number;
    name: string;
  } | null;
  topTrackedCategory: {
    hours: number;
    name: string;
  } | null;
  trackedDays: number;
};

function formatHours(hours: number) {
  return `${hours.toFixed(1)}h`;
}

function YearSummaryPanel({
  averageSleepHours,
  highestProductiveDay,
  mostProductiveMonth,
  productiveDays,
  sleepDaysLogged,
  topProductiveGroup,
  topTrackedCategory,
  trackedDays,
}: YearSummaryPanelProps) {
  const rows = [
    ["Productive days", productiveDays.toString()],
    ["Tracked days", trackedDays.toString()],
    [
      "Top productive group",
      topProductiveGroup
        ? `${topProductiveGroup.name} - ${formatHours(topProductiveGroup.hours)}`
        : "None",
    ],
    [
      "Top tracked category",
      topTrackedCategory
        ? `${topTrackedCategory.name} - ${formatHours(topTrackedCategory.hours)}`
        : "None",
    ],
    [
      "Most productive month",
      mostProductiveMonth
        ? `${mostProductiveMonth.label} - ${formatHours(mostProductiveMonth.hours)}`
        : "None",
    ],
    [
      "Highest productive day",
      highestProductiveDay
        ? `${highestProductiveDay.label} - ${formatHours(highestProductiveDay.hours)}`
        : "None",
    ],
    [
      "Avg sleep",
      averageSleepHours > 0 ? `${averageSleepHours.toFixed(1)}h/day` : "No sleep data",
    ],
    ["Sleep days logged", sleepDaysLogged.toString()],
  ];

  return (
    <section className="stats-card year-summary-panel">
      <div className="stats-card-header">
        <div>
          <div className="panel-kicker">Year summary</div>
          <h2>Productive and tracked signals</h2>
        </div>
      </div>
      <div className="stats-detail-grid">
        {rows.map(([label, value]) => (
          <div className="info-row compact" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

export default YearSummaryPanel;
