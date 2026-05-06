import type { YearTotals } from "../../utils/stats";

type YearTotalsPanelProps = {
  totals: YearTotals;
};

function YearTotalsPanel({ totals }: YearTotalsPanelProps) {
  const rows = [
    ["Tasks created", totals.createdTasks.toString()],
    ["Tasks completed", totals.completedTasks.toString()],
    ["Tasks overdue", totals.overdueTasks.toString()],
    ["Time blocks", totals.timeBlocksCount.toString()],
    ["Normal hours", `${totals.totalPlannedHours.toFixed(1)}h`],
    ["Study hours", `${totals.studyHours.toFixed(1)}h`],
    ["Class hours", `${totals.classHours.toFixed(1)}h`],
    ["Rest hours", `${totals.restHours.toFixed(1)}h`],
  ];

  return (
    <section className="stats-card year-totals-panel">
      <div className="stats-card-header">
        <div>
          <div className="panel-kicker">Year totals</div>
          <h2>Total counts</h2>
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

export default YearTotalsPanel;
