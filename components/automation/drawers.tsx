import type { AreaView, StatLine } from "@/lib/automation/types";

export function ExpeditionList({
  areas,
  onSelectArea,
}: {
  areas: AreaView[];
  onSelectArea?: (id: string) => void;
}) {
  return (
    <ul className="ab-list" aria-label="Expedition areas">
      {areas.map((a) => {
        const locked = a.state === "locked";
        return (
          <li key={a.id} className="ab-row" data-state={a.state}>
            <button
              type="button"
              className="ab-list-btn"
              disabled={locked || !onSelectArea}
              onClick={() => onSelectArea?.(a.id)}
            >
              <span className="ab-list-name">{a.name}</span>
              <span className="ab-dim">{a.note}</span>
              <span className="ab-state">{a.state}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function StatsList({ stats }: { stats: StatLine[] }) {
  return (
    <dl className="ab-data" aria-label="Production stats">
      {stats.map((s) => (
        <div key={s.label}>
          <dt>{s.label}</dt>
          <dd>{s.value}</dd>
        </div>
      ))}
    </dl>
  );
}
