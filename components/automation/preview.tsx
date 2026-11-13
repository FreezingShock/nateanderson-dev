"use client";

import { useState } from "react";
import { AutomationHud } from "./automation-hud";
import { canAfford } from "./format";
import { detailFor, mockHud } from "./mock";
import type { HudData, HudSettings, MachineView } from "@/lib/automation/types";

/**
 * Local preview harness: holds mock state so builds, selection and settings can be
 * clicked through. The simulation thread replaces this with real state.
 */
export function AutomationPreview() {
  const [data, setData] = useState<HudData>(mockHud);

  const build = (id: string) =>
    setData((d) => {
      const m = d.machines.find((x) => x.id === id);
      if (!m || !m.unlocked || !canAfford(m.cost, d.resources)) return d;
      const resources = d.resources.map((r) => {
        const c = m.cost.find((l) => l.resourceId === r.id);
        return c ? { ...r, amount: r.amount - c.amount } : r;
      });
      const machines = d.machines.map((x) =>
        x.id === id ? { ...x, count: x.count + 1, status: "running" as const } : x,
      );
      const updated: MachineView = machines.find((x) => x.id === id)!;
      return {
        ...d,
        resources,
        machines,
        selected: d.selected?.id === id ? detailFor(updated) : d.selected,
      };
    });

  const select = (id: string | null) =>
    setData((d) => {
      if (!id) return { ...d, selected: null };
      const m = d.machines.find((x) => x.id === id);
      return m ? { ...d, selected: detailFor(m) } : d;
    });

  const settings = (patch: Partial<HudSettings>) =>
    setData((d) => ({ ...d, settings: { ...d.settings, ...patch } }));

  return (
    <AutomationHud
      data={data}
      actions={{
        onBuild: build,
        onSelect: select,
        onNextStep: (id) => select(id),
        onSelectArea: () => {},
        onResearch: () => {},
        onPrestige: undefined,
        onSettings: settings,
      }}
    />
  );
}
