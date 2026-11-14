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

// Palette order for each group: what a new player needs first. Ids not listed sort after these, in their original order.
const ORDER: string[] = [
  "drill", "kiln", "belt", "belt-splitter", "belt-merger", "belt-underground-in", "belt-underground-out",
  "belt-loader", "belt-unloader", "belt-crate", "belt-dock", "belt-strongbox",
  "furnace", "press", "lathe", "drawer", "assembler", "fabricator", "hub",
  "windmill", "spring_winder", "spring_store",
];
const TIER_SUFFIX = /-(copper|steel)$/;
const TIER_RANK = (id: string) => (id.endsWith("-steel") ? 2 : id.endsWith("-copper") ? 1 : 0);

/**
 * Collapses tier variants (plain, -copper, -steel) into one row. The row builds the best unlocked tier,
 * and the name says which tier that is. Locked variants are hidden unless no tier is open yet.
 */
function collapseTiers(list: MachineView[]): MachineView[] {
  const byBase = new Map<string, MachineView[]>();
  const out: MachineView[] = [];
  for (const m of list) {
    const base = m.id.replace(TIER_SUFFIX, "");
    if (base === m.id && !list.some((x) => x.id.startsWith(`${m.id}-`) && TIER_SUFFIX.test(x.id.slice(m.id.length))))
      { out.push(m); continue; }
    if (!byBase.has(base)) { byBase.set(base, []); out.push({ ...m, id: base }); }
    byBase.get(base)!.push(m);
  }
  return out.map((row) => {
    const tiers = byBase.get(row.id);
    if (!tiers) return row;
    const open = tiers.filter((t) => t.unlocked).sort((a, b) => TIER_RANK(b.id) - TIER_RANK(a.id));
    const best = open[0] ?? tiers.sort((a, b) => TIER_RANK(a.id) - TIER_RANK(b.id))[0];
    const count = tiers.reduce((n, t) => n + t.count, 0);
    const tierName = TIER_RANK(best.id) === 2 ? " (steel)" : TIER_RANK(best.id) === 1 ? " (copper)" : "";
    return { ...best, id: row.id, name: best.name.replace(/ \((copper|steel)\)$/, "") + tierName, count, unlocked: open.length > 0 };
  });
}

function orderOf(id: string): number {
  const i = ORDER.indexOf(id);
  return i === -1 ? ORDER.length : i;
}

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
  const shown = collapseTiers(machines).sort((a, b) => orderOf(a.id) - orderOf(b.id));
  for (const m of shown) {
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
                aria-label={`${selected ? "Close" : "Show"} details for ${m.name}`}
              >
                {selected ? "Close" : "Details"}
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
