import type {
  MachineView,
  NumberFormat,
  ResourceView,
} from "@/lib/automation/types";
import { canAfford, costText } from "./format";
import { Glyph } from "./resource-strip";
import { Section } from "./factory-sections";

type GroupId = "machines" | "power" | "logistics";

const GROUP_ICON: Record<GroupId, string> = { machines: "machines", power: "power", logistics: "logistics" };

const GROUP_TITLE: Record<GroupId, string> = {
  machines: "Machines",
  power: "Power",
  logistics: "Logistics",
};

/** Build list for the factory panel. Each row builds on tap and opens its inspector with Info. */
export function BuildList({
  machines,
  resources,
  selectedId,
  numberFormat,
  onBuild,
  onSelect,
}: {
  machines: MachineView[];
  resources: ResourceView[];
  selectedId: string | null;
  numberFormat: NumberFormat;
  onBuild: (id: string) => void;
  onSelect: (id: string | null) => void;
}) {
  // One framed panel per group, in the order the groups first appear. Each panel collapses from its header.
  const groups: { id: GroupId; items: MachineView[] }[] = [];
  for (const m of machines) {
    const id = (m.group ?? "machines") as GroupId;
    let g = groups.find((x) => x.id === id);
    if (!g) groups.push((g = { id, items: [] }));
    g.items.push(m);
  }
  const renderRow = (m: MachineView) => {
        const ok = m.unlocked && canAfford(m.cost, resources);
        const selected = m.id === selectedId;
        return (
            <li
              className="ab-row ab-build-row"
              data-selected={selected}
              data-locked={!m.unlocked}
              data-afford={ok}
            >
              <button
                type="button"
                className="ab-build-main"
                disabled={!ok}
                onClick={() => onBuild(m.id)}
              >
                <Glyph code={m.glyph} size={32} icon={m.id} />
                <span className="ab-build-text">
                  <span className="ab-build-name">
                    {m.name}
                    <span className="ab-dim">
                      {" "}
                      {m.unlocked ? `x${m.count}` : "locked"}
                    </span>
                  </span>
                  <span className="ab-build-cost">
                    {m.unlocked
                      ? costText(m.cost, resources, numberFormat)
                      : m.lockedReason}
                  </span>
                </span>
                {m.unlocked && m.count > 0 && (
                  <span className="ab-status" data-status={m.status}>
                    {m.status}
                  </span>
                )}
              </button>
              <button
                type="button"
                className="ab-info"
                aria-pressed={selected}
                onClick={() => onSelect(selected ? null : m.id)}
              >
                Info
              </button>
            </li>
        );
  };
  return (
    <div className="ab-build-groups">
      {groups.map((g) => {
        const openCount = g.items.filter((m) => m.unlocked).length;
        return (
          <Section key={g.id} title={GROUP_TITLE[g.id]} icon={GROUP_ICON[g.id]} meta={`${openCount} open`}>
            <ul className="ab-build" aria-label={`${GROUP_TITLE[g.id]} to build`}>
              {g.items.map(renderRow)}
            </ul>
          </Section>
        );
      })}
    </div>
  );
}
