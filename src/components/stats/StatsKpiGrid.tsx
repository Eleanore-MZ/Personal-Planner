import StatsKpiCard from "./StatsKpiCard";

type StatsKpi = {
  label: string;
  value: string;
  detail: string;
};

type StatsKpiGridProps = {
  items: StatsKpi[];
};

function StatsKpiGrid({ items }: StatsKpiGridProps) {
  return (
    <section className="stats-kpi-grid" aria-label="Stats summary">
      {items.map((item) => (
        <StatsKpiCard
          detail={item.detail}
          key={item.label}
          label={item.label}
          value={item.value}
        />
      ))}
    </section>
  );
}

export default StatsKpiGrid;
