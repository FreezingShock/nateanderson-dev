import { Fragment } from "react";
import type {
  MachineView,
  NumberFormat,
  ResourceView,
} from "@/lib/automation/types";
import { canAfford, costText } from "./format";
import { Glyph } from "./resource-strip";

const GROUP_TITLE: Record<"machines" | "power" | "logistics", string> = {
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
  return (
    <ul className="ab-build" aria-label="Machines to build">
      {machines.map((m, i) => {
        const ok = m.unlocked && canAfford(m.cost, resources);
        const selected = m.id === selectedId;
        const group = m.group ?? "machines";
        const heading = group !== (machines[i - 1]?.group ?? "machines");
        return (
          <Fragment key={m.id}>
            {heading && (
              <li className="ab-build-group ab-dim" role="presentation">
                {GROUP_TITLE[group]}
              </li>
            )}
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
          </Fragment>
        );
      })}
    </ul>
  );
}
