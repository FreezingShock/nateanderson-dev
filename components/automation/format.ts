import type { Line, NumberFormat, ResourceView } from "./types";

const UNITS = [
  [1e9, "B"],
  [1e6, "M"],
  [1e3, "K"],
] as const;

/** Compact numbers for the HUD: 1.2K, 14.5M. Full mode keeps every digit. */
export function fmtNum(n: number, mode: NumberFormat = "short"): string {
  if (!Number.isFinite(n)) return "–";
  if (mode === "full") return Math.round(n).toLocaleString("en-US");
  const abs = Math.abs(n);
  for (const [value, suffix] of UNITS) {
    if (abs >= value) {
      const x = n / value;
      const text = Math.abs(x) < 10 ? x.toFixed(2) : x.toFixed(1);
      return text.replace(/\.?0+$/, "") + suffix;
    }
  }
  if (abs < 10 && !Number.isInteger(n)) return n.toFixed(1);
  return String(Math.round(n));
}

export function fmtRate(n: number, mode: NumberFormat = "short"): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${fmtNum(n, mode)}/s`;
}

export function resourceName(resources: ResourceView[], id: string): string {
  return resources.find((r) => r.id === id)?.name ?? id;
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
