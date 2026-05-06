type StatsKpiCardProps = {
  label: string;
  value: string;
  detail: string;
};

function StatsKpiCard({ label, value, detail }: StatsKpiCardProps) {
  return (
    <div className="stats-kpi-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

export default StatsKpiCard;
