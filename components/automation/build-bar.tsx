import type {
  MachineView,
  NumberFormat,
  ResourceView,
} from "@/lib/automation/types";
import { canAfford, costText } from "./format";
import { Section } from "./factory-sections";
import { ArtIcon, UiArtIcon } from "@/components/brasswork-art/icons";
import "./build-tile.css";
import "./empty-states.css";

export type GroupId = "machines" | "power" | "logistics";

export const GROUP_ICON: Record<GroupId, string> = { machines: "machines", power: "power", logistics: "logistics" };

export const GROUP_TITLE: Record<GroupId, string> = {
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
    // Show the highest open tier the player has already built, otherwise the cheapest open tier (brass),
    // so a fresh save always has the brass Belt row to start with.
    const open = tiers.filter((t) => t.unlocked).sort((a, b) => TIER_RANK(b.id) - TIER_RANK(a.id));
    const built = open.find((t) => t.count > 0);
    const best = built ?? open[open.length - 1] ?? [...tiers].sort((a, b) => TIER_RANK(a.id) - TIER_RANK(b.id))[0];
    const count = tiers.reduce((n, t) => n + t.count, 0);
    // Add the tier word only when the name does not already carry it (for example "Steel belt").
    const tier = TIER_RANK(best.id) === 2 ? "steel" : TIER_RANK(best.id) === 1 ? "copper" : "";
    const bare = best.name.replace(/ \((copper|steel)\)$/, "");
    const name = tier && !new RegExp(tier, "i").test(bare) ? `${bare} (${tier})` : bare;
    return { ...best, id: row.id, name, count, unlocked: open.length > 0 };
  });
}

// Sub-headings inside the Logistics panel, in the order they appear.
const SUB_TITLE: Record<string, string> = {
  belts: "Belts",
  routing: "Routing",
  transfer: "Transfer",
  storage: "Storage",
  docks: "Docks",
};
function subOf(id: string): keyof typeof SUB_TITLE {
  if (id === "belt") return "belts";
  if (id.startsWith("belt-splitter") || id.startsWith("belt-merger") || id.startsWith("belt-underground")) return "routing";
  if (id.startsWith("belt-loader") || id.startsWith("belt-unloader")) return "transfer";
  if (id.startsWith("belt-crate") || id.startsWith("belt-strongbox")) return "storage";
  if (id.startsWith("belt-dock")) return "docks";
  return "belts";
}

function orderOf(id: string): number {
  const i = ORDER.indexOf(id);
  return i === -1 ? ORDER.length : i;
}

/**
 * The open rows of one group, in the order the flyout shows them. Number keys 1 to 9 pick from this list, so the
 * host's tool list and the on-screen hints must both follow it. Logistics lists its sub-groups in SUB_TITLE order.
 */
export function openRowsOf(machines: MachineView[], group: GroupId): MachineView[] {
  const subIndex = (id: string) => Object.keys(SUB_TITLE).indexOf(subOf(id));
  return collapseTiers(machines)
    .filter((m) => m.unlocked && ((m.group ?? "machines") as GroupId) === group)
    .sort((a, b) =>
      group === "logistics"
        ? subIndex(a.id) - subIndex(b.id) || orderOf(a.id) - orderOf(b.id)
        : orderOf(a.id) - orderOf(b.id),
    );
}

