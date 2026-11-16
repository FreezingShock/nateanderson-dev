import type { Line, NumberFormat, ResourceView } from "@/lib/automation/types";
import { formatNumber, formatRate } from "@/lib/game-kit/format";

/** Compact numbers for the HUD: 1.2K, 14.5M. Full mode keeps every digit. The game kit's "compact" and "full" styles. */
export function fmtNum(n: number, mode: NumberFormat = "short"): string {
  return formatNumber(n, mode === "full" ? "full" : "compact");
}

export function fmtRate(n: number, mode: NumberFormat = "short"): string {
  return formatRate(n, mode === "full" ? "full" : "compact");
}

export function resourceName(resources: ResourceView[], id: string): string {
  const found = resources.find((r) => r.id === id)?.name;
  if (found) return found;
  // Items not in stock yet have no ResourceView, so turn the raw id ("steel_ingot") into readable words.
  const words = id.replace(/[_-]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** True when every line of the cost is covered by the current amounts. */
export function canAfford(cost: Line[], resources: ResourceView[]): boolean {
  return cost.every((line) => {
    const have = resources.find((r) => r.id === line.resourceId)?.amount ?? 0;
    return have >= line.amount;
  });
}

export function costText(
  cost: Line[],
  resources: ResourceView[],
  mode: NumberFormat = "short",
): string {
  return cost
    .map((l) => `${fmtNum(l.amount, mode)} ${resourceName(resources, l.resourceId)}`)
    .join(" · ");
}