/** Build list for the factory panel. Each row builds on tap and opens its inspector with Info. */
export function BuildList({
  machines,
  resources,
  selectedId,
  armedId = null,
  group = null,
  numberFormat,
  onBuild,
  onSelect,
}: {
  machines: MachineView[];
  resources: ResourceView[];
  selectedId: string | null;
  armedId?: string | null;
  /** Desktop dock: show only this group's panel. Null shows every group. */
  group?: GroupId | null;
  numberFormat: NumberFormat;
  onBuild: (id: string) => void;
  onSelect: (id: string | null) => void;
}) {
  // One framed panel per group, in the order the groups first appear. Each panel collapses from its header.
  const groups: { id: GroupId; items: MachineView[] }[] = [];
  const shown = collapseTiers(machines).sort((a, b) => orderOf(a.id) - orderOf(b.id));
  for (const m of shown) {
    const id = (m.group ?? "machines") as GroupId;
    if (group && id !== group) continue;
    let g = groups.find((x) => x.id === id);
    if (!g) groups.push((g = { id, items: [] }));
    g.items.push(m);
  }
  // Number-key hint for each open row of the shown group: 1 to 9, in the order the rows are listed.
  const hintOf = new Map<string, number>();
  if (group) openRowsOf(machines, group).slice(0, 9).forEach((m, i) => hintOf.set(m.id, i + 1));
  const renderRow = (m: MachineView) => {
        const ok = m.unlocked && canAfford(m.cost, resources);
        const hint = hintOf.get(m.id);
        const selected = m.id === selectedId;
        const armed = m.id === armedId;
        return (
            <li
              key={m.id}
              className="bwt"
              data-selected={selected}
              data-armed={armed}
              data-locked={!m.unlocked}
              data-afford={ok}
            >
              <button
                type="button"
                className="bwt-main"
                disabled={!m.unlocked}
                aria-pressed={armed}
                data-afford={ok}
                aria-label={`${armed ? "Holding" : "Select"} ${m.name}${ok ? "" : " (not enough resources yet)"}`}
                onClick={() => onBuild(m.id)}
              >
                <span className="bwt-plate">
                  <ArtIcon id={m.id} size={80} name={m.name} />
                </span>
                <span className="bwt-text">
                  <span className="bwt-name">{m.name}</span>
                  <span className="bwt-cost">
                    {m.unlocked ? costText(m.cost, resources, numberFormat) || "Free" : m.lockedReason}
                  </span>
                  <span className="bwt-meta">
                    {m.unlocked && <span className="bwt-count">{m.count} built</span>}
                    {m.unlocked && m.count > 0 && (
                      <span className="ab-status" data-status={m.status}>{m.status}</span>
                    )}
                  </span>
                </span>
                {hint !== undefined && <kbd className="bwt-key" aria-hidden="true">{hint}</kbd>}
                <span className="bwt-held" aria-hidden="true">In hand</span>
              </button>
              <button
                type="button"
                className="bwt-info"
                aria-pressed={selected}
                onClick={() => onSelect(selected ? null : m.id)}
                aria-label={`${selected ? "Close" : "Show"} details for ${m.name}`}
                title={`${selected ? "Close" : "Show"} details`}
              >
                <UiArtIcon id={selected ? "close" : "info"} size={24} />
              </button>
            </li>
        );
  };
  // Belts first: a new player needs them before anything else. Then machines, then power.
  const GROUP_RANK: Record<GroupId, number> = { logistics: 0, machines: 1, power: 2 };
  groups.sort((a, b) => GROUP_RANK[a.id] - GROUP_RANK[b.id]);
  // Open rows show in full; locked rows fold into one line so the palette stays short.
  const renderItems = (items: MachineView[]) => {
    const open = items.filter((m) => m.unlocked);
    const locked = items.length - open.length;
    return (
      <>
        {open.map(renderRow)}
        {locked > 0 && (
          <li className="ab-locked-note">
            <span className="ab-locked-slots" aria-hidden="true">
              {Array.from({ length: Math.min(locked, 4) }, (_, i) => (
                <span key={i} className="ab-locked-slot" style={{ ["--i" as string]: i }}><UiArtIcon id="lock" size={20} /></span>
              ))}
            </span>
            <span>{locked} more to open. Fill hub orders and they appear here.</span>
          </li>
        )}
      </>
    );
  };
  return (
    <div className="ab-build-groups">
      {groups.map((g) => {
        const openCount = g.items.filter((m) => m.unlocked).length;
        return (
          <Section key={g.id} title={GROUP_TITLE[g.id]} icon={GROUP_ICON[g.id]} meta={`${openCount} open`}>
            {g.id === "logistics" ? (
              (Object.keys(SUB_TITLE) as (keyof typeof SUB_TITLE)[])
                .map((sub) => ({ sub, items: g.items.filter((m) => subOf(m.id) === sub) }))
                .filter((x) => x.items.length > 0)
                .map((x) => (
                  <div key={x.sub} className="ab-sub">
                    <h3 className="ab-sub-title">{SUB_TITLE[x.sub]}</h3>
                    <ul className="ab-build" aria-label={`${SUB_TITLE[x.sub]} to build`}>
                      {renderItems(x.items)}
                    </ul>
                  </div>
                ))
            ) : (
              <ul className="ab-build" aria-label={`${GROUP_TITLE[g.id]} to build`}>
                {renderItems(g.items)}
              </ul>
            )}
          </Section>
        );
      })}
    </div>
  );
}
